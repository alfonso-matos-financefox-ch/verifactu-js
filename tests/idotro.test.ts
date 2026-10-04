import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildInvoiceRecord,
  buildBatchInvoiceRecords,
  CODIGOS_PAIS_XSD,
  DestinatarioError,
} from '../src/index.js'
import type { Destinatario, FiscalInput, IDOtro, VerifactuConfig } from '../src/index.js'

// v2.4.0 — destinatario sin NIF español (bloque IDOtro). Reglas AEAT: «Sistemas Informáticos de
// Facturación y Sistemas VERI*FACTU – Validaciones» v1.2.2, ap. 13 + nota (1); códigos de errores.properties.

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'Granja-Xocolateria La Pallaresa',
  softwareNif: 'B00000000',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '2.0.0',
  softwareId: 'PT',
  testMode: true,
}

const base: FiscalInput = {
  config,
  numSerie: 'A-2026-000002',
  fecha: '2026-06-15',
  fechaHoraGenRegistro: '2026-06-15T12:05:00+02:00',
  descripcion: 'Servei de restauració',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '100.00', cuotaRepercutida: '10.00' }],
  cuotaTotal: '10.00',
  importeTotal: '110.00',
  esPrimerRegistro: true,
  destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
}

const conIdOtro = (idOtro: IDOtro, extra: Partial<FiscalInput> = {}): FiscalInput => ({
  ...base,
  ...extra,
  destinatario: { nombre: 'Client étranger', idOtro },
})

async function codigoDe(input: FiscalInput): Promise<string> {
  try {
    await buildInvoiceRecord(input)
  } catch (err) {
    expect(err).toBeInstanceOf(DestinatarioError)
    return (err as DestinatarioError).code
  }
  throw new Error('expected DestinatarioError')
}

describe('IDOtro — XML', () => {
  it('genera IDOtro en el orden del XSD (CodigoPais → IDType → ID) tras NombreRazon', async () => {
    const { xml } = await buildInvoiceRecord(conIdOtro({ codigoPais: 'HK', idType: '04', id: '2345678' }))
    expect(xml).toContain(
      '<Destinatarios><IDDestinatario><NombreRazon>Client étranger</NombreRazon>' +
        '<IDOtro><CodigoPais>HK</CodigoPais><IDType>04</IDType><ID>2345678</ID></IDOtro>' +
        '</IDDestinatario></Destinatarios>',
    )
    expect(xml).not.toMatch(/<IDDestinatario>(?:(?!<\/IDDestinatario>).)*<NIF>/)
  })

  it('el caso NIF genera exactamente lo mismo que v2.3.0', async () => {
    const { xml } = await buildInvoiceRecord(base)
    expect(xml).toContain(
      '<Destinatarios><IDDestinatario><NombreRazon>Cliente SL</NombreRazon><NIF>B11111111</NIF></IDDestinatario></Destinatarios>',
    )
    expect(xml).not.toContain('IDOtro')
  })

  it('escapa caracteres especiales del ID', async () => {
    const { xml } = await buildInvoiceRecord(conIdOtro({ codigoPais: 'HK', idType: '06', id: 'A&B<1>' }))
    expect(xml).toContain('<ID>A&amp;B&lt;1&gt;</ID>')
  })

  it('el lote propaga el destinatario IDOtro', async () => {
    const { results } = await buildBatchInvoiceRecords(
      [
        { ...base, destinatario: { nombre: 'G2 Travel Ltd', idOtro: { codigoPais: 'HK', idType: '04', id: '2345678' } } },
        { ...base, numSerie: 'A-2026-000003' },
      ],
      null,
    )
    expect(results[0]!.xml).toContain('<IDOtro><CodigoPais>HK</CodigoPais>')
    expect(results[1]!.xml).toContain('<NIF>B11111111</NIF>')
  })
})

