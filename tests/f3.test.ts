import { describe, it, expect } from 'vitest'
import { buildInvoiceRecord } from '../src/index.js'
import type { FiscalInput } from '../src/index.js'

const base: FiscalInput = {
  config: {
    nif: 'B62215389',
    nombreRazon: 'La Pallaresa',
    softwareNif: 'B62215389',
    softwareNombre: 'EasyFichi',
    softwareVersion: '1.0',
    softwareId: 'EF',
  },
  numSerie: 'C-2026-0001',
  fecha: '2026-10-03',
  fechaHoraGenRegistro: '2026-10-03T12:00:00+02:00',
  tipoFactura: 'F3',
  descripcion: 'Canje de tickets',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '13.05', cuotaRepercutida: '1.30' }],
  cuotaTotal: '1.30',
  importeTotal: '14.35',
  esPrimerRegistro: true,
  destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
  facturasSustituidas: [{ numSerie: '206', fecha: '2023-05-02' }],
}

describe('F3 — sustitución de facturas simplificadas', () => {
  it('emite FacturasSustituidas entre TipoFactura y DescripcionOperacion, con idEmisor por defecto', async () => {
    const { xml } = await buildInvoiceRecord(base)
    expect(xml).toContain(
      '<TipoFactura>F3</TipoFactura><FacturasSustituidas><IDFacturaSustituida>' +
        '<IDEmisorFactura>B62215389</IDEmisorFactura><NumSerieFactura>206</NumSerieFactura>' +
        '<FechaExpedicionFactura>02-05-2023</FechaExpedicionFactura></IDFacturaSustituida>' +
        '</FacturasSustituidas><DescripcionOperacion>',
    )
  })

  it('la lista de sustituidas no entra en la huella (solo TipoFactura)', async () => {
    const a = await buildInvoiceRecord(base)
    const b = await buildInvoiceRecord({ ...base, facturasSustituidas: [{ numSerie: '999', fecha: '2024-01-01' }] })
    expect(a.hash).toBe(b.hash)
    const f1 = await buildInvoiceRecord({ ...base, tipoFactura: 'F1', facturasSustituidas: undefined })
    expect(f1.hash).not.toBe(a.hash)
  })

  it('F3 sin destinatario lanza', async () => {
    await expect(buildInvoiceRecord({ ...base, destinatario: undefined })).rejects.toThrow(/F3 requires destinatario/)
  })

  it('F3 sin facturasSustituidas lanza', async () => {
    await expect(buildInvoiceRecord({ ...base, facturasSustituidas: [] })).rejects.toThrow(/requires facturasSustituidas/)
  })

  it('facturasSustituidas con F1 lanza', async () => {
    await expect(buildInvoiceRecord({ ...base, tipoFactura: 'F1' })).rejects.toThrow(/only allowed with tipoFactura F3/)
  })
})
