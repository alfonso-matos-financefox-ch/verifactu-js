interface IvaLine {
    tipoImpositivo: string;
    baseImponible: string;
    cuotaRepercutida: string;
}

interface VerifactuConfig {
    nif: string;
    nombreRazon: string;
    softwareNif: string;
    softwareNombre: string;
    softwareVersion: string;
    softwareId: string;
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
}
interface FiscalData {
    hash: string;
    xml: string;
    qrUrl: string;
}
declare function buildTicketFiscalData(input: FiscalInput): Promise<FiscalData>;

export { type FiscalData, type FiscalInput, type IvaLine, type VerifactuConfig, buildTicketFiscalData };
