// src/hash.ts
function buildHashInput(i) {
  return `IDEmisorFactura=${i.nif}NumSerieFactura=${i.numSerie}FechaExpedicionFactura=${i.fecha}TipoFactura=${i.tipoFactura}CuotaTotalFactura=${i.cuotaTotal}ImporteTotal=${i.importeTotal}Encadenamiento=${i.previousHash}`;
}
async function computeHash(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// src/qr.ts
var AEAT_QR_BASE_PROD = "https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR";
var AEAT_QR_BASE_TEST = "https://prewww2.aeat.es/wlpl/TEWC-CORE/ValidarQR";
function buildQrUrl(i) {
  const base = i.testMode ? AEAT_QR_BASE_TEST : AEAT_QR_BASE_PROD;
  const params = new URLSearchParams({
    nif: i.nif,
    numserie: i.numSerie,
    fecha: i.fecha,
    importe: i.importeTotal
  });
  return `${base}?${params.toString()}`;
}

// src/xml.ts
function escapeXml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function encadenamiento(i) {
  if (i.esPrimerRegistro) {
    return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;
  }
  return `<Encadenamiento><PrimerRegistro>N</PrimerRegistro><RegistroAnterior><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura><Huella>${escapeXml(i.previousHash)}</Huella></RegistroAnterior></Encadenamiento>`;
}
function desgloseIvaXml(lines) {
  return lines.map(
    (l) => `<DetalleIVA><TipoImpositivo>${escapeXml(l.tipoImpositivo)}</TipoImpositivo><BaseImponibleOimporteNoSujeto>${escapeXml(l.baseImponible)}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${escapeXml(l.cuotaRepercutida)}</CuotaRepercutida></DetalleIVA>`
  ).join("");
}
function buildTicketXml(i) {
  return `<RegistroFacturacion><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${escapeXml(i.nombreRazon)}</NombreRazonEmisor><TipoFactura>${escapeXml(i.tipoFactura)}</TipoFactura><DescripcionOperacion>${escapeXml(i.descripcion)}</DescripcionOperacion><Desglose>${desgloseIvaXml(i.desgloseIva)}</Desglose><CuotaTotal>${escapeXml(i.cuotaTotal)}</CuotaTotal><ImporteTotal>${escapeXml(i.importeTotal)}</ImporteTotal>${encadenamiento(i)}<SistemaInformatico><NombreRazon>${escapeXml(i.softwareNombre)}</NombreRazon><NIF>${escapeXml(i.softwareNif)}</NIF><NombreSistemaInformatico>${escapeXml(i.softwareNombre)}</NombreSistemaInformatico><IdSistemaInformatico>${escapeXml(i.softwareId)}</IdSistemaInformatico><Version>${escapeXml(i.softwareVersion)}</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico><FechaHoraHusoHorarioSistema>${escapeXml(i.fechaHora)}</FechaHoraHusoHorarioSistema><NumRegistro>${i.numRegistro}</NumRegistro><HuellaRegistro>${escapeXml(i.hash)}</HuellaRegistro></RegistroFacturacion>`;
}

// src/index.ts
function formatFecha(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
function formatFechaHora(d) {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mn = String(Math.abs(offset) % 60).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`;
}
function assertChainInput(input) {
  if (input.esPrimerRegistro && input.previousHash !== "") {
    throw new Error("Invalid chain input: first record must have empty previousHash");
  }
  if (!input.esPrimerRegistro && input.previousHash === "") {
    throw new Error("Invalid chain input: non-first record must have previousHash");
  }
  if (input.previousHash !== "" && !/^[0-9a-fA-F]{64}$/.test(input.previousHash)) {
    throw new Error("Invalid chain input: previousHash must be empty or 64-char hex");
  }
}
async function buildTicketFiscalData(input) {
  assertChainInput(input);
  const fecha = formatFecha(input.fecha);
  const hashStr = buildHashInput({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    tipoFactura: "F2",
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash
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
    tipoFactura: "F2",
    descripcion: "Venda de productes",
    desgloseIva: input.desgloseIva,
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash,
    hash,
    esPrimerRegistro: input.esPrimerRegistro
  };
  const xml = buildTicketXml(xmlInput);
  const qrUrl = buildQrUrl({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    importeTotal: input.importeTotal,
    testMode: input.config.testMode ?? false
  });
  return { hash, xml, qrUrl };
}
async function buildBatchFiscalData(inputs, startingHash) {
  let currentHash = startingHash;
  const results = [];
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const esPrimerRegistro = currentHash === "" && i === 0;
    const result = await buildTicketFiscalData({
      config: input.config,
      numSerie: input.numSerie,
      serie: input.serie,
      fecha: input.fecha,
      numRegistro: input.numRegistro,
      desgloseIva: input.desgloseIva,
      cuotaTotal: input.cuotaTotal,
      importeTotal: input.importeTotal,
      previousHash: currentHash,
      esPrimerRegistro
    });
    results.push(result);
    currentHash = result.hash;
  }
  return { results, lastHash: currentHash };
}
export {
  buildBatchFiscalData,
  buildTicketFiscalData
};
//# sourceMappingURL=index.js.map