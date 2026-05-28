import { describe, it, expect } from 'vitest'
import { buildBatchFiscalData } from '../src/index'
import type { BatchFiscalInput, VerifactuConfig } from '../src/index'

const config: VerifactuConfig = {
  nif: 'B12345678',
  nombreRazon: 'Test Restauració S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'test-sw',
  softwareVersion: '1.0',
  softwareId: 'TEST-001',
}

const ticket1: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000001',
  serie: 'A',
  fecha: new Date('2026-01-01T10:00:00'),
  numRegistro: 1,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
  cuotaTotal: '1.15',
  importeTotal: '12.60',
}

const ticket2: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000002',
  serie: 'A',
  fecha: new Date('2026-01-01T11:00:00'),
  numRegistro: 2,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '7.64', cuotaRepercutida: '0.76' }],
  cuotaTotal: '0.76',
  importeTotal: '8.40',
}

const ticket3: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000003',
  serie: 'A',
  fecha: new Date('2026-01-01T12:00:00'),
  numRegistro: 3,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '20.09', cuotaRepercutida: '2.01' }],
  cuotaTotal: '2.01',
  importeTotal: '22.10',
}

describe('buildBatchFiscalData', () => {
  it('returns empty results with unchanged lastHash when inputs is empty', async () => {
    const result = await buildBatchFiscalData([], 'a'.repeat(64))
    expect(result.results).toHaveLength(0)
    expect(result.lastHash).toBe('a'.repeat(64))
  })

  it('returns empty results with unchanged empty startingHash when inputs is empty', async () => {
    const result = await buildBatchFiscalData([], '')
    expect(result.results).toHaveLength(0)
    expect(result.lastHash).toBe('')
  })

  it('marks first ticket as primer registro when startingHash is empty string', async () => {
    const result = await buildBatchFiscalData([ticket1], '')
    expect(result.results[0]!.xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
  })

  it('does not mark first ticket as primer registro when startingHash is non-empty', async () => {
    const prevHash = 'b'.repeat(64)
    const result = await buildBatchFiscalData([ticket1], prevHash)
    expect(result.results[0]!.xml).toContain('<PrimerRegistro>N</PrimerRegistro>')
    expect(result.results[0]!.xml).toContain(`<Huella>${prevHash}</Huella>`)
  })

  it('chains hashes correctly across 3 tickets and sets lastHash to last result hash', async () => {
    const result = await buildBatchFiscalData([ticket1, ticket2, ticket3], '')

    expect(result.results).toHaveLength(3)
    expect(result.lastHash).toBe(result.results[2]!.hash)
    // ticket 2 references ticket 1's hash
    expect(result.results[1]!.xml).toContain(`<Huella>${result.results[0]!.hash}</Huella>`)
    // ticket 3 references ticket 2's hash
    expect(result.results[2]!.xml).toContain(`<Huella>${result.results[1]!.hash}</Huella>`)
  })
})
