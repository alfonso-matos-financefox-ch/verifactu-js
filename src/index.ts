import {
  buildAltaHashInput,
  buildAnulacionHashInput,
  computeHash,
} from './hash.js'
import { buildQrUrl } from './qr.js'
import { buildRegistroAltaXml, buildRegistroAnulacionXml, wrapForSoap } from './xml.js'
import type {
  AltaXmlInput,
  CabeceraInput,
  DestinatarioF1,
  IvaLine,
  RegistroAnteriorXml,
  SistemaInformaticoInput,
} from './xml.js'

export type { CabeceraInput, DestinatarioF1, IvaLine }
export { wrapForSoap, SOAP_MAX_RECORDS, SF_NAMESPACE, SFLR_NAMESPACE } from './xml.js'

export interface VerifactuConfig {
  nif: string
  nombreRazon: string
  softwareNif: string
  softwareNombre: string
  softwareVersion: string
  softwareId: string // IdSistemaInformatico — máx. 2 caracteres (XSD TextMax2Type)
  numeroInstalacion?: string // default '1'
  testMode?: boolean // default false — true apunta el QR a prewww2.aeat.es
}

export type TipoFacturaAlta = 'F1' | 'F2'

// Referencia al último registro emitido — los clientes deben persistirla junto al hash:
// el bloque XML Encadenamiento/RegistroAnterior exige numSerie y fecha de la factura anterior.
export interface RegistroAnteriorRef {
  numSerie: string
  fecha: FechaInput
  huella: string
  idEmisor?: string // default: config.nif (mismo obligado)
}

export interface FiscalInput {
  config: VerifactuConfig
  numSerie: string
  fecha: FechaInput
  // Instante de generación del registro (entra en el hash). Date → se formatea con el huso
  // del runtime; string → se usa tal cual (debe ser ISO 8601 con huso). Default: ahora.
  fechaHoraGenRegistro?: Date | string
  tipoFactura?: TipoFacturaAlta // default: 'F1' si hay destinatario, 'F2' si no
  descripcion: string
  desgloseIva: IvaLine[]
  cuotaTotal: string
  importeTotal: string
  esPrimerRegistro: boolean
  registroAnterior?: RegistroAnteriorRef // obligatorio si esPrimerRegistro === false
  destinatario?: DestinatarioF1
}

export interface FiscalData {
  hash: string // hex MAYÚSCULAS, 64 chars
  xml: string // <RegistroAlta> conforme a SuministroInformacion.xsd
  qrUrl: string
  fechaHoraGenRegistro: string // el valor exacto que entró en el hash — persistir
}

export interface AnulacionInput {
  config: VerifactuConfig
  numSerieAnulada: string
  fechaAnulada: FechaInput
  fechaHoraGenRegistro?: Date | string
  esPrimerRegistro: boolean
  registroAnterior?: RegistroAnteriorRef
}

export interface AnulacionData {
  hash: string
  xml: string // <RegistroAnulacion>
  fechaHoraGenRegistro: string
}

export function centsToImporte(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToImporte: expected integer cents, got ${cents}`)
  }
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const dec = String(abs % 100).padStart(2, '0')
  return `${sign}${euros}.${dec}`
}

// Fecha de expedición: Date (formateo con la TZ del runtime) o string 'YYYY-MM-DD' usada
// verbatim — recomendado en servidores UTC, donde un Date de madrugada española daría el día anterior
export type FechaInput = Date | string

const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function formatFecha(d: FechaInput): string {
  if (typeof d === 'string') {
    if (!FECHA_ISO_RE.test(d)) {
      throw new Error(`Invalid fecha: expected 'YYYY-MM-DD' string or Date, got '${d}'`)
    }
    const [yyyy, mm, dd] = d.split('-')
    return `${dd}-${mm}-${yyyy}`
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

const FECHA_HORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/

function resolveFechaHora(value: Date | string | undefined): string {
  if (value === undefined) return formatFechaHora(new Date())
  if (typeof value === 'string') {
    if (!FECHA_HORA_RE.test(value)) {
      throw new Error(
        `Invalid fechaHoraGenRegistro: must be ISO 8601 with offset (e.g. 2026-01-01T12:00:00+01:00), got '${value}'`,
      )
    }
    return value
  }
  return formatFechaHora(value)
}

function formatFechaHora(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const mn = String(Math.abs(offset) % 60).padStart(2, '0')
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`
}

