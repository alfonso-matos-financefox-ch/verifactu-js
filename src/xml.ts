export const SF_NAMESPACE =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd'
export const SFLR_NAMESPACE =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd'

export interface IvaLine {
  tipoImpositivo: string
  baseImponible: string // → BaseImponibleOimporteNoSujeto
  cuotaRepercutida: string
  claveRegimen?: string // default '01' — régimen general
  calificacionOperacion?: string // default 'S1' — sujeta y no exenta, sin inversión
}

export interface DestinatarioF1 {
  nif: string
  nombre: string
}

export interface SistemaInformaticoInput {
  nombreRazon: string
  nif: string
  nombreSistema: string
  id: string // IdSistemaInformatico — XSD TextMax2Type, máx. 2 caracteres
  version: string
  numeroInstalacion: string
}

export interface RegistroAnteriorXml {
  idEmisor: string
  numSerie: string
  fecha: string // DD-MM-YYYY — de la factura ANTERIOR, no la actual
  huella: string
}

export interface AltaXmlInput {
  nif: string
  nombreRazon: string
  sistema: SistemaInformaticoInput
  numSerie: string
  fecha: string // DD-MM-YYYY
  fechaHoraGenRegistro: string // ISO 8601 con huso — el mismo valor que entró en el hash
  tipoFactura: string
  descripcion: string
  desgloseIva: IvaLine[]
  cuotaTotal: string
  importeTotal: string
  registroAnterior: RegistroAnteriorXml | null // null = primer registro de la cadena
  hash: string
  destinatario?: DestinatarioF1
}

export interface AnulacionXmlInput {
  nif: string
  sistema: SistemaInformaticoInput
  numSerieAnulada: string
  fechaAnulada: string // DD-MM-YYYY
  fechaHoraGenRegistro: string
  registroAnterior: RegistroAnteriorXml | null
  hash: string
}

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function destinatariosXml(d: DestinatarioF1): string {
  return `<Destinatarios><IDDestinatario><NombreRazon>${escapeXml(d.nombre)}</NombreRazon><NIF>${escapeXml(d.nif)}</NIF></IDDestinatario></Destinatarios>`
}

