import { describe, it, expect } from 'vitest'
import { buildTicketXml } from '../src/xml'
import type { XmlInput } from '../src/xml'

const baseInput: XmlInput = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa, S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '1.0',
  softwareId: 'TPV-PAL-001',
  numSerie: 'A-2026-000001',
  fecha: '26-05-2026',
  fechaHora: '2026-05-26T10:30:00+02:00',
  numRegistro: 1,
  tipoFactura: 'F2',
  descripcion: 'Venda de productes',
  desgloseIva: [
    { tipoImpositivo: '10.00', baseImponible: '10.50', cuotaRepercutida: '1.05' },
  ],
  cuotaTotal: '1.05',
  importeTotal: '11.55',
  previousHash: '',
  hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abcd',
  esPrimerRegistro: true,
}

describe('buildTicketXml', () => {
  it('returns a string with the root element', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<RegistroFacturacion>')
    expect(xml).toContain('</RegistroFacturacion>')
  })

  it('includes the NIF and ticket number', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<IDEmisorFactura>B62215389</IDEmisorFactura>')
    expect(xml).toContain('<NumSerieFactura>A-2026-000001</NumSerieFactura>')
  })

  it('includes the hash as HuellaRegistro', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<HuellaRegistro>abc123def456abc123def456abc123def456abc123def456abc123def456abcd</HuellaRegistro>')
  })

  it('uses PrimerRegistro=S when esPrimerRegistro is true', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
  })

  it('uses PrimerRegistro=N and includes previous hash when not first', () => {
    const xml = buildTicketXml({
      ...baseInput,
      esPrimerRegistro: false,
      previousHash: 'prev123prev123prev123prev123prev123prev123prev123prev123prev12345',
    })
    expect(xml).toContain('<PrimerRegistro>N</PrimerRegistro>')
    expect(xml).toContain('<Huella>prev123prev123prev123prev123prev123prev123prev123prev123prev12345</Huella>')
  })

  it('includes IVA breakdown', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<TipoImpositivo>10.00</TipoImpositivo>')
    expect(xml).toContain('<BaseImponibleOimporteNoSujeto>10.50</BaseImponibleOimporteNoSujeto>')
    expect(xml).toContain('<CuotaRepercutida>1.05</CuotaRepercutida>')
  })

  it('includes ImporteTotal and CuotaTotal', () => {
    const xml = buildTicketXml(baseInput)
    expect(xml).toContain('<ImporteTotal>11.55</ImporteTotal>')
    expect(xml).toContain('<CuotaTotal>1.05</CuotaTotal>')
  })

  it('escapes & in nombreRazon', () => {
    const xml = buildTicketXml({ ...baseInput, nombreRazon: 'Bar & Cafè S.L.' })
    expect(xml).toContain('<NombreRazonEmisor>Bar &amp; Cafè S.L.</NombreRazonEmisor>')
    expect(xml).not.toContain('<NombreRazonEmisor>Bar & Cafè S.L.</NombreRazonEmisor>')
  })

  it('escapes < and > in descripcion', () => {
    const xml = buildTicketXml({ ...baseInput, descripcion: 'Menú < 10€ > estiu' })
    expect(xml).toContain('<DescripcionOperacion>Menú &lt; 10€ &gt; estiu</DescripcionOperacion>')
  })

  it('escapes double quotes and apostrophes in text fields', () => {
    const xml = buildTicketXml({
      ...baseInput,
      nombreRazon: 'Bar "Test" & Cafè \'S.L.\'',
    })
    expect(xml).toContain('&quot;Test&quot;')
    expect(xml).toContain('&apos;S.L.&apos;')
    expect(xml).toContain('&amp;')
  })
})
