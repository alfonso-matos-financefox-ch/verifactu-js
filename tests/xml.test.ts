import { describe, it, expect } from 'vitest'
import {
  buildRegistroAltaXml,
  buildRegistroAnulacionXml,
  wrapForSoap,
  SF_NAMESPACE,
  SFLR_NAMESPACE,
} from '../src/xml.js'
import type { AltaXmlInput } from '../src/xml.js'

const HUELLA = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'

const sistema = {
  nombreRazon: 'FinanceFox',
  nif: 'B00000000',
  nombreSistema: 'pallaresa-tpv',
  id: 'PT',
  version: '2.0.0',
  numeroInstalacion: '1',
}

const baseAlta: AltaXmlInput = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa',
  sistema,
  numSerie: 'A-2026-000001',
  fecha: '15-06-2026',
  fechaHoraGenRegistro: '2026-06-15T12:00:00+02:00',
  tipoFactura: 'F2',
  descripcion: 'Venda de productes',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
  cuotaTotal: '1.15',
  importeTotal: '12.60',
  registroAnterior: null,
  hash: HUELLA,
}

function orderOf(xml: string, elements: string[]): number[] {
  return elements.map(e => {
    const idx = xml.indexOf(`<${e}>`)
    expect(idx, `elemento <${e}> ausente`).toBeGreaterThan(-1)
    return idx
  })
}