// Doc AEAT huella §5: hex MAYÚSCULAS, 64 chars
const HUELLA_RE = /^[0-9A-F]{64}$/
// Importes: string con punto decimal y exactamente 2 decimales (determinismo del hash:
// '12.6' y '12.60' producen huellas distintas, la librería exige un único formato)
const IMPORTE_RE = /^-?\d{1,12}\.\d{2}$/
const TIPO_IMPOSITIVO_RE = /^\d{1,2}(\.\d{1,2})?$/

function assertImporte(value: string, field: string): void {
  if (!IMPORTE_RE.test(value)) {
    throw new Error(`Invalid ${field}: expected string with dot and 2 decimals (e.g. '12.60'), got '${value}'`)
  }
}

function assertConfig(config: VerifactuConfig): void {
  if (config.softwareId.length > 2) {
    throw new Error(
      `Invalid softwareId '${config.softwareId}': IdSistemaInformatico is limited to 2 characters by the AEAT schema (TextMax2Type)`,
    )
  }
}

function assertChain(esPrimerRegistro: boolean, registroAnterior: RegistroAnteriorRef | undefined): void {
  if (esPrimerRegistro && registroAnterior !== undefined) {
    throw new Error('Invalid chain input: first record must not have registroAnterior')
  }
  if (!esPrimerRegistro) {
    if (registroAnterior === undefined) {
      throw new Error('Invalid chain input: non-first record requires registroAnterior')
    }
    if (!HUELLA_RE.test(registroAnterior.huella)) {
      throw new Error('Invalid chain input: registroAnterior.huella must be uppercase 64-char hex')
    }
  }
}

function resolveRegistroAnterior(
  config: VerifactuConfig,
  ref: RegistroAnteriorRef | undefined,
): RegistroAnteriorXml | null {
  if (ref === undefined) return null
  return {
    idEmisor: ref.idEmisor ?? config.nif,
    numSerie: ref.numSerie,
    fecha: formatFecha(ref.fecha),
    huella: ref.huella,
  }
}

function sistemaFromConfig(config: VerifactuConfig): SistemaInformaticoInput {
  return {
    nombreRazon: config.softwareNombre,
    nif: config.softwareNif,
    nombreSistema: config.softwareNombre,
    id: config.softwareId,
    version: config.softwareVersion,
    numeroInstalacion: config.numeroInstalacion ?? '1',
  }
}

