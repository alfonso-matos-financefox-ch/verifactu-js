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
  /**
   * NombreRazon del bloque SistemaInformatico: nombre o razon social de la
   * persona o entidad PRODUCTORA del software, no el nombre del software.
   * El nombre comercial va en softwareNombre (NombreSistemaInformatico).
   *
   * Fuente: AEAT, contenido del registro de facturacion de alta, punto 16 —
   * «el codigo de identificacion del sistema informatico utilizado, junto con
   * los datos identificativos del PRODUCTOR del citado sistema informatico».
   *
   * Con software autodesarrollado el productor es el propio obligado, asi que
   * el valor coincide con `nombreRazon`.
   *
   * Opcional por compatibilidad: si se omite se usa softwareNombre, que es lo
   * que hacian las versiones <= 2.0.1 (y es incorrecto). Ponlo siempre.
   */
  softwareNombreRazon?: string
  softwareVersion: string
  softwareId: string // IdSistemaInformatico — máx. 2 caracteres (XSD TextMax2Type)
  numeroInstalacion?: string // default '1'
  testMode?: boolean // default false — true apunta el QR a prewww2.aeat.es
}

// F3 = factura emitida en sustitución de facturas simplificadas facturadas y declaradas
// (canje de tickets). Lleva destinatario y la lista de tickets sustituidos.
// R1..R5 = rectificativas (v2.3.0). R1 art. 80.1-80.2 LIVA y error fundado en derecho, R2 art. 80.3
// (concurso), R3 art. 80.4 (créditos incobrables), R4 resto, R5 rectificativa de factura simplificada.
// R1..R4 llevan destinatario; R5 no (como F2).
export type TipoFacturaRectificativa = 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
export type TipoFacturaAlta = 'F1' | 'F2' | 'F3' | TipoFacturaRectificativa

// S = por sustitución (la rectificativa trae los importes correctos y exige importeRectificacion);
// I = por diferencias (trae solo la diferencia, normalmente negativa).
export type TipoRectificativa = 'S' | 'I'

// Factura simplificada que la F3 sustituye. idEmisor default: config.nif (mismo obligado).
export interface FacturaSustituidaRef {
  numSerie: string
  fecha: FechaInput
  idEmisor?: string
}

// Factura que la rectificativa corrige. Misma forma que la sustituida (IDFacturaARType).
export type FacturaRectificadaRef = FacturaSustituidaRef

// DesgloseRectificacionType: base y cuota de la factura ORIGINAL rectificada (solo tipoRectificativa S)
export interface ImporteRectificacion {
  baseRectificada: string
  cuotaRectificada: string
  cuotaRecargoRectificado?: string
}

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
  facturasSustituidas?: FacturaSustituidaRef[] // obligatorio (>=1) si tipoFactura === 'F3'; prohibido en otro caso
  tipoRectificativa?: TipoRectificativa // obligatorio si tipoFactura R1..R5; prohibido en otro caso
  facturasRectificadas?: FacturaRectificadaRef[] // opcional (<=1000) con R1..R5; prohibido en otro caso
  importeRectificacion?: ImporteRectificacion // obligatorio si tipoRectificativa === 'S'; prohibido en otro caso
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
    // Productor del software. El fallback a softwareNombre reproduce el
    // comportamiento (erroneo) de <= 2.0.1 para no romper a quien no lo pase.
    nombreRazon: config.softwareNombreRazon ?? config.softwareNombre,
    nif: config.softwareNif,
    nombreSistema: config.softwareNombre,
    id: config.softwareId,
    version: config.softwareVersion,
    numeroInstalacion: config.numeroInstalacion ?? '1',
  }
}

const TIPOS_RECTIFICATIVA: ReadonlySet<TipoFacturaAlta> = new Set(['R1', 'R2', 'R3', 'R4', 'R5'])
const TIPOS_SIN_DESTINATARIO: ReadonlySet<TipoFacturaAlta> = new Set(['F2', 'R5'])

