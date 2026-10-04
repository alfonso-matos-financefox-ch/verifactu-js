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
  CODIGOS_PAIS_XSD: () => CODIGOS_PAIS_XSD,
  DestinatarioError: () => DestinatarioError,
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
  const id = d.idOtro !== void 0 ? `<IDOtro><CodigoPais>${escapeXml(d.idOtro.codigoPais)}</CodigoPais><IDType>${escapeXml(d.idOtro.idType)}</IDType><ID>${escapeXml(d.idOtro.id)}</ID></IDOtro>` : `<NIF>${escapeXml(d.nif)}</NIF>`;
  return `<Destinatarios><IDDestinatario><NombreRazon>${escapeXml(d.nombre)}</NombreRazon>${id}</IDDestinatario></Destinatarios>`;
}
function idFacturaArListXml(bloque, item, list) {
  const ids = list.map(
    (f) => `<${item}><IDEmisorFactura>${escapeXml(f.idEmisor)}</IDEmisorFactura><NumSerieFactura>${escapeXml(f.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(f.fecha)}</FechaExpedicionFactura></${item}>`
  ).join("");
  return `<${bloque}>${ids}</${bloque}>`;
}
function importeRectificacionXml(r) {
  const recargo = r.cuotaRecargoRectificado !== void 0 ? `<CuotaRecargoRectificado>${escapeXml(r.cuotaRecargoRectificado)}</CuotaRecargoRectificado>` : "";
  return `<ImporteRectificacion><BaseRectificada>${escapeXml(r.baseRectificada)}</BaseRectificada><CuotaRectificada>${escapeXml(r.cuotaRectificada)}</CuotaRectificada>` + recargo + `</ImporteRectificacion>`;
}
function rectificacionYSustitucionXml(i) {
  return (i.tipoRectificativa ? `<TipoRectificativa>${escapeXml(i.tipoRectificativa)}</TipoRectificativa>` : "") + (i.facturasRectificadas?.length ? idFacturaArListXml("FacturasRectificadas", "IDFacturaRectificada", i.facturasRectificadas) : "") + (i.facturasSustituidas?.length ? idFacturaArListXml("FacturasSustituidas", "IDFacturaSustituida", i.facturasSustituidas) : "") + (i.importeRectificacion ? importeRectificacionXml(i.importeRectificacion) : "");
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
  return `<RegistroAlta xmlns="${SF_NAMESPACE}"><IDVersion>1.0</IDVersion><IDFactura><IDEmisorFactura>${escapeXml(i.nif)}</IDEmisorFactura><NumSerieFactura>${escapeXml(i.numSerie)}</NumSerieFactura><FechaExpedicionFactura>${escapeXml(i.fecha)}</FechaExpedicionFactura></IDFactura><NombreRazonEmisor>${escapeXml(i.nombreRazon)}</NombreRazonEmisor><TipoFactura>${escapeXml(i.tipoFactura)}</TipoFactura>` + rectificacionYSustitucionXml(i) + `<DescripcionOperacion>${escapeXml(i.descripcion)}</DescripcionOperacion>` + destinatarios + desgloseXml(i.desgloseIva) + `<CuotaTotal>${escapeXml(i.cuotaTotal)}</CuotaTotal><ImporteTotal>${escapeXml(i.importeTotal)}</ImporteTotal>` + encadenamientoXml(i.registroAnterior) + sistemaInformaticoXml(i.sistema) + `<FechaHoraHusoGenRegistro>${escapeXml(i.fechaHoraGenRegistro)}</FechaHoraHusoGenRegistro><TipoHuella>01</TipoHuella><Huella>${escapeXml(i.hash)}</Huella></RegistroAlta>`;
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

// src/paises.ts
var CODIGOS_PAIS_XSD = /* @__PURE__ */ new Set([
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "QU",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "XB",
  "XG",
  "XN",
  "XU",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW"
]);

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
    // Productor del software. El fallback a softwareNombre reproduce el
    // comportamiento (erroneo) de <= 2.0.1 para no romper a quien no lo pase.
    nombreRazon: config.softwareNombreRazon ?? config.softwareNombre,
    nif: config.softwareNif,
    nombreSistema: config.softwareNombre,
    id: config.softwareId,
    version: config.softwareVersion,
    numeroInstalacion: config.numeroInstalacion ?? "1"
  };
}
var DestinatarioError = class extends Error {
  code;
  constructor(code, message) {
    super(`Invalid destinatario: ${message}`);
    this.name = "DestinatarioError";
    this.code = code;
  }
};
var ID_TYPES_OTRO = /* @__PURE__ */ new Set(["02", "03", "04", "05", "06", "07"]);
function assertDestinatario(d, tipoFactura) {
  const raw = d;
  if (raw.nif !== void 0 && raw.idOtro !== void 0) {
    throw new DestinatarioError("NIF_E_IDOTRO", "pass either nif or idOtro, not both");
  }
  if (raw.nif === void 0 && raw.idOtro === void 0) {
    throw new DestinatarioError("SIN_IDENTIFICACION", "requires nif (Spanish NIF) or idOtro");
  }
  if (d.idOtro === void 0) return;
  if (typeof d.nombre !== "string" || d.nombre.trim() === "" || d.nombre.length > 120) {
    throw new DestinatarioError("NOMBRE", `nombre must be 1-120 chars (TextMax120Type), got '${String(d.nombre)}'`);
  }
  const { codigoPais, idType, id } = d.idOtro;
  if (typeof codigoPais !== "string" || !CODIGOS_PAIS_XSD.has(codigoPais)) {
    throw new DestinatarioError(
      "CODIGO_PAIS",
      `idOtro.codigoPais must be an ISO 3166-1 alpha-2 code from the AEAT CountryType2 list, got '${String(codigoPais)}'`
    );
  }
  if (typeof idType !== "string" || !ID_TYPES_OTRO.has(idType)) {
    throw new DestinatarioError("ID_TYPE", `idOtro.idType must be '02'..'07', got '${String(idType)}'`);
  }
  if (typeof id !== "string" || id.trim() === "" || id.length > 20) {
    throw new DestinatarioError("ID", `idOtro.id must be 1-20 chars (TextMax20Type), got '${String(id)}'`);
  }
  assertCombinacionIdOtro(d.idOtro, tipoFactura);
}
var NIF_IVA_UE = {
  DE: { prefijo: "DE", cuerpo: /^\d{9}$/ },
  AT: { prefijo: "AT", cuerpo: /^[A-Z0-9]{9}$/ },
  BE: { prefijo: "BE", cuerpo: /^\d{10}$/ },
  CY: { prefijo: "CY", cuerpo: /^[A-Z0-9]{9}$/ },
  CZ: { prefijo: "CZ", cuerpo: /^\d{8,10}$/ },
  HR: { prefijo: "HR", cuerpo: /^\d{11}$/ },
  DK: { prefijo: "DK", cuerpo: /^\d{8}$/ },
  SK: { prefijo: "SK", cuerpo: /^\d{10}$/ },
  SI: { prefijo: "SI", cuerpo: /^\d{8}$/ },
  EE: { prefijo: "EE", cuerpo: /^\d{9}$/ },
  FI: { prefijo: "FI", cuerpo: /^\d{8}$/ },
  FR: { prefijo: "FR", cuerpo: /^[A-Z0-9]{11}$/ },
  GR: { prefijo: "EL", cuerpo: /^\d{9}$/ },
  NL: { prefijo: "NL", cuerpo: /^[A-Z0-9]{12}$/ },
  HU: { prefijo: "HU", cuerpo: /^\d{8}$/ },
  IT: { prefijo: "IT", cuerpo: /^\d{11}$/ },
  IE: { prefijo: "IE", cuerpo: /^[A-Z0-9]{8,9}$/ },
  LV: { prefijo: "LV", cuerpo: /^\d{11}$/ },
  LT: { prefijo: "LT", cuerpo: /^(\d{9}|\d{12})$/ },
  LU: { prefijo: "LU", cuerpo: /^\d{8}$/ },
  MT: { prefijo: "MT", cuerpo: /^\d{8}$/ },
  PL: { prefijo: "PL", cuerpo: /^\d{10}$/ },
  PT: { prefijo: "PT", cuerpo: /^\d{9}$/ },
  SE: { prefijo: "SE", cuerpo: /^\d{12}$/ },
  BG: { prefijo: "BG", cuerpo: /^\d{9,10}$/ },
  RO: { prefijo: "RO", cuerpo: /^[1-9]\d{1,9}$/ }
};
var LETRAS_NIF = "TRWAGMYFPDXBNJZSQVHLCKE";
function esNifPersonaFisica(id) {
  const m = /^([0-9XYZ])(\d{7})([A-Z])$/.exec(id);
  if (!m) return false;
  const [, primero, cifras, letra] = m;
  const nie = "XYZ".indexOf(primero);
  return LETRAS_NIF[Number((nie >= 0 ? String(nie) : primero) + cifras) % 23] === letra;
}
function assertCombinacionIdOtro(o, tipoFactura) {
  if (o.codigoPais === "ES" && o.idType !== "03" && o.idType !== "07") {
    throw new DestinatarioError(
      "COMBINACION",
      `codigoPais ES only allows idType '03' (pasaporte) or '07' (no censado), got '${o.idType}' (AEAT 1234); a Spanish taxpayer goes with nif`
    );
  }
  if (o.idType === "07") {
    if (o.codigoPais !== "ES") {
      throw new DestinatarioError("COMBINACION", `idType '07' (no censado) requires codigoPais ES, got '${o.codigoPais}' (AEAT 1126)`);
    }
    if (!esNifPersonaFisica(o.id)) {
      throw new DestinatarioError("COMBINACION", `idType '07' requires id to be a valid NIF of a natural person, got '${o.id}' (AEAT 1131)`);
    }
  }
  if (o.idType === "02") {
    const reglas = NIF_IVA_UE[o.codigoPais];
    if (reglas === void 0) {
      throw new DestinatarioError(
        "COMBINACION",
        `idType '02' (NIF-IVA) only for EU member states other than ES, got codigoPais '${o.codigoPais}'; use '04' or '06' for non-EU customers`
      );
    }
    if (!o.id.startsWith(reglas.prefijo) || !reglas.cuerpo.test(o.id.slice(2))) {
      throw new DestinatarioError(
        "COMBINACION",
        `idType '02' requires an uppercase ${o.codigoPais} VAT number starting with '${reglas.prefijo}', got '${o.id}' (AEAT 1122 / nota (1))`
      );
    }
  }
  if (tipoFactura === "R3" && o.idType !== "07") {
    throw new DestinatarioError("TIPO_FACTURA", `tipoFactura R3 only allows nif or idType '07', got '${o.idType}' (AEAT 1191)`);
  }
  if (tipoFactura === "R2" && o.idType !== "02" && o.idType !== "07") {
    throw new DestinatarioError("TIPO_FACTURA", `tipoFactura R2 only allows nif or idType '02'/'07', got '${o.idType}' (AEAT 1192)`);
  }
}
var TIPOS_RECTIFICATIVA = /* @__PURE__ */ new Set(["R1", "R2", "R3", "R4", "R5"]);
var TIPOS_SIN_DESTINATARIO = /* @__PURE__ */ new Set(["F2", "R5"]);
function resolveRectificacion(input, tipoFactura) {
  const { tipoRectificativa, facturasRectificadas, importeRectificacion } = input;
  if (!TIPOS_RECTIFICATIVA.has(tipoFactura)) {
    if (tipoRectificativa !== void 0) {
      throw new Error(`Invalid input: tipoRectificativa only allowed with tipoFactura R1-R5 (got ${tipoFactura})`);
    }
    if (facturasRectificadas !== void 0 && facturasRectificadas.length > 0) {
      throw new Error(`Invalid input: facturasRectificadas only allowed with tipoFactura R1-R5 (got ${tipoFactura})`);
    }
    if (importeRectificacion !== void 0) {
      throw new Error(`Invalid input: importeRectificacion only allowed with tipoRectificativa S (got ${tipoFactura})`);
    }
    return {};
  }
  if (tipoRectificativa !== "S" && tipoRectificativa !== "I") {
    throw new Error(`Invalid input: tipoFactura ${tipoFactura} requires tipoRectificativa 'S' or 'I'`);
  }
  if (tipoRectificativa === "S" && importeRectificacion === void 0) {
    throw new Error("Invalid input: tipoRectificativa S requires importeRectificacion");
  }
  if (tipoRectificativa === "I" && importeRectificacion !== void 0) {
    throw new Error("Invalid input: importeRectificacion only allowed with tipoRectificativa S");
  }
  if (importeRectificacion !== void 0) {
    assertImporte(importeRectificacion.baseRectificada, "importeRectificacion.baseRectificada");
    assertImporte(importeRectificacion.cuotaRectificada, "importeRectificacion.cuotaRectificada");
    if (importeRectificacion.cuotaRecargoRectificado !== void 0) {
      assertImporte(importeRectificacion.cuotaRecargoRectificado, "importeRectificacion.cuotaRecargoRectificado");
    }
  }
  const list = facturasRectificadas ?? [];
  if (list.length > 1e3) {
    throw new Error("Invalid input: facturasRectificadas max 1000 (XSD maxOccurs)");
  }
  const rectificadas = list.map((f) => {
    if (!f.numSerie || f.numSerie.length > 60) {
      throw new Error(`Invalid facturasRectificadas.numSerie: got '${f.numSerie}' (1-60 chars)`);
    }
    return { idEmisor: f.idEmisor ?? input.config.nif, numSerie: f.numSerie, fecha: formatFecha(f.fecha) };
  });
  return {
    tipoRectificativa,
    ...rectificadas.length > 0 ? { facturasRectificadas: rectificadas } : {},
    ...importeRectificacion !== void 0 ? { importeRectificacion } : {}
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
  if (TIPOS_SIN_DESTINATARIO.has(tipoFactura)) {
    if (input.destinatario !== void 0) {
      throw new Error(`Invalid input: tipoFactura ${tipoFactura} must not have destinatario`);
    }
  } else if (input.destinatario === void 0) {
    throw new Error(`Invalid input: tipoFactura ${tipoFactura} requires destinatario`);
  } else {
    assertDestinatario(input.destinatario, tipoFactura);
  }
  if (tipoFactura === "F3") {
    if (!input.facturasSustituidas || input.facturasSustituidas.length === 0) {
      throw new Error("Invalid input: tipoFactura F3 requires facturasSustituidas (>=1)");
    }
    if (input.facturasSustituidas.length > 1e3) {
      throw new Error("Invalid input: facturasSustituidas max 1000 (XSD maxOccurs)");
    }
  } else if (input.facturasSustituidas !== void 0 && input.facturasSustituidas.length > 0) {
    throw new Error(`Invalid input: facturasSustituidas only allowed with tipoFactura F3 (got ${tipoFactura})`);
  }
  const facturasSustituidas = (input.facturasSustituidas ?? []).map((f) => {
    if (!f.numSerie || f.numSerie.length > 60) {
      throw new Error(`Invalid facturasSustituidas.numSerie: got '${f.numSerie}' (1-60 chars)`);
    }
    return { idEmisor: f.idEmisor ?? input.config.nif, numSerie: f.numSerie, fecha: formatFecha(f.fecha) };
  });
  const rectificacion = resolveRectificacion(input, tipoFactura);
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
    ...input.destinatario !== void 0 ? { destinatario: input.destinatario } : {},
    ...facturasSustituidas.length > 0 ? { facturasSustituidas } : {},
    ...rectificacion
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
  CODIGOS_PAIS_XSD,
  DestinatarioError,
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