export async function buildInvoiceRecord(input: FiscalInput): Promise<FiscalData> {
  assertConfig(input.config)
  assertChain(input.esPrimerRegistro, input.registroAnterior)
  assertImporte(input.cuotaTotal, 'cuotaTotal')
  assertImporte(input.importeTotal, 'importeTotal')
  if (input.desgloseIva.length === 0) {
    throw new Error('Invalid desgloseIva: must contain at least one line (XSD requires >=1 DetalleDesglose)')
  }
  for (const line of input.desgloseIva) {
    assertImporte(line.baseImponible, 'desgloseIva.baseImponible')
    assertImporte(line.cuotaRepercutida, 'desgloseIva.cuotaRepercutida')
    if (!TIPO_IMPOSITIVO_RE.test(line.tipoImpositivo)) {
      throw new Error(`Invalid desgloseIva.tipoImpositivo: got '${line.tipoImpositivo}'`)
    }
  }

  const tipoFactura = input.tipoFactura ?? (input.destinatario ? 'F1' : 'F2')
  if (tipoFactura === 'F1' && input.destinatario === undefined) {
    throw new Error('Invalid input: tipoFactura F1 requires destinatario')
  }
  if (tipoFactura === 'F2' && input.destinatario !== undefined) {
    throw new Error('Invalid input: tipoFactura F2 must not have destinatario')
  }

  const fecha = formatFecha(input.fecha)
  const fechaHoraGenRegistro = resolveFechaHora(input.fechaHoraGenRegistro)

  const hash = await computeHash(
    buildAltaHashInput({
      idEmisorFactura: input.config.nif,
      numSerieFactura: input.numSerie,
      fechaExpedicionFactura: fecha,
      tipoFactura,
      cuotaTotal: input.cuotaTotal,
      importeTotal: input.importeTotal,
      huellaAnterior: input.registroAnterior?.huella ?? '',
      fechaHoraHusoGenRegistro: fechaHoraGenRegistro,
    }),
  )

  const xmlInput: AltaXmlInput = {
    nif: input.config.nif,
    nombreRazon: input.config.nombreRazon,
    sistema: sistemaFromConfig(input.config),
    numSerie: input.numSerie,
    fecha,
    fechaHoraGenRegistro,
    tipoFactura,
    descripcion: input.descripcion,
    desgloseIva: input.desgloseIva,
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    registroAnterior: resolveRegistroAnterior(input.config, input.registroAnterior),
    hash,
    ...(input.destinatario !== undefined ? { destinatario: input.destinatario } : {}),
  }

  const qrUrl = buildQrUrl({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    importeTotal: input.importeTotal,
    testMode: input.config.testMode ?? false,
  })

  return { hash, xml: buildRegistroAltaXml(xmlInput), qrUrl, fechaHoraGenRegistro }
}

export async function buildAnulacionRecord(input: AnulacionInput): Promise<AnulacionData> {
  assertConfig(input.config)
  assertChain(input.esPrimerRegistro, input.registroAnterior)

  const fechaAnulada = formatFecha(input.fechaAnulada)
  const fechaHoraGenRegistro = resolveFechaHora(input.fechaHoraGenRegistro)

  const hash = await computeHash(
    buildAnulacionHashInput({
      idEmisorFacturaAnulada: input.config.nif,
      numSerieFacturaAnulada: input.numSerieAnulada,
      fechaExpedicionFacturaAnulada: fechaAnulada,
      huellaAnterior: input.registroAnterior?.huella ?? '',
      fechaHoraHusoGenRegistro: fechaHoraGenRegistro,
    }),
  )

  const xml = buildRegistroAnulacionXml({
    nif: input.config.nif,
    sistema: sistemaFromConfig(input.config),
    numSerieAnulada: input.numSerieAnulada,
    fechaAnulada,
    fechaHoraGenRegistro,
    registroAnterior: resolveRegistroAnterior(input.config, input.registroAnterior),
    hash,
  })

  return { hash, xml, fechaHoraGenRegistro }
}

export type BatchInvoiceInput = Omit<FiscalInput, 'esPrimerRegistro' | 'registroAnterior'>

export interface BatchInvoiceResult {
  results: FiscalData[]
  // Referencia al último registro del batch — persistir para encadenar el siguiente
  lastRef: RegistroAnteriorRef | null
}

export async function buildBatchInvoiceRecords(
  inputs: BatchInvoiceInput[],
  startingRef: RegistroAnteriorRef | null,
): Promise<BatchInvoiceResult> {
  let currentRef = startingRef
  const results: FiscalData[] = []

  for (const input of inputs) {
    const result = await buildInvoiceRecord({
      ...input,
      esPrimerRegistro: currentRef === null,
      ...(currentRef !== null ? { registroAnterior: currentRef } : {}),
    })
    results.push(result)
    currentRef = { numSerie: input.numSerie, fecha: input.fecha, huella: result.hash }
  }

  return { results, lastRef: currentRef }
}
