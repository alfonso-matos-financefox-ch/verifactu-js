export interface HashInput {
    nif: string;
    numSerie: string;
    fecha: string;
    tipoFactura: string;
    cuotaTotal: string;
    importeTotal: string;
    previousHash: string;
}
export declare function buildHashInput(i: HashInput): string;
export declare function computeHash(data: string): Promise<string>;
//# sourceMappingURL=hash.d.ts.map