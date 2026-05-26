export interface HashInput {
  nif: string
  numSerie: string
  fecha: string        // DD-MM-YYYY
  tipoFactura: string  // 'F2' for simplified invoices
  cuotaTotal: string   // '1.05' — 2 decimals, dot separator
  importeTotal: string // '12.60' — 2 decimals, dot separator
  previousHash: string // '' for the first ticket
}

export function buildHashInput(i: HashInput): string {
  return (
    `IDEmisorFactura=${i.nif}` +
    `NumSerieFactura=${i.numSerie}` +
    `FechaExpedicionFactura=${i.fecha}` +
    `TipoFactura=${i.tipoFactura}` +
    `CuotaTotalFactura=${i.cuotaTotal}` +
    `ImporteTotal=${i.importeTotal}` +
    `Encadenamiento=${i.previousHash}`
  )
}

export async function computeHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
