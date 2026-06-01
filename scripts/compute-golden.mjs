import { buildTicketFiscalData, buildBatchFiscalData } from '../dist/index.js'

const config = {
  nif: 'B62215389',
  nombreRazon: 'La Pallaresa, S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'Pallaresa TPV',
  softwareVersion: '1.0',
  softwareId: 'PALLARESA-TPV-1',
  testMode: false,
}

// Single ticket — first record
const r1 = await buildTicketFiscalData({
  config,
  numSerie: 'A-2026-000001',
  serie: 'A',
  fecha: new Date(2026, 0, 1, 12, 0, 0),
  numRegistro: 1,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '9.09', cuotaRepercutida: '0.91' }],
  cuotaTotal: '0.91',
  importeTotal: '10.00',
  previousHash: '',
  esPrimerRegistro: true,
})

console.log('=== SINGLE TICKET ===')
console.log('hash:', JSON.stringify(r1.hash))
console.log('qrUrl:', JSON.stringify(r1.qrUrl))
console.log('xml:', JSON.stringify(r1.xml))

// Batch — 2 tickets chained
const batch = await buildBatchFiscalData([
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

console.log('\n=== BATCH ===')
console.log('batch[0].hash:', JSON.stringify(batch.results[0].hash))
console.log('batch[1].hash:', JSON.stringify(batch.results[1].hash))
console.log('batch.lastHash:', JSON.stringify(batch.lastHash))
