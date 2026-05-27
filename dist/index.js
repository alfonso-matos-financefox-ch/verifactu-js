import { buildHashInput, computeHash } from './hash.js';
import { buildQrUrl } from './qr.js';
import { buildTicketXml } from './xml.js';
function formatFecha(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}
function formatFechaHora(d) {
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const mn = String(Math.abs(offset) % 60).padStart(2, '0');
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`;
}
export async function buildTicketFiscalData(input) {
    const fecha = formatFecha(input.fecha);
    const hashStr = buildHashInput({
        nif: input.config.nif,
        numSerie: input.numSerie,
        fecha,
        tipoFactura: 'F2',
        cuotaTotal: input.cuotaTotal,
        importeTotal: input.importeTotal,
        previousHash: input.previousHash,
    });
    const hash = await computeHash(hashStr);
    const xmlInput = {
        nif: input.config.nif,
        nombreRazon: input.config.nombreRazon,
        softwareNif: input.config.softwareNif,
        softwareNombre: input.config.softwareNombre,
        softwareVersion: input.config.softwareVersion,
        softwareId: input.config.softwareId,
        numSerie: input.numSerie,
        fecha,
        fechaHora: formatFechaHora(input.fecha),
        numRegistro: input.numRegistro,
        tipoFactura: 'F2',
        descripcion: 'Venda de productes',
        desgloseIva: input.desgloseIva,
        cuotaTotal: input.cuotaTotal,
        importeTotal: input.importeTotal,
        previousHash: input.previousHash,
        hash,
        esPrimerRegistro: input.esPrimerRegistro,
    };
    const xml = buildTicketXml(xmlInput);
    const qrUrl = buildQrUrl({
        nif: input.config.nif,
        numSerie: input.numSerie,
        fecha,
        importeTotal: input.importeTotal,
    });
    return { hash, xml, qrUrl };
}
//# sourceMappingURL=index.js.map