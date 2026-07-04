"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SFLR_NAMESPACE: () => SFLR_NAMESPACE,
  SF_NAMESPACE: () => SF_NAMESPACE,
  SOAP_MAX_RECORDS: () => SOAP_MAX_RECORDS,
  buildAnulacionRecord: () => buildAnulacionRecord,
  buildBatchInvoiceRecords: () => buildBatchInvoiceRecords,
  buildInvoiceRecord: () => buildInvoiceRecord,
  centsToImporte: () => centsToImporte,
  wrapForSoap: () => wrapForSoap
});
module.exports = __toCommonJS(index_exports);

// src/hash.ts
var t = (v) => v.trim();
function buildAltaHashInput(i) {
  return [
    `IDEmisorFactura=${t(i.idEmisorFactura)}`,
    `NumSerieFactura=${t(i.numSerieFactura)}`,
    `FechaExpedicionFactura=${t(i.fechaExpedicionFactura)}`,
    `TipoFactura=${t(i.tipoFactura)}`,
    `CuotaTotal=${t(i.cuotaTotal)}`,
    `ImporteTotal=${t(i.importeTotal)}`,
    `Huella=${t(i.huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${t(i.fechaHoraHusoGenRegistro)}`
  ].join("&");
}
function buildAnulacionHashInput(i) {
  return [
    `IDEmisorFacturaAnulada=${t(i.idEmisorFacturaAnulada)}`,
    `NumSerieFacturaAnulada=${t(i.numSerieFacturaAnulada)}`,
    `FechaExpedicionFacturaAnulada=${t(i.fechaExpedicionFacturaAnulada)}`,
    `Huella=${t(i.huellaAnterior)}`,
    `FechaHoraHusoGenRegistro=${t(i.fechaHoraHusoGenRegistro)}`
  ].join("&");
}
async function computeHash(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

// src/qr.ts
var AEAT_QR_BASE_PROD = "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR";
var AEAT_QR_BASE_TEST = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR";
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
var SF_NAMESPACE = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";
var SFLR_NAMESPACE = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
function escapeXml(s) {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function destinatariosXml(d) {
  return `<Destinatarios><IDDestinatario><NombreRazon>${escapeXml(d.nombre)}</NombreRazon><NIF>${escapeXml(d.nif)}</NIF></IDDestinatario></Destinatarios>`;
}
function encadenamientoXml(prev) {
  if (prev === null) {
    return `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;
  }
  return `<Encadenamiento><RegistroAnterior><IDEmisorFactura>${escapeXml(prev.idEmisor)}</IDEmisorFactura><NumSerieFactura>${escapeXml(prev.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(prev.fecha)}</FechaExpedicionFactura><Huella>${escapeXml(prev.huella)}</Huella></RegistroAnterior></Encadenamiento>`;
}
function desgloseXml(lines) {
  const detalles = lines.map(
    (l) => `<DetalleDesglose><ClaveRegimen>${escapeXml(l.claveRegimen ?? "01")}</ClaveRegimen><CalificacionOperacion>${escapeXml(l.calificacionOperacion ?? "S1")}</CalificacionOperacion><TipoImpositivo>${escapeXml(l.tipoImpositivo)}</TipoImpositivo><BaseImponibleOimporteNoSujeto>${escapeXml(l.baseImponible)}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${escapeXml(l.cuotaRepercutida)}</CuotaRepercutida></DetalleDesglose>`
  ).join("");
  return `<Desglose>${detalles}</Desglose>`;
}
function sistemaInformaticoXml(s) {
  return `<SistemaInformatico><NombreRazon>${escapeXml(s.nombreRazon)}</NombreRazon><NIF>${escapeXml(s.nif)}</NIF><NombreSistemaInformatico>${escapeXml(s.nombreSistema)}</NombreSistemaInformatico><IdSistemaInformatico>${escapeXml(s.id)}</IdSistemaInformatico><Version>${escapeXml(s.version)}</Version><NumeroInstalacion>${escapeXml(s.numeroInstalacion)}</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico>`;
}
function buildRegistroAltaXml(i) {
  const destinatarios = i.destinatario ? destinatariosXml(i.destinatario) : "";
  return `<RegistroAlta xmlns="${SF_NAMESPACE}"><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${escapeXml(i.nombreRazon)}</NombreRazonEmisor><TipoFactura>${escapeXml(i.tipoFactura)}</TipoFactura><DescripcionOperacion>${escapeXml(i.descripcion)}</DescripcionOperacion>` + destinatarios + desgloseXml(i.desgloseIva) + `<CuotaTotal>${escapeXml(i.cuotaTotal)}</CuotaTotal><ImporteTotal>${escapeXml(i.importeTotal)}</ImporteTotal>` + encadenamientoXml(i.registroAnterior) + sistemaInformaticoXml(i.sistema) + `<FechaHoraHusoGenRegistro>${escapeXml(i.fechaHoraGenRegistro)}</FechaHoraHusoGenRegistro><TipoHuella>01</TipoHuella><Huella>${escapeXml(i.hash)}</Huella></RegistroAlta>`;
}
function buildRegistroAnulacionXml(i) {
  return `<RegistroAnulacion xmlns="${SF_NAMESPACE}"><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFacturaAnulada>${escapeXml(i.nif)}</IDEmisorFacturaAnulada><NumSerieFacturaAnulada>${escapeXml(i.numSerieAnulada)}</NumSerieFacturaAnulada><FechaExpedicionFacturaAnulada>${escapeXml(i.fechaAnulada)}</FechaExpedicionFacturaAnulada></IDFactura>` + encadenamientoXml(i.registroAnterior) + sistemaInformaticoXml(i.sistema) + `<FechaHoraHusoGenRegistro>${escapeXml(i.fechaHoraGenRegistro)}</FechaHoraHusoGenRegistro><TipoHuella>01</TipoHuella><Huella>${escapeXml(i.hash)}</Huella></RegistroAnulacion>`;
}
var SOAP_MAX_RECORDS = 1e3;
function wrapForSoap(records, cabecera) {
  if (records.length === 0) {
    throw new Error("wrapForSoap: records must not be empty");
  }
  if (records.length > SOAP_MAX_RECORDS) {
    throw new Error(`wrapForSoap: max ${SOAP_MAX_RECORDS} records per env\xEDo (got ${records.length})`);
  }
  const registros = records.map((r) => `<sfLR:RegistroFactura>${r}</sfLR:RegistroFactura>`).join("");
  return `<sfLR:RegFactuSistemaFacturacion xmlns:sfLR="${SFLR_NAMESPACE}" xmlns:sf="${SF_NAMESPACE}"><sfLR:Cabecera><sf:ObligadoEmision><sf:NombreRazon>${escapeXml(cabecera.obligado.nombreRazon)}</sf:NombreRazon><sf:NIF>${escapeXml(cabecera.obligado.nif)}</sf:NIF></sf:ObligadoEmision></sfLR:Cabecera>` + registros + `</sfLR:RegFactuSistemaFacturacion>`;
}

// src/index.ts
function centsToImporte(cents) {
  if (!Number.isInteger(cents)) {
    throw new Error(`centsToImporte: expected integer cents, got ${cents}`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  return `${sign}${euros}.${dec}`;
}
var FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function formatFecha(d) {
  if (typeof d === "string") {
    if (!FECHA_ISO_RE.test(d)) {
      throw new Error(`Invalid fecha: expected 'YYYY-MM-DD' string or Date, got '${d}'`);
    }
    const [yyyy2, mm2, dd2] = d.split("-");
    return `${dd2}-${mm2}-${yyyy2}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
var FECHA_HORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2}|Z)$/;
function resolveFechaHora(value) {
  if (value === void 0) return formatFechaHora(/* @__PURE__ */ new Date());
  if (typeof value === "string") {
    if (!FECHA_HORA_RE.test(value)) {
      throw new Error(
        `Invalid fechaHoraGenRegistro: must be ISO 8601 with offset (e.g. 2026-01-01T12:00:00+01:00), got '${value}'`
      );
    }
    return value;
  }
  return formatFechaHora(value);
}
function formatFechaHora(d) {
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mn = String(Math.abs(offset) % 60).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4);
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`;
}
var HUELLA_RE = /^[0-9A-F]{64}$/;
var IMPORTE_RE = /^-?\d{1,12}\.\d{2}$/;
var TIPO_IMPOSITIVO_RE = /^\d{1,2}(\.\d{1,2})?$/;
function assertImporte(value, field) {
  if (!IMPORTE_RE.test(value)) {
    throw new Error(`Invalid ${field}: expected string with dot and 2 decimals (e.g. '12.60'), got '${value}'`);
  }
}
function assertConfig(config) {
  if (config.softwareId.length > 2) {
    throw new Error(
      `Invalid softwareId '${config.softwareId}': IdSistemaInformatico is limited to 2 characters by the AEAT schema (TextMax2Type)`
    );
  }
}
function assertChain(esPrimerRegistro, registroAnterior) {
  if (esPrimerRegistro && registroAnterior !== void 0) {
    throw new Error("Invalid chain input: first record must not have registroAnterior");
  }
  if (!esPrimerRegistro) {
    if (registroAnterior === void 0) {
      throw new Error("Invalid chain input: non-first record requires registroAnterior");
    }
    if (!HUELLA_RE.test(registroAnterior.huella)) {
      throw new Error("Invalid chain input: registroAnterior.huella must be uppercase 64-char hex");
    }
  }
}
function resolveRegistroAnterior(config, ref) {
  if (ref === void 0) return null;
  return {
    idEmisor: ref.idEmisor ?? config.nif,
    numSerie: ref.numSerie,
    fecha: formatFecha(ref.fecha),
    huella: ref.huella
  };
}
function sistemaFromConfig(config) {
  return {
    nombreRazon: config.softwareNombre,
    nif: config.softwareNif,
    nombreSistema: config.softwareNombre,
    id: config.softwareId,
    version: config.softwareVersion,
    numeroInstalacion: config.numeroInstalacion ?? "1"
  };
}
async function buildInvoiceRecord(input) {
  assertConfig(input.config);
  assertChain(input.esPrimerRegistro, input.registroAnterior);
  assertImporte(input.cuotaTotal, "cuotaTotal");
  assertImporte(input.importeTotal, "importeTotal");
  if (input.desgloseIva.length === 0) {
    throw new Error("Invalid desgloseIva: must contain at least one line (XSD requires >=1 DetalleDesglose)");
  }
  for (const line of input.desgloseIva) {
    assertImporte(line.baseImponible, "desgloseIva.baseImponible");
    assertImporte(line.cuotaRepercutida, "desgloseIva.cuotaRepercutida");
    if (!TIPO_IMPOSITIVO_RE.test(line.tipoImpositivo)) {
      throw new Error(`Invalid desgloseIva.tipoImpositivo: got '${line.tipoImpositivo}'`);
    }
  }
  const tipoFactura = input.tipoFactura ?? (input.destinatario ? "F1" : "F2");
  if (tipoFactura === "F1" && input.destinatario === void 0) {
    throw new Error("Invalid input: tipoFactura F1 requires destinatario");
  }
  if (tipoFactura === "F2" && input.destinatario !== void 0) {
    throw new Error("Invalid input: tipoFactura F2 must not have destinatario");
  }
  const fecha = formatFecha(input.fecha);
  const fechaHoraGenRegistro = resolveFechaHora(input.fechaHoraGenRegistro);
  const hash = await computeHash(
    buildAltaHashInput({
      idEmisorFactura: input.config.nif,
      numSerieFactura: input.numSerie,
      fechaExpedicionFactura: fecha,
      tipoFactura,
      cuotaTotal: input.cuotaTotal,
      importeTotal: input.importeTotal,
      huellaAnterior: input.registroAnterior?.huella ?? "",
      fechaHoraHusoGenRegistro: fechaHoraGenRegistro
    })
  );
  const xmlInput = {
    nif: input.config.nif,
    nombreRazon: input.config.nombreRazon,
    sistema: sistemaFromConfig(input.config),
    numSerie: input.numSerie,
    fecha,
    fechaHoraGenRegistro,
    tipoFactura,
    descripcion: input.descripcion,
    desgloseIva: input.desgloseIva,
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    registroAnterior: resolveRegistroAnterior(input.config, input.registroAnterior),
    hash,
    ...input.destinatario !== void 0 ? { destinatario: input.destinatario } : {}
  };
  const qrUrl = buildQrUrl({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    importeTotal: input.importeTotal,
    testMode: input.config.testMode ?? false
  });
  return { hash, xml: buildRegistroAltaXml(xmlInput), qrUrl, fechaHoraGenRegistro };
}
async function buildAnulacionRecord(input) {
  assertConfig(input.config);
  assertChain(input.esPrimerRegistro, input.registroAnterior);
  const fechaAnulada = formatFecha(input.fechaAnulada);
  const fechaHoraGenRegistro = resolveFechaHora(input.fechaHoraGenRegistro);
  const hash = await computeHash(
    buildAnulacionHashInput({
      idEmisorFacturaAnulada: input.config.nif,
      numSerieFacturaAnulada: input.numSerieAnulada,
      fechaExpedicionFacturaAnulada: fechaAnulada,
      huellaAnterior: input.registroAnterior?.huella ?? "",
      fechaHoraHusoGenRegistro: fechaHoraGenRegistro
    })
  );
  const xml = buildRegistroAnulacionXml({
    nif: input.config.nif,
    sistema: sistemaFromConfig(input.config),
    numSerieAnulada: input.numSerieAnulada,
    fechaAnulada,
    fechaHoraGenRegistro,
    registroAnterior: resolveRegistroAnterior(input.config, input.registroAnterior),
    hash
  });
  return { hash, xml, fechaHoraGenRegistro };
}
async function buildBatchInvoiceRecords(inputs, startingRef) {
  let currentRef = startingRef;
  const results = [];
  for (const input of inputs) {
    const result = await buildInvoiceRecord({
      ...input,
      esPrimerRegistro: currentRef === null,
      ...currentRef !== null ? { registroAnterior: currentRef } : {}
    });
    results.push(result);
    currentRef = { numSerie: input.numSerie, fecha: input.fecha, huella: result.hash };
  }
  return { results, lastRef: currentRef };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SFLR_NAMESPACE,
  SF_NAMESPACE,
  SOAP_MAX_RECORDS,
  buildAnulacionRecord,
  buildBatchInvoiceRecords,
  buildInvoiceRecord,
  centsToImporte,
  wrapForSoap
});
//# sourceMappingURL=index.cjs.map