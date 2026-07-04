import { describe, it, expect } from 'vitest'
import { buildInvoiceRecord, buildAnulacionRecord } from '../src/index.js'
import type { FiscalInput, VerifactuConfig } from '../src/index.js'

// GOLDEN TESTS — si alguno falla, el artefacto fiscal ha cambiado: es un breaking change
// que requiere major bump y coordinación con TODOS los consumidores (pallaresa-tpv, EasyFichi).

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'Granja-Xocolateria La Pallaresa',
  softwareNif: 'B00000000',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '2.0.0',
  softwareId: 'PT',
  testMode: true,
}

const f2Input: FiscalInput = {
  config,
  numSerie: 'A-2026-000001',
  fecha: new Date(2026, 5, 15),
  fechaHoraGenRegistro: '2026-06-15T12:00:00+02:00',
  descripcion: 'Venda de productes',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
  cuotaTotal: '1.15',
  importeTotal: '12.60',
  esPrimerRegistro: true,
}

describe('goldens v2.0.0', () => {
  it('F2 primer registro — hash estable', async () => {
    const { hash } = await buildInvoiceRecord(f2Input)
    expect(hash).toBe('3D37E941387F404905FBCE1F51F914FDD58A1964CDAB5BB2C6970D36828A5288')
  })

  it('F1 encadenado — hash estable', async () => {
    const first = await buildInvoiceRecord(f2Input)
    const { hash, xml } = await buildInvoiceRecord({
      ...f2Input,
      numSerie: 'A-2026-000002',
      fechaHoraGenRegistro: '2026-06-15T12:05:00+02:00',
      esPrimerRegistro: false,
      registroAnterior: { numSerie: 'A-2026-000001', fecha: new Date(2026, 5, 15), huella: first.hash },
      destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
    })
    expect(hash).toBe('5541B02E8130D3DD337C94F1E1D152CC88D0D6E005F3E7D353588E96115BFFC2')
    expect(xml).toContain('<TipoFactura>F1</TipoFactura>')
  })

  it('anulación encadenada — hash estable', async () => {
    const first = await buildInvoiceRecord(f2Input)
    const { hash } = await buildAnulacionRecord({
      config,
      numSerieAnulada: 'A-2026-000001',
      fechaAnulada: new Date(2026, 5, 15),
      fechaHoraGenRegistro: '2026-06-15T12:10:00+02:00',
      esPrimerRegistro: false,
      registroAnterior: { numSerie: 'A-2026-000001', fecha: new Date(2026, 5, 15), huella: first.hash },
    })
    expect(hash).toBe('86D55B172553856494295A6ABE0EF6A323F58C52EE006DFF6471F96FBA51E035')
  })

  it('QR estable', async () => {
    const { qrUrl } = await buildInvoiceRecord(f2Input)
    expect(qrUrl).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=B62215389&numserie=A-2026-000001&fecha=15-06-2026&importe=12.60',
    )
  })
})
