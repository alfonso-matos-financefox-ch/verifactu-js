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
function encadenamiento(i) {
  if (i.esPrimerRegistro) {
    return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;
  }
  return `<Encadenamiento><PrimerRegistro>N</PrimerRegistro><RegistroAnterior><IDEmisorFactura>${i.nif}</IDEmisorFactura><NumSerieFactura>${i.numSerie}</NumSerieFactura><FechaExpedicionFactura>${i.fecha}</FechaExpedicionFactura><Huella>${i.previousHash}</Huella></RegistroAnterior></Encadenamiento>`;
}
function desgloseIvaXml(lines) {
  return lines.map(
    (l) => `<DetalleIVA><TipoImpositivo>${l.tipoImpositivo}</TipoImpositivo><BaseImponibleOimporteNoSujeto>${l.baseImponible}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${l.cuotaRepercutida}</CuotaRepercutida></DetalleIVA>`
  ).join("");
}
function buildTicketXml(i) {
  return `<RegistroFacturacion><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${i.nif}</IDEmisorFactura><NumSerieFactura>${i.numSerie}</NumSerieFactura><FechaExpedicionFactura>${i.fecha}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${i.nombreRazon}</NombreRazonEmisor><TipoFactura>${i.tipoFactura}</TipoFactura><DescripcionOperacion>${i.descripcion}</DescripcionOperacion><Desglose>${desgloseIvaXml(i.desgloseIva)}</Desglose><CuotaTotal>${i.cuotaTotal}</CuotaTotal><ImporteTotal>${i.importeTotal}</ImporteTotal>${encadenamiento(i)}<SistemaInformatico><NombreRazon>${i.softwareNombre}</NombreRazon><NIF>${i.softwareNif}</NIF><NombreSistemaInformatico>${i.softwareNombre}</NombreSistemaInformatico><IdSistemaInformatico>${i.softwareId}</IdSistemaInformatico><Version>${i.softwareVersion}</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico><FechaHoraHusoHorarioSistema>${i.fechaHora}</FechaHoraHusoHorarioSistema><NumRegistro>${i.numRegistro}</NumRegistro><HuellaRegistro>${i.hash}</HuellaRegistro></RegistroFacturacion>`;
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
async function buildTicketFiscalData(input) {
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
async function submitMock(_xml, hash) {
  await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
  return { ok: true, csv: hash.slice(0, 16).toUpperCase() };
}
async function submitReal(_xml, _config, _hash) {
  throw new Error(
    "Real SOAP not yet implemented \u2014 set testMode: true or provide a P12 certificate"
  );
}
async function submit(xml, config, hash) {
  return config.testMode === true ? submitMock(xml, hash) : submitReal(xml, config, hash);
}
export {
  buildBatchFiscalData,
  buildTicketFiscalData,
  submit
};
//# sourceMappingURL=index.js.map