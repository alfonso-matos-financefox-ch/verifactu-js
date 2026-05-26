export interface QrInput {
  nif: string
  numSerie: string
  fecha: string        // DD-MM-YYYY
  importeTotal: string // '12.60'
}

const AEAT_QR_BASE = 'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR'

export function buildQrUrl(i: QrInput): string {
  const params = new URLSearchParams({
    nif: i.nif,
    numserie: i.numSerie,
    fecha: i.fecha,
    importe: i.importeTotal,
  })
  return `${AEAT_QR_BASE}?${params.toString()}`
}
