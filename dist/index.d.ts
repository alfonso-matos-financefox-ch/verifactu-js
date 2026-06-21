interface IvaLine {
    tipoImpositivo: string;
    baseImponible: string;
    cuotaRepercutida: string;
}
interface DestinatarioF1 {
    nif: string;
    nombre: string;
}

interface VerifactuConfig {
    nif: string;
    nombreRazon: string;
    softwareNif: string;
    softwareNombre: string;
    softwareVersion: string;
    softwareId: string;
    testMode?: boolean;
}
interface FiscalInput {
    config: VerifactuConfig;
    numSerie: string;
    serie: string;
    fecha: Date;
    numRegistro: number;
    desgloseIva: IvaLine[];
    cuotaTotal: string;
    importeTotal: string;
    previousHash: string;
    esPrimerRegistro: boolean;
    destinatario?: DestinatarioF1;
}
interface FiscalData {
    hash: string;
    xml: string;
    qrUrl: string;
}
declare function buildTicketFiscalData(input: FiscalInput): Promise<FiscalData>;
type BatchFiscalInput = Omit<FiscalInput, 'previousHash' | 'esPrimerRegistro'>;
interface BatchFiscalResult {
    results: FiscalData[];
    lastHash: string;
}
declare function buildBatchFiscalData(inputs: BatchFiscalInput[], startingHash: string): Promise<BatchFiscalResult>;

export { type BatchFiscalInput, type BatchFiscalResult, type DestinatarioF1, type FiscalData, type FiscalInput, type IvaLine, type VerifactuConfig, buildBatchFiscalData, buildTicketFiscalData };
