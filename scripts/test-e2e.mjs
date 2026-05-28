import { buildBatchFiscalData } from '../dist/index.js'

const config = {
  nif: 'B12345678',
  nombreRazon: 'Test Restauració S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'test-sw',
  softwareVersion: '1.0',
  softwareId: 'TEST-001',
  testMode: true,
}

const inputs = [
  {
    config,
    numSerie: 'A-2026-000001',
    serie: 'A',
    fecha: new Date('2026-01-01T10:00:00'),
    numRegistro: 1,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
    cuotaTotal: '1.15',
    importeTotal: '12.60',
  },
  {
    config,
    numSerie: 'A-2026-000002',
    serie: 'A',
    fecha: new Date('2026-01-01T11:00:00'),
    numRegistro: 2,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '7.64', cuotaRepercutida: '0.76' }],
    cuotaTotal: '0.76',
    importeTotal: '8.40',
  },
  {
    config,
    numSerie: 'A-2026-000003',
    serie: 'A',
    fecha: new Date('2026-01-01T12:00:00'),
    numRegistro: 3,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '20.09', cuotaRepercutida: '2.01' }],
    cuotaTotal: '2.01',
    importeTotal: '22.10',
  },
  {
    config,
    numSerie: 'A-2026-000004',
    serie: 'A',
    fecha: new Date('2026-01-01T13:00:00'),
    numRegistro: 4,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '15.36', cuotaRepercutida: '1.54' }],
    cuotaTotal: '1.54',
    importeTotal: '16.90',
  },
  {
    config,
    numSerie: 'A-2026-000005',
    serie: 'A',
    fecha: new Date('2026-01-01T14:00:00'),
    numRegistro: 5,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.09', cuotaRepercutida: '1.11' }],
    cuotaTotal: '1.11',
    importeTotal: '12.20',
  },
]

console.log('▶ Generando 5 tickets en modo TEST...\n')

const { results, lastHash } = await buildBatchFiscalData(inputs, '')

results.forEach((r, i) => {
  const input = inputs[i]
  console.log(`[${i + 1}/5] ${input.numSerie}  ${input.importeTotal}€`)
  console.log(`      hash:  ${r.hash}`)
  console.log(`      qrUrl: ${r.qrUrl}\n`)
})

console.log(`✔ Cadena de ${results.length} registros OK.`)
console.log(`  lastHash: ${lastHash}\n`)
console.log('▶ XML del registro 1 (lo que se firmaría y enviaría a AEAT SOAP):')
console.log(results[0].xml)
