import { describe, it, expect } from 'vitest'
import { buildTicketFiscalData, buildBatchFiscalData } from '../src/index'
import type { VerifactuConfig, BatchFiscalInput } from '../src/index'

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa, S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'Pallaresa TPV',
  softwareVersion: '1.0',
  softwareId: 'PALLARESA-TPV-1',
}

const VALID_HASH = 'a'.repeat(64)

describe('assertChainInput — buildTicketFiscalData', () => {
  it('throws when esPrimerRegistro=true and previousHash is non-empty', async () => {
    await expect(buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date('2026-01-01T12:00:00'),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: VALID_HASH,
      esPrimerRegistro: true,
    })).rejects.toThrow('first record must have empty previousHash')
  })

  it('throws when esPrimerRegistro=false and previousHash is empty', async () => {
    await expect(buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date('2026-01-01T12:00:00'),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: '',
      esPrimerRegistro: false,
    })).rejects.toThrow('non-first record must have previousHash')
  })

  it('throws when previousHash is non-empty but not valid lowercase 64-char hex', async () => {
    await expect(buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date('2026-01-01T12:00:00'),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: 'not-a-valid-hash',
      esPrimerRegistro: false,
    })).rejects.toThrow('previousHash must be empty or lowercase 64-char hex')
  })

  it('throws when previousHash is uppercase hex (only lowercase canonical)', async () => {
    await expect(buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date('2026-01-01T12:00:00'),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: 'A'.repeat(64),
      esPrimerRegistro: false,
    })).rejects.toThrow('previousHash must be empty or lowercase 64-char hex')
  })

  it('succeeds with valid first record', async () => {
    const result = await buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date('2026-01-01T12:00:00'),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: '',
      esPrimerRegistro: true,
    })
    expect(result.hash).toHaveLength(64)
    expect(result.xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
  })

  it('succeeds with valid chained record', async () => {
    const result = await buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000002', serie: 'A',
      fecha: new Date('2026-01-01T13:00:00'),
      numRegistro: 2,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: VALID_HASH,
      esPrimerRegistro: false,
    })
    expect(result.hash).toHaveLength(64)
    expect(result.xml).toContain('<PrimerRegistro>N</PrimerRegistro>')
  })
})

describe('buildBatchFiscalData — startingHash validation', () => {
  it('throws when startingHash is invalid even if inputs is empty', async () => {
    await expect(buildBatchFiscalData([], 'bad-hash')).rejects.toThrow('previousHash')
  })

  it('throws when startingHash is uppercase hex', async () => {
    await expect(buildBatchFiscalData([], 'A'.repeat(64))).rejects.toThrow('lowercase')
  })

  it('accepts empty startingHash with empty inputs', async () => {
    const result = await buildBatchFiscalData([], '')
    expect(result.results).toHaveLength(0)
    expect(result.lastHash).toBe('')
  })
})

describe('serie does not affect fiscal outputs', () => {
  const base: BatchFiscalInput = {
    config,
    numSerie: 'A-2026-000001',
    serie: 'A',
    fecha: new Date('2026-01-01T12:00:00'),
    numRegistro: 1,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
    cuotaTotal: '0.91',
    importeTotal: '10.00',
  }

  it('changing serie leaves hash, xml, and qrUrl identical', async () => {
    const { results: [a] } = await buildBatchFiscalData([{ ...base, serie: 'A' }], '')
    const { results: [b] } = await buildBatchFiscalData([{ ...base, serie: 'X' }], '')

    expect(a!.hash).toBe(b!.hash)
    expect(a!.xml).toBe(b!.xml)
    expect(a!.qrUrl).toBe(b!.qrUrl)
  })
})
