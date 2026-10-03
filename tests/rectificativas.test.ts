import { describe, it, expect } from 'vitest'
import { buildInvoiceRecord } from '../src/index.js'
import type { FiscalInput } from '../src/index.js'

// R1..R4: rectificativa de factura completa (lleva destinatario). R5: rectificativa de simplificada (sin él).
// TipoRectificativa S (sustitución, exige ImporteRectificacion) o I (por diferencias, lo prohíbe).
const base: FiscalInput = {
  config: {
    nif: 'B62215389',
    nombreRazon: 'La Pallaresa',
    softwareNif: 'B62215389',
    softwareNombre: 'EasyFichi',
    softwareVersion: '1.0',
    softwareId: 'EF',
  },
  numSerie: 'R-2026-0001',
  fecha: '2026-10-03',
  fechaHoraGenRegistro: '2026-10-03T12:00:00+02:00',
  tipoFactura: 'R1',
  tipoRectificativa: 'I',
  descripcion: 'Devolución parcial',
  desgloseIva: [{ tipoImpositivo: '21', baseImponible: '-10.00', cuotaRepercutida: '-2.10' }],
  cuotaTotal: '-2.10',
  importeTotal: '-12.10',
  esPrimerRegistro: true,
  destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
  facturasRectificadas: [{ numSerie: 'F-2026-0100', fecha: '2026-09-15' }],
}

describe('Rectificativas R1..R5', () => {
  it('R1 por diferencias: TipoRectificativa + FacturasRectificadas tras TipoFactura, importes negativos', async () => {
    const { xml } = await buildInvoiceRecord(base)
    expect(xml).toContain(
      '<TipoFactura>R1</TipoFactura><TipoRectificativa>I</TipoRectificativa>' +
        '<FacturasRectificadas><IDFacturaRectificada><IDEmisorFactura>B62215389</IDEmisorFactura>' +
        '<NumSerieFactura>F-2026-0100</NumSerieFactura><FechaExpedicionFactura>15-09-2026</FechaExpedicionFactura>' +
        '</IDFacturaRectificada></FacturasRectificadas><DescripcionOperacion>',
    )
    expect(xml).toContain('<ImporteTotal>-12.10</ImporteTotal>')
    expect(xml).not.toContain('ImporteRectificacion')
  })

  it('por sustitución: ImporteRectificacion tras FacturasRectificadas, con recargo opcional', async () => {
    const { xml } = await buildInvoiceRecord({
      ...base,
      tipoFactura: 'R4',
      tipoRectificativa: 'S',
      desgloseIva: [{ tipoImpositivo: '21', baseImponible: '90.00', cuotaRepercutida: '18.90' }],
      cuotaTotal: '18.90',
      importeTotal: '108.90',
      importeRectificacion: { baseRectificada: '100.00', cuotaRectificada: '21.00', cuotaRecargoRectificado: '0.00' },
    })
    expect(xml).toContain(
      '</FacturasRectificadas><ImporteRectificacion><BaseRectificada>100.00</BaseRectificada>' +
        '<CuotaRectificada>21.00</CuotaRectificada><CuotaRecargoRectificado>0.00</CuotaRecargoRectificado>' +
        '</ImporteRectificacion><DescripcionOperacion>',
    )
  })

  it('R5 (rectificativa de simplificada) sin destinatario; con destinatario lanza', async () => {
    const r5 = { ...base, tipoFactura: 'R5' as const, destinatario: undefined }
    const { xml } = await buildInvoiceRecord(r5)
    expect(xml).toContain('<TipoFactura>R5</TipoFactura><TipoRectificativa>I</TipoRectificativa>')
    expect(xml).not.toContain('Destinatarios')
    await expect(buildInvoiceRecord({ ...r5, destinatario: base.destinatario })).rejects.toThrow(
      /R5 must not have destinatario/,
    )
  })

  it('R1..R4 sin destinatario lanza', async () => {
    for (const t of ['R1', 'R2', 'R3', 'R4'] as const) {
      await expect(buildInvoiceRecord({ ...base, tipoFactura: t, destinatario: undefined })).rejects.toThrow(
        new RegExp(`${t} requires destinatario`),
      )
    }
  })

  it('FacturasRectificadas es opcional en el registro', async () => {
    const { xml } = await buildInvoiceRecord({ ...base, facturasRectificadas: undefined })
    expect(xml).toContain('<TipoRectificativa>I</TipoRectificativa><DescripcionOperacion>')
  })

  it('solo TipoFactura entra en la huella (no TipoRectificativa ni las rectificadas)', async () => {
    const a = await buildInvoiceRecord(base)
    const b = await buildInvoiceRecord({ ...base, facturasRectificadas: [{ numSerie: 'X', fecha: '2025-01-01' }] })
    expect(b.hash).toBe(a.hash)
    const r2 = await buildInvoiceRecord({ ...base, tipoFactura: 'R2' })
    expect(r2.hash).not.toBe(a.hash)
  })

  it('validaciones cruzadas', async () => {
    await expect(buildInvoiceRecord({ ...base, tipoRectificativa: undefined })).rejects.toThrow(
      /R1 requires tipoRectificativa/,
    )
    await expect(buildInvoiceRecord({ ...base, tipoRectificativa: 'S' })).rejects.toThrow(
      /tipoRectificativa S requires importeRectificacion/,
    )
    await expect(
      buildInvoiceRecord({ ...base, importeRectificacion: { baseRectificada: '1.00', cuotaRectificada: '0.21' } }),
    ).rejects.toThrow(/importeRectificacion only allowed with tipoRectificativa S/)
    await expect(
      buildInvoiceRecord({
        ...base,
        tipoRectificativa: 'S',
        importeRectificacion: { baseRectificada: '100', cuotaRectificada: '21.00' },
      }),
    ).rejects.toThrow(/Invalid importeRectificacion.baseRectificada/)
    const f1 = { ...base, tipoFactura: 'F1' as const, facturasRectificadas: undefined }
    await expect(buildInvoiceRecord(f1)).rejects.toThrow(/tipoRectificativa only allowed with tipoFactura R1-R5/)
    await expect(
      buildInvoiceRecord({ ...f1, tipoRectificativa: undefined, facturasRectificadas: base.facturasRectificadas }),
    ).rejects.toThrow(/facturasRectificadas only allowed with tipoFactura R1-R5/)
    await expect(
      buildInvoiceRecord({ ...base, facturasRectificadas: [{ numSerie: '', fecha: '2026-01-01' }] }),
    ).rejects.toThrow(/Invalid facturasRectificadas.numSerie/)
  })
})
