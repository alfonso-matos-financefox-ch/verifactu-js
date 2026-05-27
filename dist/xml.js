function encadenamiento(i) {
    if (i.esPrimerRegistro) {
        return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;
    }
    return `<Encadenamiento><PrimerRegistro>N</PrimerRegistro><RegistroAnterior><IDEmisorFactura>${i.nif}</IDEmisorFactura><NumSerieFactura>${i.numSerie}</NumSerieFactura><FechaExpedicionFactura>${i.fecha}</FechaExpedicionFactura><Huella>${i.previousHash}</Huella></RegistroAnterior></Encadenamiento>`;
}
function desgloseIvaXml(lines) {
    return lines.map(l => `<DetalleIVA><TipoImpositivo>${l.tipoImpositivo}</TipoImpositivo><BaseImponibleOimporteNoSujeto>${l.baseImponible}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${l.cuotaRepercutida}</CuotaRepercutida></DetalleIVA>`).join('');
}
export function buildTicketXml(i) {
    return `<RegistroFacturacion><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${i.nif}</IDEmisorFactura><NumSerieFactura>${i.numSerie}</NumSerieFactura><FechaExpedicionFactura>${i.fecha}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${i.nombreRazon}</NombreRazonEmisor><TipoFactura>${i.tipoFactura}</TipoFactura><DescripcionOperacion>${i.descripcion}</DescripcionOperacion><Desglose>${desgloseIvaXml(i.desgloseIva)}</Desglose><CuotaTotal>${i.cuotaTotal}</CuotaTotal><ImporteTotal>${i.importeTotal}</ImporteTotal>${encadenamiento(i)}<SistemaInformatico><NombreRazon>${i.softwareNombre}</NombreRazon><NIF>${i.softwareNif}</NIF><NombreSistemaInformatico>${i.softwareNombre}</NombreSistemaInformatico><IdSistemaInformatico>${i.softwareId}</IdSistemaInformatico><Version>${i.softwareVersion}</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico><FechaHoraHusoHorarioSistema>${i.fechaHora}</FechaHoraHusoHorarioSistema><NumRegistro>${i.numRegistro}</NumRegistro><HuellaRegistro>${i.hash}</HuellaRegistro></RegistroFacturacion>`;
}
//# sourceMappingURL=xml.js.map