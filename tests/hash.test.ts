import { describe, it, expect } from 'vitest'
import { computeHash, buildHashInput } from '../src/hash'

describe('buildHashInput', () => {
  it('concatenates fields without separator in the correct order', () => {
    const input = buildHashInput({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      tipoFactura: 'F2',
      cuotaTotal: '1.05',
      importeTotal: '12.60',
      previousHash: '',
    })
    expect(input).toBe(
      'IDEmisorFactura=B62215389' +
      'NumSerieFactura=A-2026-000001' +
      'FechaExpedicionFactura=26-05-2026' +
      'TipoFactura=F2' +
      'CuotaTotalFactura=1.05' +
      'ImporteTotal=12.60' +
      'Encadenamiento='
    )
  })

  it('includes previousHash when not empty', () => {
    const input = buildHashInput({
      nif: 'B62215389',
      numSerie: 'A-2026-000002',
      fecha: '26-05-2026',
      tipoFactura: 'F2',
      cuotaTotal: '2.10',
      importeTotal: '23.10',
      previousHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
    })
    expect(input).toContain('Encadenamiento=abc123def456abc123def456abc123def456abc123def456abc123def456abcd')
  })
})

describe('computeHash', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await computeHash('test input')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same input produces same hash', async () => {
    const h1 = await computeHash('IDEmisorFactura=B62215389NumSerieFactura=A-2026-000001')
    const h2 = await computeHash('IDEmisorFactura=B62215389NumSerieFactura=A-2026-000001')
    expect(h1).toBe(h2)
  })

  it('different inputs produce different hashes', async () => {
    const h1 = await computeHash('input-a')
    const h2 = await computeHash('input-b')
    expect(h1).not.toBe(h2)
  })
})
