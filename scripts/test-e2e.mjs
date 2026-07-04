import { buildBatchInvoiceRecords, wrapForSoap } from '../dist/index.js'

const config = {
  nif: 'B12345678',
  nombreRazon: 'Test Restauració S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'test-sw',
  softwareVersion: '2.0',
  softwareId: 'TS',
  testMode: true,
}

const importes = [
  { base: '11.45', cuota: '1.15', total: '12.60' },
  { base: '7.64', cuota: '0.76', total: '8.40' },
  { base: '20.09', cuota: '2.01', total: '22.10' },
  { base: '15.36', cuota: '1.54', total: '16.90' },
  { base: '11.09', cuota: '1.11', total: '12.20' },
]

const inputs = importes.map((imp, i) => ({
  config,
  numSerie: `A-2026-00000${i + 1}`,
  fecha: new Date(2026, 0, 1),
  fechaHoraGenRegistro: `2026-01-01T1${i}:00:00+01:00`,
  descripcion: 'Venda de productes',
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: imp.base, cuotaRepercutida: imp.cuota }],
  cuotaTotal: imp.cuota,
  importeTotal: imp.total,
}))

console.log('▶ Generando 5 tickets en modo TEST...\n')

const { results, lastRef } = await buildBatchInvoiceRecords(inputs, null)

results.forEach((r, i) => {
  const input = inputs[i]
  console.log(`[${i + 1}/5] ${input.numSerie}  ${input.importeTotal}€`)
  console.log(`      hash:  ${r.hash}`)
  console.log(`      qrUrl: ${r.qrUrl}\n`)
})

console.log(`✔ Cadena de ${results.length} registros OK.`)
console.log(`  lastRef: ${lastRef.numSerie} / ${lastRef.huella}\n`)
console.log('▶ Payload RegFactuSistemaFacturacion (lo que la CF firmaría y enviaría a AEAT SOAP):')
console.log(
  wrapForSoap(
    results.map(r => r.xml),
    { obligado: { nombreRazon: config.nombreRazon, nif: config.nif } },
  ).slice(0, 400) + '…',
)
