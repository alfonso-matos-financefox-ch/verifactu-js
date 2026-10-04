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

// Destinatario con NIF español (PersonaFisicaJuridicaType, rama NIF del choice)
export interface DestinatarioNif {
  nombre: string
  nif: string
  idOtro?: never
}

// IDType del XSD (PersonaFisicaJuridicaIDTypeType): 02 NIF-IVA, 03 pasaporte, 04 documento oficial del
// país de residencia, 05 certificado de residencia, 06 otro documento probatorio, 07 no censado
export type IDTypeOtro = '02' | '03' | '04' | '05' | '06' | '07'

// IDOtroType: identificación de un destinatario sin NIF español
export interface IDOtro {
  codigoPais: string // ISO 3166-1 alfa-2 (CountryType2 del XSD)
  idType: IDTypeOtro
  id: string // máx. 20 caracteres (TextMax20Type)
}

// Destinatario sin NIF español (rama IDOtro del choice)
export interface DestinatarioIdOtro {
  nombre: string
  idOtro: IDOtro
  nif?: never
}

// Exactamente uno de los dos: NIF o IDOtro (choice del XSD)
export type Destinatario = DestinatarioNif | DestinatarioIdOtro

/** @deprecated desde v2.4.0 — usar `Destinatario` (admite también IDOtro). Se mantiene por compatibilidad. */
export type DestinatarioF1 = DestinatarioNif

// IDFacturaARType del XSD: identifica una factura sustituida (F3) por el emisor, n.º y fecha
export interface FacturaSustituidaXml {
  idEmisor: string
  numSerie: string
  fecha: string // DD-MM-YYYY
}

// Mismo IDFacturaARType que la sustituida: identifica la factura que corrige una rectificativa
export type FacturaRectificadaXml = FacturaSustituidaXml

// DesgloseRectificacionType: base y cuota de la factura original en las rectificativas por sustitución (S)
export interface ImporteRectificacionXml {
  baseRectificada: string
  cuotaRectificada: string
  cuotaRecargoRectificado?: string
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
  destinatario?: Destinatario
  facturasSustituidas?: FacturaSustituidaXml[] // solo F3
  tipoRectificativa?: 'S' | 'I' // solo R1..R5
  facturasRectificadas?: FacturaRectificadaXml[] // solo R1..R5
  importeRectificacion?: ImporteRectificacionXml // solo TipoRectificativa S
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

// XSD PersonaFisicaJuridicaType: NombreRazon → choice(NIF | IDOtro{CodigoPais, IDType, ID})
function destinatariosXml(d: Destinatario): string {
  const id =
    d.idOtro !== undefined
      ? `<IDOtro>` +
        `<CodigoPais>${escapeXml(d.idOtro.codigoPais)}</CodigoPais>` +
        `<IDType>${escapeXml(d.idOtro.idType)}</IDType>` +
        `<ID>${escapeXml(d.idOtro.id)}</ID>` +
        `</IDOtro>`
      : `<NIF>${escapeXml(d.nif)}</NIF>`
  return `<Destinatarios><IDDestinatario><NombreRazon>${escapeXml(d.nombre)}</NombreRazon>${id}</IDDestinatario></Destinatarios>`
}

// IDFacturaARType envuelto en su bloque (FacturasRectificadas / FacturasSustituidas)
function idFacturaArListXml(bloque: string, item: string, list: FacturaSustituidaXml[]): string {
  const ids = list
    .map(
      f =>
        `<${item}>` +
        `<IDEmisorFactura>${escapeXml(f.idEmisor)}</IDEmisorFactura>` +
        `<NumSerieFactura>${escapeXml(f.numSerie)}</NumSerieFactura>` +
        `<FechaExpedicionFactura>${escapeXml(f.fecha)}</FechaExpedicionFactura>` +
        `</${item}>`,
    )
    .join('')
  return `<${bloque}>${ids}</${bloque}>`
}

function importeRectificacionXml(r: ImporteRectificacionXml): string {
  const recargo =
    r.cuotaRecargoRectificado !== undefined
      ? `<CuotaRecargoRectificado>${escapeXml(r.cuotaRecargoRectificado)}</CuotaRecargoRectificado>`
      : ''
  return (
    `<ImporteRectificacion>` +
    `<BaseRectificada>${escapeXml(r.baseRectificada)}</BaseRectificada>` +
    `<CuotaRectificada>${escapeXml(r.cuotaRectificada)}</CuotaRectificada>` +
    recargo +
    `</ImporteRectificacion>`
  )
}

// XSD, entre TipoFactura y DescripcionOperacion: TipoRectificativa → FacturasRectificadas →
// FacturasSustituidas → ImporteRectificacion
function rectificacionYSustitucionXml(i: AltaXmlInput): string {
  return (
    (i.tipoRectificativa ? `<TipoRectificativa>${escapeXml(i.tipoRectificativa)}</TipoRectificativa>` : '') +
    (i.facturasRectificadas?.length
      ? idFacturaArListXml('FacturasRectificadas', 'IDFacturaRectificada', i.facturasRectificadas)
      : '') +
    (i.facturasSustituidas?.length
      ? idFacturaArListXml('FacturasSustituidas', 'IDFacturaSustituida', i.facturasSustituidas)
      : '') +
    (i.importeRectificacion ? importeRectificacionXml(i.importeRectificacion) : '')
  )
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
    rectificacionYSustitucionXml(i) +
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
