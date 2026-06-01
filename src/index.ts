import { buildHashInput, computeHash } from './hash.js'
import { buildQrUrl } from './qr.js'
import { buildTicketXml } from './xml.js'
import type { IvaLine, XmlInput } from './xml.js'

export type { IvaLine }

export interface VerifactuConfig {
  nif: string
  nombreRazon: string
  softwareNif: string
  softwareNombre: string
  softwareVersion: string
  softwareId: string
  testMode?: boolean   // default: false
}

export interface FiscalInput {
  config: VerifactuConfig
  numSerie: string
  serie: string
  fecha: Date
  numRegistro: number
  desgloseIva: IvaLine[]
  cuotaTotal: string
  importeTotal: string
  previousHash: string
  esPrimerRegistro: boolean
}

export interface FiscalData {
  hash: string
  xml: string
  qrUrl: string
}

function formatFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function formatFechaHora(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const mn = String(Math.abs(offset) % 60).padStart(2, '0')
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`
}

function assertPreviousHash(value: string): void {
  if (value !== '' && !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error('Invalid chain input: previousHash must be empty or lowercase 64-char hex')
  }
}

function assertChainInput(input: FiscalInput): void {
  if (input.esPrimerRegistro && input.previousHash !== '') {
    throw new Error('Invalid chain input: first record must have empty previousHash')
  }
  if (!input.esPrimerRegistro && input.previousHash === '') {
    throw new Error('Invalid chain input: non-first record must have previousHash')
  }
  assertPreviousHash(input.previousHash)
}

export async function buildTicketFiscalData(input: FiscalInput): Promise<FiscalData> {
  assertChainInput(input)
  const fecha = formatFecha(input.fecha)

  const hashStr = buildHashInput({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    tipoFactura: 'F2',
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash,
  })

  const hash = await computeHash(hashStr)

  const xmlInput: XmlInput = {
    nif: input.config.nif,
    nombreRazon: input.config.nombreRazon,
    softwareNif: input.config.softwareNif,
    softwareNombre: input.config.softwareNombre,
    softwareVersion: input.config.softwareVersion,
    softwareId: input.config.softwareId,
    numSerie: input.numSerie,
    fecha,
    fechaHora: formatFechaHora(input.fecha),
    numRegistro: input.numRegistro,
    tipoFactura: 'F2',
    descripcion: 'Venda de productes',
    desgloseIva: input.desgloseIva,
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash,
    hash,
    esPrimerRegistro: input.esPrimerRegistro,
  }

  const xml = buildTicketXml(xmlInput)
  const qrUrl = buildQrUrl({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    importeTotal: input.importeTotal,
    testMode: input.config.testMode ?? false,
  })

  return { hash, xml, qrUrl }
}

export type BatchFiscalInput = Omit<FiscalInput, 'previousHash' | 'esPrimerRegistro'>

export interface BatchFiscalResult {
  results: FiscalData[]
  lastHash: string
}

export async function buildBatchFiscalData(
  inputs: BatchFiscalInput[],
  startingHash: string,
): Promise<BatchFiscalResult> {
  assertPreviousHash(startingHash)
  let currentHash = startingHash
  const results: FiscalData[] = []

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i]!
    const esPrimerRegistro = currentHash === '' && i === 0
    const result = await buildTicketFiscalData({
      config: input.config,
      numSerie: input.numSerie,
      serie: input.serie,
      fecha: input.fecha,
      numRegistro: input.numRegistro,
      desgloseIva: input.desgloseIva,
      cuotaTotal: input.cuotaTotal,
      importeTotal: input.importeTotal,
      previousHash: currentHash,
      esPrimerRegistro,
    })
    results.push(result)
    currentHash = result.hash
  }

  return { results, lastHash: currentHash }
}

