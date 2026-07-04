import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildInvoiceRecord, buildAnulacionRecord, wrapForSoap } from '../src/index.js'
import type { FiscalInput, VerifactuConfig } from '../src/index.js'

// Validación contra los XSD oficiales de AEAT (copia en tests/schemas/, descargada 2026-07-04).
// Requiere xmllint (incluido en macOS y en la mayoría de Linux). Si no está, se omite.

const SCHEMAS = join(__dirname, 'schemas')

function hasXmllint(): boolean {
  try {
    execFileSync('xmllint', ['--version'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function validate(xml: string, schema: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'verifactu-xsd-'))
  const file = join(dir, 'doc.xml')
  try {
    writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>${xml}`)
    execFileSync('xmllint', ['--nonet', '--noout', '--schema', join(SCHEMAS, schema), file], {
      stdio: 'pipe',
    })
    return 'valid'
  } catch (err) {
    const e = err as { stderr?: Buffer }
    return e.stderr?.toString() ?? String(err)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa',
  softwareNif: 'B00000000',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '2.0.0',
  softwareId: 'PT',
  testMode: true,
}

const input: FiscalInput = {
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

describe.skipIf(!hasXmllint())('validación XSD oficial AEAT', () => {
  it('RegistroAlta F2 primer registro valida', async () => {
    const { xml } = await buildInvoiceRecord(input)
    expect(validate(xml, 'SuministroInformacion.xsd')).toBe('valid')
  })

  it('RegistroAlta F1 encadenado valida', async () => {
    const first = await buildInvoiceRecord(input)
    const { xml } = await buildInvoiceRecord({
      ...input,
      numSerie: 'A-2026-000002',
      esPrimerRegistro: false,
      registroAnterior: { numSerie: 'A-2026-000001', fecha: new Date(2026, 5, 15), huella: first.hash },
      destinatario: { nif: 'B11111111', nombre: 'Cliente SL' },
    })
    expect(validate(xml, 'SuministroInformacion.xsd')).toBe('valid')
  })

  it('RegistroAnulacion valida', async () => {
    const first = await buildInvoiceRecord(input)
    const { xml } = await buildAnulacionRecord({
      config,
      numSerieAnulada: 'A-2026-000001',
      fechaAnulada: new Date(2026, 5, 15),
      esPrimerRegistro: false,
      registroAnterior: { numSerie: 'A-2026-000001', fecha: new Date(2026, 5, 15), huella: first.hash },
    })
    expect(validate(xml, 'SuministroInformacion.xsd')).toBe('valid')
  })

  it('envelope wrapForSoap valida contra SuministroLR.xsd', async () => {
    const a = await buildInvoiceRecord(input)
    const b = await buildInvoiceRecord({
      ...input,
      numSerie: 'A-2026-000002',
      esPrimerRegistro: false,
      registroAnterior: { numSerie: 'A-2026-000001', fecha: new Date(2026, 5, 15), huella: a.hash },
    })
    const soap = wrapForSoap([a.xml, b.xml], {
      obligado: { nombreRazon: 'La Pallaresa', nif: 'B62215389' },
    })
    expect(validate(soap, 'SuministroLR.xsd')).toBe('valid')
  })
})
