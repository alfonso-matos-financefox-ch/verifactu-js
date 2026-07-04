import { describe, it, expect } from 'vitest'
import { buildBatchInvoiceRecords, buildInvoiceRecord } from '../src/index.js'
import type { BatchInvoiceInput, VerifactuConfig } from '../src/index.js'

const config: VerifactuConfig = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa',
  softwareNif: 'B00000000',
  softwareNombre: 'pallaresa-tpv',
  softwareVersion: '2.0.0',
  softwareId: 'PT',
  testMode: true,
}

function ticket(n: number): BatchInvoiceInput {
  return {
    config,
    numSerie: `A-2026-00000${n}`,
    fecha: new Date(2026, 5, 15),
    fechaHoraGenRegistro: `2026-06-15T12:00:0${n}+02:00`,
    descripcion: 'Venda de productes',
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
    cuotaTotal: '1.15',
    importeTotal: '12.60',
  }
}

describe('buildBatchInvoiceRecords', () => {
  it('encadena N registros desde el inicio de cadena (startingRef null)', async () => {
    const { results, lastRef } = await buildBatchInvoiceRecords([ticket(1), ticket(2), ticket(3)], null)
    expect(results).toHaveLength(3)
    expect(results[0]!.xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
    expect(results[1]!.xml).toContain(`<Huella>${results[0]!.hash}</Huella></RegistroAnterior>`)
    expect(results[1]!.xml).toContain(
      '<RegistroAnterior><IDEmisorFactura>B62215389</IDEmisorFactura><NumSerieFactura>A-2026-000001</NumSerieFactura>',
    )
    expect(results[2]!.xml).toContain(`<Huella>${results[1]!.hash}</Huella></RegistroAnterior>`)
    expect(lastRef).not.toBeNull()
    expect(lastRef!.huella).toBe(results[2]!.hash)
    expect(lastRef!.numSerie).toBe('A-2026-000003')
  })

  it('continúa una cadena existente (startingRef con huella previa)', async () => {
    const first = await buildBatchInvoiceRecords([ticket(1)], null)
    const { results } = await buildBatchInvoiceRecords([ticket(2)], first.lastRef)
    expect(results[0]!.xml).not.toContain('<PrimerRegistro>')
    expect(results[0]!.xml).toContain(`<Huella>${first.results[0]!.hash}</Huella>`)
  })

  it('batch equivale a llamadas individuales encadenadas', async () => {
    const batch = await buildBatchInvoiceRecords([ticket(1), ticket(2)], null)
    const solo1 = await buildInvoiceRecord({ ...ticket(1), esPrimerRegistro: true })
    const solo2 = await buildInvoiceRecord({
      ...ticket(2),
      esPrimerRegistro: false,
      registroAnterior: { numSerie: ticket(1).numSerie, fecha: ticket(1).fecha, huella: solo1.hash },
    })
    expect(batch.results[0]!.hash).toBe(solo1.hash)
    expect(batch.results[1]!.hash).toBe(solo2.hash)
    expect(batch.results[1]!.xml).toBe(solo2.xml)
  })

  it('batch vacío → sin resultados, lastRef = startingRef', async () => {
    const { results, lastRef } = await buildBatchInvoiceRecords([], null)
    expect(results).toHaveLength(0)
    expect(lastRef).toBeNull()
  })
})
