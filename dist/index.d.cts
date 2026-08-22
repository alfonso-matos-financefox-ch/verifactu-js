declare const SF_NAMESPACE = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";
declare const SFLR_NAMESPACE = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
interface IvaLine {
    tipoImpositivo: string;
    baseImponible: string;
    cuotaRepercutida: string;
    claveRegimen?: string;
    calificacionOperacion?: string;
}
interface DestinatarioF1 {
    nif: string;
    nombre: string;
}
interface CabeceraInput {
    obligado: {
        nombreRazon: string;
        nif: string;
    };
}
declare const SOAP_MAX_RECORDS = 1000;
declare function wrapForSoap(records: string[], cabecera: CabeceraInput): string;

interface VerifactuConfig {
    nif: string;
    nombreRazon: string;
    softwareNif: string;
    softwareNombre: string;
    /**
     * NombreRazon del bloque SistemaInformatico: nombre o razon social de la
     * persona o entidad PRODUCTORA del software, no el nombre del software.
     * El nombre comercial va en softwareNombre (NombreSistemaInformatico).
     *
     * Fuente: AEAT, contenido del registro de facturacion de alta, punto 16 —
     * «el codigo de identificacion del sistema informatico utilizado, junto con
     * los datos identificativos del PRODUCTOR del citado sistema informatico».
     *
     * Con software autodesarrollado el productor es el propio obligado, asi que
     * el valor coincide con `nombreRazon`.
     *
     * Opcional por compatibilidad: si se omite se usa softwareNombre, que es lo
     * que hacian las versiones <= 2.0.1 (y es incorrecto). Ponlo siempre.
     */
    softwareNombreRazon?: string;
    softwareVersion: string;
    softwareId: string;
    numeroInstalacion?: string;
    testMode?: boolean;
}
type TipoFacturaAlta = 'F1' | 'F2';
interface RegistroAnteriorRef {
    numSerie: string;
    fecha: FechaInput;
    huella: string;
    idEmisor?: string;
}
interface FiscalInput {
    config: VerifactuConfig;
    numSerie: string;
    fecha: FechaInput;
    fechaHoraGenRegistro?: Date | string;
    tipoFactura?: TipoFacturaAlta;
    descripcion: string;
    desgloseIva: IvaLine[];
    cuotaTotal: string;
    importeTotal: string;
    esPrimerRegistro: boolean;
    registroAnterior?: RegistroAnteriorRef;
    destinatario?: DestinatarioF1;
}
interface FiscalData {
    hash: string;
    xml: string;
    qrUrl: string;
    fechaHoraGenRegistro: string;
}
interface AnulacionInput {
    config: VerifactuConfig;
    numSerieAnulada: string;
    fechaAnulada: FechaInput;
    fechaHoraGenRegistro?: Date | string;
    esPrimerRegistro: boolean;
    registroAnterior?: RegistroAnteriorRef;
}
interface AnulacionData {
    hash: string;
    xml: string;
    fechaHoraGenRegistro: string;
}
declare function centsToImporte(cents: number): string;
type FechaInput = Date | string;
declare function buildInvoiceRecord(input: FiscalInput): Promise<FiscalData>;
declare function buildAnulacionRecord(input: AnulacionInput): Promise<AnulacionData>;
type BatchInvoiceInput = Omit<FiscalInput, 'esPrimerRegistro' | 'registroAnterior'>;
interface BatchInvoiceResult {
    results: FiscalData[];
    lastRef: RegistroAnteriorRef | null;
}
declare function buildBatchInvoiceRecords(inputs: BatchInvoiceInput[], startingRef: RegistroAnteriorRef | null): Promise<BatchInvoiceResult>;

export { type AnulacionData, type AnulacionInput, type BatchInvoiceInput, type BatchInvoiceResult, type CabeceraInput, type DestinatarioF1, type FechaInput, type FiscalData, type FiscalInput, type IvaLine, type RegistroAnteriorRef, SFLR_NAMESPACE, SF_NAMESPACE, SOAP_MAX_RECORDS, type TipoFacturaAlta, type VerifactuConfig, buildAnulacionRecord, buildBatchInvoiceRecords, buildInvoiceRecord, centsToImporte, wrapForSoap };
