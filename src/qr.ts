export interface QrInput {
  nif: string
  numSerie: string
  fecha: string // DD-MM-YYYY
  importeTotal: string // '12.60'
  testMode: boolean
}

// Doc AEAT "especificaciones QR" v0.5.0 §5.1 — servicio de cotejo para SIF verificables
const AEAT_QR_BASE_PROD = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR'
const AEAT_QR_BASE_TEST = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR'

export function buildQrUrl(i: QrInput): string {
  const base = i.testMode ? AEAT_QR_BASE_TEST : AEAT_QR_BASE_PROD
  const params = new URLSearchParams({
    nif: i.nif,
    numserie: i.numSerie,
    fecha: i.fecha,
    importe: i.importeTotal,
  })
  return `${base}?${params.toString()}`
}