describe('buildRegistroAltaXml — conformidad XSD', () => {
  it('raíz <RegistroAlta> con namespace SuministroInformacion', () => {
    const xml = buildRegistroAltaXml(baseAlta)
    expect(xml.startsWith(`<RegistroAlta xmlns="${SF_NAMESPACE}">`)).toBe(true)
    expect(xml.endsWith('</RegistroAlta>')).toBe(true)
  })

  it('secuencia de elementos según el XSD', () => {
    const xml = buildRegistroAltaXml({
      ...baseAlta,
      tipoFactura: 'F1',
      destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
    })
    const positions = orderOf(xml, [
      'IDVersion',
      'IDFactura',
      'NombreRazonEmisor',
      'TipoFactura',
      'DescripcionOperacion',
      'Destinatarios',
      'Desglose',
      'CuotaTotal',
      'ImporteTotal',
      'Encadenamiento',
      'SistemaInformatico',
      'FechaHoraHusoGenRegistro',
      'TipoHuella',
      'Huella',
    ])
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('DetalleDesglose con ClaveRegimen y CalificacionOperacion por defecto (01/S1)', () => {
    const xml = buildRegistroAltaXml(baseAlta)
    expect(xml).toContain(
      '<DetalleDesglose><ClaveRegimen>01</ClaveRegimen><CalificacionOperacion>S1</CalificacionOperacion><TipoImpositivo>10</TipoImpositivo><BaseImponibleOimporteNoSujeto>11.45</BaseImponibleOimporteNoSujeto><CuotaRepercutida>1.15</CuotaRepercutida></DetalleDesglose>',
    )
  })

  it('Encadenamiento es choice: primer registro → solo PrimerRegistro', () => {
    const xml = buildRegistroAltaXml(baseAlta)
    expect(xml).toContain('<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>')
    expect(xml).not.toContain('<RegistroAnterior>')
  })

  it('Encadenamiento es choice: encadenado → solo RegistroAnterior, con datos de la factura ANTERIOR', () => {
    const xml = buildRegistroAltaXml({
      ...baseAlta,
      numSerie: 'A-2026-000002',
      registroAnterior: {
        idEmisor: 'B62215389',
        numSerie: 'A-2026-000001',
        fecha: '14-06-2026',
        huella: HUELLA,
      },
    })
    expect(xml).not.toContain('<PrimerRegistro>')
    expect(xml).toContain(
      `<RegistroAnterior><IDEmisorFactura>B62215389</IDEmisorFactura><NumSerieFactura>A-2026-000001</NumSerieFactura><FechaExpedicionFactura>14-06-2026</FechaExpedicionFactura><Huella>${HUELLA}</Huella></RegistroAnterior>`,
    )
  })

  it('TipoHuella 01 + Huella; sin NumRegistro ni HuellaRegistro ni FechaHoraHusoHorarioSistema', () => {
    const xml = buildRegistroAltaXml(baseAlta)
    expect(xml).toContain(`<TipoHuella>01</TipoHuella><Huella>${HUELLA}</Huella>`)
    expect(xml).not.toContain('<NumRegistro>')
    expect(xml).not.toContain('<HuellaRegistro>')
    expect(xml).not.toContain('FechaHoraHusoHorarioSistema')
    expect(xml).toContain('<FechaHoraHusoGenRegistro>2026-06-15T12:00:00+02:00</FechaHoraHusoGenRegistro>')
  })

  it('escapa caracteres XML en los valores', () => {
    const xml = buildRegistroAltaXml({ ...baseAlta, descripcion: 'Café & <dulces>' })
    expect(xml).toContain('<DescripcionOperacion>Café &amp; &lt;dulces&gt;</DescripcionOperacion>')
  })
})

describe('buildRegistroAnulacionXml', () => {
  it('estructura IDFactura con campos *Anulada y encadenamiento', () => {
    const xml = buildRegistroAnulacionXml({
      nif: 'B62215389',
      sistema,
      numSerieAnulada: 'A-2026-000002',
      fechaAnulada: '15-06-2026',
      fechaHoraGenRegistro: '2026-06-15T13:00:00+02:00',
      registroAnterior: {
        idEmisor: 'B62215389',
        numSerie: 'A-2026-000002',
        fecha: '15-06-2026',
        huella: HUELLA,
      },
      hash: HUELLA,
    })
    expect(xml.startsWith(`<RegistroAnulacion xmlns="${SF_NAMESPACE}">`)).toBe(true)
    expect(xml).toContain('<IDEmisorFacturaAnulada>B62215389</IDEmisorFacturaAnulada>')
    expect(xml).toContain('<NumSerieFacturaAnulada>A-2026-000002</NumSerieFacturaAnulada>')
    expect(xml).toContain('<FechaExpedicionFacturaAnulada>15-06-2026</FechaExpedicionFacturaAnulada>')
    expect(xml).toContain('<TipoHuella>01</TipoHuella>')
  })
})

describe('wrapForSoap', () => {
  it('envelope RegFactuSistemaFacturacion con Cabecera y RegistroFactura', () => {
    const record = buildRegistroAltaXml(baseAlta)
    const soap = wrapForSoap([record], { obligado: { nombreRazon: 'La Pallaresa', nif: 'B62215389' } })
    expect(soap.startsWith(`<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${SFLR_NAMESPACE}" xmlns:sf="${SF_NAMESPACE}">`)).toBe(true)
    expect(soap).toContain(
      '<sfLR:Cabecera><sf:ObligadoEmision><sf:NombreRazon>La Pallaresa</sf:NombreRazon><sf:NIF>B62215389</sf:NIF></sf:ObligadoEmision></sfLR:Cabecera>',
    )
    expect(soap).toContain(`<sfLR:RegistroFactura>${record}</sfLR:RegistroFactura>`)
  })

  it('rechaza batch vacío y batch > 1000', () => {
    const cab = { obligado: { nombreRazon: 'X', nif: 'B62215389' } }
    expect(() => wrapForSoap([], cab)).toThrow(/must not be empty/)
    expect(() => wrapForSoap(Array(1001).fill('<x/>'), cab)).toThrow(/max 1000/)
  })
})

// El bloque SistemaInformatico identifica al PRODUCTOR del software, no al
// software: AEAT, contenido del registro de alta, punto 16 — «los datos
// identificativos del productor del citado sistema informático».
// Hasta la 2.0.1 se rellenaba NombreRazon con el nombre comercial.
describe('SistemaInformatico — productor del software', () => {
  it('softwareNombreRazon va a NombreRazon y softwareNombre a NombreSistemaInformatico', async () => {
    const { buildInvoiceRecord } = await import('../src/index.js')
    const { xml } = await buildInvoiceRecord({
      config: {
        nif: 'B62215389',
        nombreRazon: 'GRANJA I XOCOLATERIA LA PALLARESA, S.L.',
        softwareNif: 'B62215389',
        softwareNombre: 'EasyFichi',
        softwareNombreRazon: 'GRANJA I XOCOLATERIA LA PALLARESA, S.L.',
        softwareVersion: '1.0',
        softwareId: 'EF',
      },
      numSerie: 'F-2027-0001',
      fecha: '2027-03-15',
      descripcion: 'Prestación de servicios',
      desgloseIva: [{ tipoImpositivo: '21', baseImponible: '100.00', cuotaRepercutida: '21.00' }],
      cuotaTotal: '21.00',
      importeTotal: '121.00',
      esPrimerRegistro: true,
    })
    const bloque = xml.match(/<SistemaInformatico>[\s\S]*?<\/SistemaInformatico>/)![0]
    expect(bloque).toContain('<NombreRazon>GRANJA I XOCOLATERIA LA PALLARESA, S.L.</NombreRazon>')
    expect(bloque).toContain('<NombreSistemaInformatico>EasyFichi</NombreSistemaInformatico>')
  })

  it('sin softwareNombreRazon conserva el comportamiento de <= 2.0.1', async () => {
    const { buildInvoiceRecord } = await import('../src/index.js')
    const { xml } = await buildInvoiceRecord({
      config: {
        nif: 'B62215389',
        nombreRazon: 'GRANJA I XOCOLATERIA LA PALLARESA, S.L.',
        softwareNif: 'B62215389',
        softwareNombre: 'EasyFichi',
        softwareVersion: '1.0',
        softwareId: 'EF',
      },
      numSerie: 'F-2027-0001',
      fecha: '2027-03-15',
      descripcion: 'Prestación de servicios',
      desgloseIva: [{ tipoImpositivo: '21', baseImponible: '100.00', cuotaRepercutida: '21.00' }],
      cuotaTotal: '21.00',
      importeTotal: '121.00',
      esPrimerRegistro: true,
    })
    const bloque = xml.match(/<SistemaInformatico>[\s\S]*?<\/SistemaInformatico>/)![0]
    expect(bloque).toContain('<NombreRazon>EasyFichi</NombreRazon>')
  })
})
