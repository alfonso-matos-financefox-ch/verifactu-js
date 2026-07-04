import { describe, it, expect } from 'vitest'
import { buildInvoiceRecord, centsToImporte } from '../src/index.js'
import type { FiscalInput, VerifactuConfig } from '../src/index.js'

const HUELLA = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa',
  softwareNif: 'B00000000',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '2.0.0',
  softwareId: 'PT',
  testMode: true,
}

const base: FiscalInput = {
  config,
  numSerie: 'A-2026-000002',
  fecha: new Date(2026, 5, 15),
  fechaHoraGenRegistro: '2026-06-15T12:00:00+02:00',
  descripcion: 'Venda de productes',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
  cuotaTotal: '1.15',
  importeTotal: '12.60',
  esPrimerRegistro: false,
  registroAnterior: {
    numSerie: 'A-2026-000001',
    fecha: new Date(2026, 5, 14),
    huella: HUELLA,
  },
}

describe('validación de encadenamiento', () => {
  it('primer registro con registroAnterior → error', async () => {
    await expect(
      buildInvoiceRecord({ ...base, esPrimerRegistro: true }),
    ).rejects.toThrow(/first record must not have registroAnterior/)
  })

  it('registro no-primero sin registroAnterior → error', async () => {
    const { registroAnterior: _drop, ...rest } = base
    await expect(
      buildInvoiceRecord({ ...rest, esPrimerRegistro: false }),
    ).rejects.toThrow(/requires registroAnterior/)
  })

  it('huella anterior en minúsculas → error (formato oficial: MAYÚSCULAS)', async () => {
    await expect(
      buildInvoiceRecord({
        ...base,
        registroAnterior: { ...base.registroAnterior!, huella: HUELLA.toLowerCase() },
      }),
    ).rejects.toThrow(/uppercase 64-char hex/)
  })

  it('primer registro válido sin registroAnterior', async () => {
    const { registroAnterior: _drop, ...rest } = base
    const data = await buildInvoiceRecord({ ...rest, esPrimerRegistro: true })
    expect(data.hash).toMatch(/^[0-9A-F]{64}$/)
    expect(data.xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
  })
})

describe('validación de importes en frontera', () => {
  it.each([
    ['12.6', 'un decimal'],
    ['12,60', 'coma decimal'],
    ['12', 'sin decimales'],
    ['', 'vacío'],
  ])("importeTotal '%s' (%s) → error", async importeTotal => {
    await expect(buildInvoiceRecord({ ...base, importeTotal })).rejects.toThrow(/Invalid importeTotal/)
  })

  it('importes negativos válidos (rectificativas futuras)', async () => {
    const data = await buildInvoiceRecord({ ...base, importeTotal: '-12.60', cuotaTotal: '-1.15' })
    expect(data.hash).toMatch(/^[0-9A-F]{64}$/)
  })

  it('tipoImpositivo no numérico → error', async () => {
    await expect(
      buildInvoiceRecord({
        ...base,
        desgloseIva: [{ tipoImpositivo: 'diez', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
      }),
    ).rejects.toThrow(/tipoImpositivo/)
  })
})

describe('validación de config e input', () => {
  it('softwareId de más de 2 caracteres → error (XSD TextMax2Type)', async () => {
    await expect(
      buildInvoiceRecord({ ...base, config: { ...config, softwareId: 'PALLARESA-TPV-1' } }),
    ).rejects.toThrow(/2 characters/)
  })

  it('tipoFactura F1 sin destinatario → error', async () => {
    await expect(buildInvoiceRecord({ ...base, tipoFactura: 'F1' })).rejects.toThrow(/requires destinatario/)
  })

  it('tipoFactura F2 con destinatario → error', async () => {
    await expect(
      buildInvoiceRecord({
        ...base,
        tipoFactura: 'F2',
        destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
      }),
    ).rejects.toThrow(/must not have destinatario/)
  })

  it('inferencia: destinatario → F1, sin destinatario → F2', async () => {
    const f2 = await buildInvoiceRecord(base)
    expect(f2.xml).toContain('<TipoFactura>F2</TipoFactura>')
    const f1 = await buildInvoiceRecord({
      ...base,
      destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
    })
    expect(f1.xml).toContain('<TipoFactura>F1</TipoFactura>')
    expect(f1.xml).toContain('<Destinatarios>')
  })

  it('fechaHoraGenRegistro string sin huso → error', async () => {
    await expect(
      buildInvoiceRecord({ ...base, fechaHoraGenRegistro: '2026-06-15T12:00:00' }),
    ).rejects.toThrow(/ISO 8601 with offset/)
  })

  it('devuelve fechaHoraGenRegistro para que el cliente la persista', async () => {
    const data = await buildInvoiceRecord(base)
    expect(data.fechaHoraGenRegistro).toBe('2026-06-15T12:00:00+02:00')
  })
})

describe('v2.0.1 — fecha como string y desglose vacío', () => {
  it("acepta fecha 'YYYY-MM-DD' verbatim (sin TZ del runtime)", async () => {
    const data = await buildInvoiceRecord({ ...base, fecha: '2026-06-15' })
    expect(data.xml).toContain('<FechaExpedicionFactura>15-06-2026</FechaExpedicionFactura>')
    expect(data.qrUrl).toContain('fecha=15-06-2026')
  })

  it('rechaza fecha string con formato inválido', async () => {
    await expect(buildInvoiceRecord({ ...base, fecha: '15-06-2026' })).rejects.toThrow(/Invalid fecha/)
  })

  it('fecha string y Date equivalente producen el mismo hash', async () => {
    const a = await buildInvoiceRecord({ ...base, fecha: '2026-06-15' })
    const b = await buildInvoiceRecord({ ...base, fecha: new Date(2026, 5, 15, 12) })
    expect(a.hash).toBe(b.hash)
  })

  it('desgloseIva vacío → error (XSD exige >=1 DetalleDesglose)', async () => {
    await expect(buildInvoiceRecord({ ...base, desgloseIva: [] })).rejects.toThrow(/at least one line/)
  })
})

describe('centsToImporte', () => {
  it.each([
    [1260, '12.60'],
    [5, '0.05'],
    [0, '0.00'],
    [-1260, '-12.60'],
    [123456789, '1234567.89'],
  ])('%i céntimos → %s', (cents, expected) => {
    expect(centsToImporte(cents)).toBe(expected)
  })

  it('rechaza no enteros', () => {
    expect(() => centsToImporte(12.6)).toThrow(/integer cents/)
  })
})
