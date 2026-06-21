/**
 * Golden tests — fixed input must always produce the exact same fiscal artifacts.
 * Any change in hash, XML structure, or QR URL that affects these tests is a
 * FISCAL CHANGE and must be treated as a breaking change (bump major version).
 *
 * Note: FechaHoraHusoHorarioSistema depends on the runtime timezone, so the full
 * XML is not asserted here. Hash and qrUrl are fully timezone-independent.
 */
import { describe, it, expect } from 'vitest'
import { buildTicketFiscalData, buildBatchFiscalData } from '../src/index'
import type { VerifactuConfig } from '../src/index'

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa, S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'Pallaresa TPV',
  softwareVersion: '1.0',
  softwareId: 'PALLARESA-TPV-1',
  testMode: false,
}

const GOLDEN_HASH_1 = 'af6861d67d78c56f5dfdc54eb377ead606d0202d410230046ed976036b826cdf'
const GOLDEN_HASH_2 = '3ba4849105fd31e5ad2b9d026b3be685c8c8281d2e73f1cfd45402b546b10f79'

describe('golden — single ticket', () => {
  it('produces the exact expected hash for a known first invoice', async () => {
    const { hash } = await buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date(2026, 0, 1, 12, 0, 0),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: '', esPrimerRegistro: true,
    })
    expect(hash).toBe(GOLDEN_HASH_1)
  })

  it('produces the exact expected qrUrl (prod)', async () => {
    const { qrUrl } = await buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date(2026, 0, 1, 12, 0, 0),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: '', esPrimerRegistro: true,
    })
    expect(qrUrl).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389&numserie=A-2026-000001&fecha=01-01-2026&importe=10.00',
    )
  })

  it('XML contains all expected fiscal fields (timezone-independent parts)', async () => {
    const { xml, hash } = await buildTicketFiscalData({
      config,
      numSerie: 'A-2026-000001', serie: 'A',
      fecha: new Date(2026, 0, 1, 12, 0, 0),
      numRegistro: 1,
      desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
      cuotaTotal: '0.91', importeTotal: '10.00',
      previousHash: '', esPrimerRegistro: true,
    })
    expect(xml).toContain(`<HuellaRegistro>${hash}</HuellaRegistro>`)
    expect(xml).toContain('<IDEmisorFactura>B62215389</IDEmisorFactura>')
    expect(xml).toContain('<NumSerieFactura>A-2026-000001</NumSerieFactura>')
    expect(xml).toContain('<FechaExpedicionFactura>01-01-2026</FechaExpedicionFactura>')
    expect(xml).toContain('<TipoFactura>F2</TipoFactura>')
    expect(xml).toContain('<NombreRazonEmisor>La Pallaresa, S.L.</NombreRazonEmisor>')
    expect(xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
    expect(xml).toContain('<CuotaTotal>0.91</CuotaTotal>')
    expect(xml).toContain('<ImporteTotal>10.00</ImporteTotal>')
    expect(xml).toContain('<IDVersion>1.0</IDVersion>')
  })
})

const GOLDEN_HASH_F1 = '81cc57f1429ece098c6e9f326bb21cb6c63c8df4974012b8d775fad434f113d3'

describe('golden — F1 invoice (B2B con destinatario)', () => {
  const f1Input = {
    config,
    numSerie: 'A-2026-000001', serie: 'A',
    fecha: new Date(2026, 0, 1, 12, 0, 0),
    numRegistro: 1,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
    cuotaTotal: '0.91', importeTotal: '10.00',
    previousHash: '', esPrimerRegistro: true,
    destinatario: { nif: 'B12345678', nombre: 'Empresa Cliente S.L.' },
  }

  it('produces a deterministic F1 hash distinct from the equivalent F2 hash', async () => {
    const { hash } = await buildTicketFiscalData(f1Input)
    expect(hash).toBe(GOLDEN_HASH_F1)
    expect(hash).not.toBe(GOLDEN_HASH_1)
  })

  it('F1 XML contains TipoFactura F1 and Destinatarios block', async () => {
    const { xml, hash } = await buildTicketFiscalData(f1Input)
    expect(xml).toContain('<TipoFactura>F1</TipoFactura>')
    expect(xml).toContain('<Destinatarios><IDDestinatario><NombreRazon>Empresa Cliente S.L.</NombreRazon><NIF>B12345678</NIF></IDDestinatario></Destinatarios>')
    expect(xml).toContain(`<HuellaRegistro>${hash}</HuellaRegistro>`)
    expect(xml).not.toContain('<TipoFactura>F2</TipoFactura>')
  })

  it('F1 qrUrl is identical to F2 for the same invoice data (QR is type-independent)', async () => {
    const { qrUrl } = await buildTicketFiscalData(f1Input)
    expect(qrUrl).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389&numserie=A-2026-000001&fecha=01-01-2026&importe=10.00',
    )
  })
})

describe('golden — batch chain', () => {
  it('produces stable hashes for a 2-ticket chained batch', async () => {
    const { results, lastHash } = await buildBatchFiscalData([
      {
        config,
        numSerie: 'A-2026-000001', serie: 'A',
        fecha: new Date(2026, 0, 1, 12, 0, 0),
        numRegistro: 1,
        desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
        cuotaTotal: '0.91', importeTotal: '10.00',
      },
      {
        config,
        numSerie: 'A-2026-000002', serie: 'A',
        fecha: new Date(2026, 0, 1, 13, 0, 0),
        numRegistro: 2,
        desgloseIva: [{ tipoImpositivo: '10', baseImponible: '4.55', cuotaRepercutida: '0.45' }],
        cuotaTotal: '0.45', importeTotal: '5.00',
      },
    ], '')

    expect(results[0]!.hash).toBe(GOLDEN_HASH_1)
    expect(results[1]!.hash).toBe(GOLDEN_HASH_2)
    expect(lastHash).toBe(GOLDEN_HASH_2)
    // ticket 2 references ticket 1's hash in the chain
    expect(results[1]!.xml).toContain(`<Huella>${GOLDEN_HASH_1}</Huella>`)
  })
})
