export function buildHashInput(i) {
    return (`IDEmisorFactura=${i.nif}` +
        `NumSerieFactura=${i.numSerie}` +
        `FechaExpedicionFactura=${i.fecha}` +
        `TipoFactura=${i.tipoFactura}` +
        `CuotaTotalFactura=${i.cuotaTotal}` +
        `ImporteTotal=${i.importeTotal}` +
        `Encadenamiento=${i.previousHash}`);
}
export async function computeHash(data) {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
//# sourceMappingURL=hash.js.map