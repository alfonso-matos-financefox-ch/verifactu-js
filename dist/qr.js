const AEAT_QR_BASE = 'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR';
export function buildQrUrl(i) {
    const params = new URLSearchParams({
        nif: i.nif,
        numserie: i.numSerie,
        fecha: i.fecha,
        importe: i.importeTotal,
    });
    return `${AEAT_QR_BASE}?${params.toString()}`;
}
//# sourceMappingURL=qr.js.map