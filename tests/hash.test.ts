import { describe, it, expect } from 'vitest'
import { buildAltaHashInput, buildAnulacionHashInput, computeHash } from '../src/hash.js'

// Vectores oficiales: doc AEAT "Detalle de las especificaciones técnicas para generación
// de la huella o hash de los registros de facturación" v0.1.2 (27/08/2024), §6.
describe('vectores oficiales AEAT', () => {
  it('caso 1 — primer registro de alta', async () => {
    const input = buildAltaHashInput({
      idEmisorFactura: '89890001K',
      numSerieFactura: '12345678/G33',
      fechaExpedicionFactura: '01-01-2024',
      tipoFactura: 'F1',
      cuotaTotal: '12.35',
      importeTotal: '123.45',
      huellaAnterior: '',
      fechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    })
    expect(input).toBe(
      'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00',
    )
    expect(await computeHash(input)).toBe(
      '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
    )
  })

  it('caso 2 — registro de alta encadenado', async () => {
    const input = buildAltaHashInput({
      idEmisorFactura: '89890001K',
      numSerieFactura: '12345679/G34',
      fechaExpedicionFactura: '01-01-2024',
      tipoFactura: 'F1',
      cuotaTotal: '12.35',
      importeTotal: '123.45',
      huellaAnterior: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
      fechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
    })
    expect(await computeHash(input)).toBe(
      'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
    )
  })

  it('caso 3 — registro de anulación encadenado', async () => {
    const input = buildAnulacionHashInput({
      idEmisorFacturaAnulada: '89890001K',
      numSerieFacturaAnulada: '12345679/G34',
      fechaExpedicionFacturaAnulada: '01-01-2024',
      huellaAnterior: 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
      fechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
    })
    expect(input).toBe(
      'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00',
    )
    expect(await computeHash(input)).toBe(
      '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68',
    )
  })
})

describe('formato de la cadena de entrada', () => {
  it('aplica trim a los valores (doc AEAT §3)', () => {
    const input = buildAltaHashInput({
      idEmisorFactura: ' 89890001K ',
      numSerieFactura: '   12345678 / G33  ',
      fechaExpedicionFactura: '01-01-2024',
      tipoFactura: 'F1',
      cuotaTotal: '12.35',
      importeTotal: '123.45',
      huellaAnterior: '',
      fechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    })
    expect(input).toContain('IDEmisorFactura=89890001K&')
    // trim solo en extremos — los espacios interiores se conservan
    expect(input).toContain('NumSerieFactura=12345678 / G33&')
  })

  it('campo vacío → Nombre= sin valor', () => {
    const input = buildAltaHashInput({
      idEmisorFactura: '89890001K',
      numSerieFactura: 'A-1',
      fechaExpedicionFactura: '01-01-2026',
      tipoFactura: 'F2',
      cuotaTotal: '1.05',
      importeTotal: '12.60',
      huellaAnterior: '',
      fechaHoraHusoGenRegistro: '2026-01-01T10:00:00+01:00',
    })
    expect(input).toContain('&Huella=&FechaHoraHusoGenRegistro=')
  })

  it('la salida es hex MAYÚSCULAS de 64 caracteres', async () => {
    const hash = await computeHash('test')
    expect(hash).toMatch(/^[0-9A-F]{64}$/)
  })
})