describe('IDOtro — huella y QR no dependen del destinatario', () => {
  const destinatarios: Destinatario[] = [
    { nif: 'B11111111', nombre: 'Cliente SL' },
    { nombre: 'Client FR', idOtro: { codigoPais: 'FR', idType: '02', id: 'FR40303265045' } },
    { nombre: 'G2 Travel Ltd', idOtro: { codigoPais: 'HK', idType: '04', id: '2345678' } },
    { nombre: 'Client SIRET', idOtro: { codigoPais: 'FR', idType: '06', id: '73282932000074' } },
  ]

  it('misma huella y mismo QR con NIF o con IDOtro (F1)', async () => {
    const out = await Promise.all(destinatarios.map(destinatario => buildInvoiceRecord({ ...base, destinatario })))
    expect(new Set(out.map(o => o.hash)).size).toBe(1)
    expect(new Set(out.map(o => o.qrUrl)).size).toBe(1)
  })

  it('misma huella con NIF o con IDOtro (F3 y R1/I)', async () => {
    const f3 = { tipoFactura: 'F3', facturasSustituidas: [{ numSerie: 'T-1', fecha: '2026-06-14' }] } as const
    const r1 = { tipoFactura: 'R1', tipoRectificativa: 'I' } as const
    for (const extra of [f3, r1]) {
      const [a, b] = await Promise.all(
        [destinatarios[0]!, destinatarios[2]!].map(destinatario => buildInvoiceRecord({ ...base, ...extra, destinatario })),
      )
      expect(a!.hash).toBe(b!.hash)
      expect(a!.qrUrl).toBe(b!.qrUrl)
    }
  })
})

describe('IDOtro — validación del tipo (DestinatarioError)', () => {
  it('nif e idOtro a la vez → NIF_E_IDOTRO', async () => {
    const destinatario = { nombre: 'X', nif: 'B11111111', idOtro: { codigoPais: 'FR', idType: '04', id: '1' } }
    expect(await codigoDe({ ...base, destinatario: destinatario as unknown as Destinatario })).toBe('NIF_E_IDOTRO')
  })

  it('ni nif ni idOtro → SIN_IDENTIFICACION', async () => {
    expect(await codigoDe({ ...base, destinatario: { nombre: 'X' } as unknown as Destinatario })).toBe('SIN_IDENTIFICACION')
  })

  it('el mensaje es claro', async () => {
    await expect(buildInvoiceRecord({ ...base, destinatario: { nombre: 'X' } as unknown as Destinatario })).rejects.toThrow(
      /Invalid destinatario: requires nif \(Spanish NIF\) or idOtro/,
    )
  })

  it('codigoPais fuera de CountryType2 → CODIGO_PAIS (minúsculas, EL, XI, vacío)', async () => {
    for (const codigoPais of ['fr', 'EL', 'XI', '', 'FRA']) {
      expect(await codigoDe(conIdOtro({ codigoPais, idType: '04', id: '1' }))).toBe('CODIGO_PAIS')
    }
  })

  it('idType fuera de 02..07 → ID_TYPE', async () => {
    for (const idType of ['01', '08', '4', '']) {
      expect(await codigoDe(conIdOtro({ codigoPais: 'HK', idType: idType as IDOtro['idType'], id: '1' }))).toBe('ID_TYPE')
    }
  })

  it('id vacío o > 20 caracteres → ID', async () => {
    expect(await codigoDe(conIdOtro({ codigoPais: 'HK', idType: '04', id: '' }))).toBe('ID')
    expect(await codigoDe(conIdOtro({ codigoPais: 'HK', idType: '04', id: 'X'.repeat(21) }))).toBe('ID')
  })

  it('nombre vacío o > 120 caracteres con IDOtro → NOMBRE', async () => {
    const idOtro: IDOtro = { codigoPais: 'HK', idType: '04', id: '1' }
    expect(await codigoDe({ ...base, destinatario: { nombre: ' ', idOtro } })).toBe('NOMBRE')
    expect(await codigoDe({ ...base, destinatario: { nombre: 'N'.repeat(121), idOtro } })).toBe('NOMBRE')
  })
})

