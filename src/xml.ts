export interface IvaLine {
  tipoImpositivo: string
  baseImponible: string
  cuotaRepercutida: string
}

export interface DestinatarioF1 {
  nif: string
  nombre: string
}

export interface XmlInput {
  nif: string
  nombreRazon: string
  softwareNif: string
  softwareNombre: string
  softwareVersion: string
  softwareId: string
  numSerie: string
  fecha: string
  fechaHora: string
  numRegistro: number
  tipoFactura: string
  descripcion: string
  desgloseIva: IvaLine[]
  cuotaTotal: string
  importeTotal: string
  previousHash: string
  hash: string
  esPrimerRegistro: boolean
  destinatario?: DestinatarioF1
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildDestinatariosXml(d: DestinatarioF1): string {
  return `<Destinatarios><IDDestinatario><NombreRazon>${escapeXml(d.nombre)}</NombreRazon><NIF>${escapeXml(d.nif)}</NIF></IDDestinatario></Destinatarios>`
}

function encadenamiento(i: XmlInput): string {
  if (i.esPrimerRegistro) {
    return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`
  }
  return `<Encadenamiento><PrimerRegistro>N</PrimerRegistro><RegistroAnterior><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura><Huella>${escapeXml(i.previousHash)}</Huella></RegistroAnterior></Encadenamiento>`
}

function desgloseIvaXml(lines: IvaLine[]): string {
  return lines.map(l =>
    `<DetalleIVA><TipoImpositivo>${escapeXml(l.tipoImpositivo)}</TipoImpositivo><BaseImponibleOimporteNoSujeto>${escapeXml(l.baseImponible)}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${escapeXml(l.cuotaRepercutida)}</CuotaRepercutida></DetalleIVA>`
  ).join('')
}

export function buildTicketXml(i: XmlInput): string {
  const destinatariosBlock = i.destinatario ? buildDestinatariosXml(i.destinatario) : ''
  return `<RegistroFacturacion><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${escapeXml(i.nombreRazon)}</NombreRazonEmisor>${destinatariosBlock}<TipoFactura>${escapeXml(i.tipoFactura)}</TipoFactura><DescripcionOperacion>${escapeXml(i.descripcion)}</DescripcionOperacion><Desglose>${desgloseIvaXml(i.desgloseIva)}</Desglose><CuotaTotal>${escapeXml(i.cuotaTotal)}</CuotaTotal><ImporteTotal>${escapeXml(i.importeTotal)}</ImporteTotal>${encadenamiento(i)}<SistemaInformatico><NombreRazon>${escapeXml(i.softwareNombre)}</NombreRazon><NIF>${escapeXml(i.softwareNif)}</NIF><NombreSistemaInformatico>${escapeXml(i.softwareNombre)}</NombreSistemaInformatico><IdSistemaInformatico>${escapeXml(i.softwareId)}</IdSistemaInformatico><Version>${escapeXml(i.softwareVersion)}</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico><FechaHoraHusoHorarioSistema>${escapeXml(i.fechaHora)}</FechaHoraHusoHorarioSistema><NumRegistro>${i.numRegistro}</NumRegistro><HuellaRegistro>${escapeXml(i.hash)}</HuellaRegistro></RegistroFacturacion>`
}
