import { describe, it, expect } from 'vitest'
import { buildQrUrl } from '../src/qr'

describe('buildQrUrl', () => {
  it('builds the correct AEAT verification URL', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
    })
    expect(url).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389' +
      '&numserie=A-2026-000001' +
      '&fecha=26-05-2026' +
      '&importe=12.60'
    )
  })

  it('encodes special characters in URL params', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A 2026 001',
      fecha: '26-05-2026',
      importeTotal: '5.00',
    })
    expect(url).toContain('numserie=A+2026+001')
  })
})
