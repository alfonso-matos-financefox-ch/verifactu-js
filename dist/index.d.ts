import type { IvaLine } from './xml.js';
export type { IvaLine };
export interface VerifactuConfig {
    nif: string;
    nombreRazon: string;
    softwareNif: string;
    softwareNombre: string;
    softwareVersion: string;
    softwareId: string;
}
export interface FiscalInput {
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
export interface FiscalData {
    hash: string;
    xml: string;
    qrUrl: string;
}
export declare function buildTicketFiscalData(input: FiscalInput): Promise<FiscalData>;
//# sourceMappingURL=index.d.ts.map