// XSD: Encadenamiento es un choice — PrimerRegistro O RegistroAnterior, nunca ambos
function encadenamientoXml(prev: RegistroAnteriorXml | null): string {
  if (prev === null) {
    return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`
  }
  return (
    `<Encadenamiento><RegistroAnterior>` +
    `<IDEmisorFactura>${escapeXml(prev.idEmisor)}</IDEmisorFactura>` +
    `<NumSerieFactura>${escapeXml(prev.numSerie)}</NumSerieFactura>` +
    `<FechaExpedicionFactura>${escapeXml(prev.fecha)}</FechaExpedicionFactura>` +
    `<Huella>${escapeXml(prev.huella)}</Huella>` +
    `</RegistroAnterior></Encadenamiento>`
  )
}

function desgloseXml(lines: IvaLine[]): string {
  const detalles = lines
    .map(
      l =>
        `<DetalleDesglose>` +
        `<ClaveRegimen>${escapeXml(l.claveRegimen ?? '01')}</ClaveRegimen>` +
        `<CalificacionOperacion>${escapeXml(l.calificacionOperacion ?? 'S1')}</CalificacionOperacion>` +
        `<TipoImpositivo>${escapeXml(l.tipoImpositivo)}</TipoImpositivo>` +
        `<BaseImponibleOimporteNoSujeto>${escapeXml(l.baseImponible)}</BaseImponibleOimporteNoSujeto>` +
        `<CuotaRepercutida>${escapeXml(l.cuotaRepercutida)}</CuotaRepercutida>` +
        `</DetalleDesglose>`,
    )
    .join('')
  return `<Desglose>${detalles}</Desglose>`
}

function sistemaInformaticoXml(s: SistemaInformaticoInput): string {
  return (
    `<SistemaInformatico>` +
    `<NombreRazon>${escapeXml(s.nombreRazon)}</NombreRazon>` +
    `<NIF>${escapeXml(s.nif)}</NIF>` +
    `<NombreSistemaInformatico>${escapeXml(s.nombreSistema)}</NombreSistemaInformatico>` +
    `<IdSistemaInformatico>${escapeXml(s.id)}</IdSistemaInformatico>` +
    `<Version>${escapeXml(s.version)}</Version>` +
    `<NumeroInstalacion>${escapeXml(s.numeroInstalacion)}</NumeroInstalacion>` +
    `<TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu>` +
    `<TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT>` +
    `<IndicadorMultiplesOT>N</IndicadorMultiplesOT>` +
    `</SistemaInformatico>`
  )
}

export function buildRegistroAltaXml(i: AltaXmlInput): string {
  const destinatarios = i.destinatario ? destinatariosXml(i.destinatario) : ''
  return (
    `<RegistroAlta xmlns="${SF_NAMESPACE}">` +
    `<IDVersion>1.0</IDVersion>` +
    `<IDFactura>` +
    `<IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura>` +
    `<NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura>` +
    `<FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura>` +
    `</IDFactura>` +
    `<NombreRazonEmisor>${escapeXml(i.nombreRazon)}</NombreRazonEmisor>` +
    `<TipoFactura>${escapeXml(i.tipoFactura)}</TipoFactura>` +
    `<DescripcionOperacion>${escapeXml(i.descripcion)}</DescripcionOperacion>` +
    destinatarios +
    desgloseXml(i.desgloseIva) +
    `<CuotaTotal>${escapeXml(i.cuotaTotal)}</CuotaTotal>` +
    `<ImporteTotal>${escapeXml(i.importeTotal)}</ImporteTotal>` +
    encadenamientoXml(i.registroAnterior) +
    sistemaInformaticoXml(i.sistema) +
    `<FechaHoraHusoGenRegistro>${escapeXml(i.fechaHoraGenRegistro)}</FechaHoraHusoGenRegistro>` +
    `<TipoHuella>01</TipoHuella>` +
    `<Huella>${escapeXml(i.hash)}</Huella>` +
    `</RegistroAlta>`
  )
}

export function buildRegistroAnulacionXml(i: AnulacionXmlInput): string {
  return (
    `<RegistroAnulacion xmlns="${SF_NAMESPACE}">` +
    `<IDVersion>1.0</IDVersion>` +
    `<IDFactura>` +
    `<IDEmisorFacturaAnulada>${escapeXml(i.nif)}</IDEmisorFacturaAnulada>` +
    `<NumSerieFacturaAnulada>${escapeXml(i.numSerieAnulada)}</NumSerieFacturaAnulada>` +
    `<FechaExpedicionFacturaAnulada>${escapeXml(i.fechaAnulada)}</FechaExpedicionFacturaAnulada>` +
    `</IDFactura>` +
    encadenamientoXml(i.registroAnterior) +
    sistemaInformaticoXml(i.sistema) +
    `<FechaHoraHusoGenRegistro>${escapeXml(i.fechaHoraGenRegistro)}</FechaHoraHusoGenRegistro>` +
    `<TipoHuella>01</TipoHuella>` +
    `<Huella>${escapeXml(i.hash)}</Huella>` +
    `</RegistroAnulacion>`
  )
}

export interface CabeceraInput {
  obligado: { nombreRazon: string; nif: string }
}

export const SOAP_MAX_RECORDS = 1000

// Payload RegFactuSistemaFacturacion (SuministroLR.xsd). El envelope soapenv:Envelope/Body
// y la firma electrónica siguen siendo responsabilidad del integrador que hace el envío.
export function wrapForSoap(records: string[], cabecera: CabeceraInput): string {
  if (records.length === 0) {
    throw new Error('wrapForSoap: records must not be empty')
  }
  if (records.length > SOAP_MAX_RECORDS) {
    throw new Error(`wrapForSoap: max ${SOAP_MAX_RECORDS} records per envío (got ${records.length})`)
  }
  const registros = records.map(r => `<sfLR:RegistroFactura>${r}</sfLR:RegistroFactura>`).join('')
  return (
    `<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${SFLR_NAMESPACE}" xmlns:sf="${SF_NAMESPACE}">` +
    `<sfLR:Cabecera>` +
    `<sf:ObligadoEmision>` +
    `<sf:NombreRazon>${escapeXml(cabecera.obligado.nombreRazon)}</sf:NombreRazon>` +
    `<sf:NIF>${escapeXml(cabecera.obligado.nif)}</sf:NIF>` +
    `</sf:ObligadoEmision>` +
    `</sfLR:Cabecera>` +
    registros +
    `</sfLR:RegFactuSistemaFacturacion>`
  )
}