// Reglas AEAT del bloque de rectificación: TipoRectificativa obligatorio en R1..R5 y prohibido fuera;
// FacturasRectificadas solo en R1..R5 (opcional); ImporteRectificacion obligatorio con S y prohibido con I.
// Nada de esto entra en la huella (solo TipoFactura).
function resolveRectificacion(
  input: FiscalInput,
  tipoFactura: TipoFacturaAlta,
): Pick<AltaXmlInput, 'tipoRectificativa' | 'facturasRectificadas' | 'importeRectificacion'> {
  const { tipoRectificativa, facturasRectificadas, importeRectificacion } = input
  if (!TIPOS_RECTIFICATIVA.has(tipoFactura)) {
    if (tipoRectificativa !== undefined) {
      throw new Error(`Invalid input: tipoRectificativa only allowed with tipoFactura R1-R5 (got ${tipoFactura})`)
    }
    if (facturasRectificadas !== undefined && facturasRectificadas.length > 0) {
      throw new Error(`Invalid input: facturasRectificadas only allowed with tipoFactura R1-R5 (got ${tipoFactura})`)
    }
    if (importeRectificacion !== undefined) {
      throw new Error(`Invalid input: importeRectificacion only allowed with tipoRectificativa S (got ${tipoFactura})`)
    }
    return {}
  }
  if (tipoRectificativa !== 'S' && tipoRectificativa !== 'I') {
    throw new Error(`Invalid input: tipoFactura ${tipoFactura} requires tipoRectificativa 'S' or 'I'`)
  }
  if (tipoRectificativa === 'S' && importeRectificacion === undefined) {
    throw new Error('Invalid input: tipoRectificativa S requires importeRectificacion')
  }
  if (tipoRectificativa === 'I' && importeRectificacion !== undefined) {
    throw new Error('Invalid input: importeRectificacion only allowed with tipoRectificativa S')
  }
  if (importeRectificacion !== undefined) {
    assertImporte(importeRectificacion.baseRectificada, 'importeRectificacion.baseRectificada')
    assertImporte(importeRectificacion.cuotaRectificada, 'importeRectificacion.cuotaRectificada')
    if (importeRectificacion.cuotaRecargoRectificado !== undefined) {
      assertImporte(importeRectificacion.cuotaRecargoRectificado, 'importeRectificacion.cuotaRecargoRectificado')
    }
  }
  const list = facturasRectificadas ?? []
  if (list.length > 1000) {
    throw new Error('Invalid input: facturasRectificadas max 1000 (XSD maxOccurs)')
  }
  const rectificadas = list.map(f => {
    if (!f.numSerie || f.numSerie.length > 60) {
      throw new Error(`Invalid facturasRectificadas.numSerie: got '${f.numSerie}' (1-60 chars)`)
    }
    return { idEmisor: f.idEmisor ?? input.config.nif, numSerie: f.numSerie, fecha: formatFecha(f.fecha) }
  })
  return {
    tipoRectificativa,
    ...(rectificadas.length > 0 ? { facturasRectificadas: rectificadas } : {}),
    ...(importeRectificacion !== undefined ? { importeRectificacion } : {}),
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
  // AEAT: Destinatarios obligatorio en F1, F3 y R1..R4; prohibido en F2 y R5
  if (TIPOS_SIN_DESTINATARIO.has(tipoFactura)) {
    if (input.destinatario !== undefined) {
      throw new Error(`Invalid input: tipoFactura ${tipoFactura} must not have destinatario`)
    }
  } else if (input.destinatario === undefined) {
    throw new Error(`Invalid input: tipoFactura ${tipoFactura} requires destinatario`)
  }
  if (tipoFactura === 'F3') {
    if (!input.facturasSustituidas || input.facturasSustituidas.length === 0) {
      throw new Error('Invalid input: tipoFactura F3 requires facturasSustituidas (>=1)')
    }
    if (input.facturasSustituidas.length > 1000) {
      throw new Error('Invalid input: facturasSustituidas max 1000 (XSD maxOccurs)')
    }
  } else if (input.facturasSustituidas !== undefined && input.facturasSustituidas.length > 0) {
    throw new Error(`Invalid input: facturasSustituidas only allowed with tipoFactura F3 (got ${tipoFactura})`)
  }
  const facturasSustituidas = (input.facturasSustituidas ?? []).map(f => {
    if (!f.numSerie || f.numSerie.length > 60) {
      throw new Error(`Invalid facturasSustituidas.numSerie: got '${f.numSerie}' (1-60 chars)`)
    }
    return { idEmisor: f.idEmisor ?? input.config.nif, numSerie: f.numSerie, fecha: formatFecha(f.fecha) }
  })
  const rectificacion = resolveRectificacion(input, tipoFactura)

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
    ...(facturasSustituidas.length > 0 ? { facturasSustituidas } : {}),
    ...rectificacion,
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
