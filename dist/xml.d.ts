export interface IvaLine {
    tipoImpositivo: string;
    baseImponible: string;
    cuotaRepercutida: string;
}
export interface XmlInput {
    nif: string;
    nombreRazon: string;
    softwareNif: string;
    softwareNombre: string;
    softwareVersion: string;
    softwareId: string;
    numSerie: string;
    fecha: string;
    fechaHora: string;
    numRegistro: number;
    tipoFactura: string;
    descripcion: string;
    desgloseIva: IvaLine[];
    cuotaTotal: string;
    importeTotal: string;
    previousHash: string;
    hash: string;
    esPrimerRegistro: boolean;
}
export declare function buildTicketXml(i: XmlInput): string;
//# sourceMappingURL=xml.d.ts.map