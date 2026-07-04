export interface AltaHashInput {
  idEmisorFactura: string
  numSerieFactura: string
  fechaExpedicionFactura: string // DD-MM-YYYY
  tipoFactura: string
  cuotaTotal: string
  importeTotal: string
  huellaAnterior: string // '' para el primer registro de la cadena
  fechaHoraHusoGenRegistro: string // ISO 8601 con huso, p.ej. 2024-01-01T19:20:30+01:00
}

export interface AnulacionHashInput {
  idEmisorFacturaAnulada: string
  numSerieFacturaAnulada: string
  fechaExpedicionFacturaAnulada: string
  huellaAnterior: string
  fechaHoraHusoGenRegistro: string
}

// Doc AEAT "especificaciones huella" v0.1.2 §3: valores con trim, campo vacío → 'Nombre='
const t = (v: string): string => v.trim()

export function buildAltaHashInput(i: AltaHashInput): string {
  return [
    `IDEmisorFactura=${t(i.idEmisorFactura)}`,
    `NumSerieFactura=${t(i.numSerieFactura)}`,
    `FechaExpedicionFactura=${t(i.fechaExpedicionFactura)}`,
    `TipoFactura=${t(i.tipoFactura)}`,
    `CuotaTotal=${t(i.cuotaTotal)}`,
    `ImporteTotal=${t(i.importeTotal)}`,
    `Huella=${t(i.huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${t(i.fechaHoraHusoGenRegistro)}`,
  ].join('&')
}

export function buildAnulacionHashInput(i: AnulacionHashInput): string {
  return [
    `IDEmisorFacturaAnulada=${t(i.idEmisorFacturaAnulada)}`,
    `NumSerieFacturaAnulada=${t(i.numSerieFacturaAnulada)}`,
    `FechaExpedicionFacturaAnulada=${t(i.fechaExpedicionFacturaAnulada)}`,
    `Huella=${t(i.huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${t(i.fechaHoraHusoGenRegistro)}`,
  ].join('&')
}

// Doc AEAT §5: salida hexadecimal en MAYÚSCULAS, 64 caracteres
export async function computeHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}