describe('IDOtro — combinaciones AEAT', () => {
  it('ES solo con 03 o 07 (1234/1126)', async () => {
    for (const idType of ['02', '04', '05', '06'] as const) {
      expect(await codigoDe(conIdOtro({ codigoPais: 'ES', idType, id: 'ESB11111111' }))).toBe('COMBINACION')
    }
    await expect(buildInvoiceRecord(conIdOtro({ codigoPais: 'ES', idType: '03', id: 'PAA123456' }))).resolves.toBeDefined()
  })

  it('07 exige ES (1126) y NIF de persona física válido (1131)', async () => {
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '07', id: '12345678Z' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'ES', idType: '07', id: '12345678A' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'ES', idType: '07', id: 'B11111111' }))).toBe('COMBINACION')
    await expect(buildInvoiceRecord(conIdOtro({ codigoPais: 'ES', idType: '07', id: '12345678Z' }))).resolves.toBeDefined()
    await expect(buildInvoiceRecord(conIdOtro({ codigoPais: 'ES', idType: '07', id: 'X1234567L' }))).resolves.toBeDefined()
  })

  it('02 fuera de la UE → COMBINACION (HK, US, GB, CH)', async () => {
    for (const codigoPais of ['HK', 'US', 'GB', 'CH']) {
      expect(await codigoDe(conIdOtro({ codigoPais, idType: '02', id: `${codigoPais}123456789` }))).toBe('COMBINACION')
    }
  })

  it('02 exige prefijo = CodigoPais (1122) y estructura NIF-IVA del Estado miembro (nota 1)', async () => {
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '02', id: '40303265045' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '02', id: 'DE123456789' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '02', id: 'fr40303265045' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '02', id: 'FR4030326504' }))).toBe('COMBINACION')
    expect(await codigoDe(conIdOtro({ codigoPais: 'DE', idType: '02', id: 'DE12345678X' }))).toBe('COMBINACION')
    for (const idOtro of [
      { codigoPais: 'FR', idType: '02', id: 'FR40303265045' },
      { codigoPais: 'FR', idType: '02', id: 'FRXX303265045' },
      { codigoPais: 'DE', idType: '02', id: 'DE123456789' },
      { codigoPais: 'GR', idType: '02', id: 'EL123456789' },
      { codigoPais: 'RO', idType: '02', id: 'RO18547290' },
    ] as const) {
      await expect(buildInvoiceRecord(conIdOtro(idOtro))).resolves.toBeDefined()
    }
  })

  it('R3 solo admite 07 en IDOtro (1191); R2 solo 02 o 07 (1192)', async () => {
    const r = (tipoFactura: 'R2' | 'R3') => ({ tipoFactura, tipoRectificativa: 'I' }) as const
    expect(await codigoDe(conIdOtro({ codigoPais: 'HK', idType: '04', id: '1' }, r('R3')))).toBe('TIPO_FACTURA')
    expect(await codigoDe(conIdOtro({ codigoPais: 'FR', idType: '02', id: 'FR40303265045' }, r('R3')))).toBe('TIPO_FACTURA')
    expect(await codigoDe(conIdOtro({ codigoPais: 'HK', idType: '04', id: '1' }, r('R2')))).toBe('TIPO_FACTURA')
    await expect(
      buildInvoiceRecord(conIdOtro({ codigoPais: 'FR', idType: '02', id: 'FR40303265045' }, r('R2'))),
    ).resolves.toBeDefined()
    await expect(buildInvoiceRecord(conIdOtro({ codigoPais: 'ES', idType: '07', id: '12345678Z' }, r('R3')))).resolves.toBeDefined()
    await expect(buildInvoiceRecord({ ...base, ...r('R3') })).resolves.toBeDefined()
  })
})

describe('CODIGOS_PAIS_XSD', () => {
  it('coincide exactamente con CountryType2 de SuministroInformacion.xsd', () => {
    const xsd = readFileSync(join(__dirname, 'schemas', 'SuministroInformacion.xsd'), 'utf8')
    const bloque = xsd.slice(xsd.indexOf('name="CountryType2"'))
    const fin = bloque.indexOf('</simpleType>')
    const codigos = [...bloque.slice(0, fin).matchAll(/value="([A-Z]{2})"/g)].map(m => m[1])
    expect(codigos.length).toBe(246)
    expect([...CODIGOS_PAIS_XSD].sort()).toEqual([...new Set(codigos)].sort())
  })
})
