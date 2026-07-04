# BIBLE-FUNCTIONAL — verifactu-js

> Documento de referencia funcional. Describe QUÉ hace la librería, para quién y con qué reglas de negocio. No contiene código. Destino: desarrolladores que integren o mantengan la librería.

> **v2.0.0 (2026-07-04):** conformidad verificada contra los documentos técnicos oficiales de AEAT
> (huella v0.1.2, QR v0.5.0, XSD SuministroInformacion/SuministroLR). Ver `CHANGELOG.md`.

---

## 1. Contexto legal

**Real Decreto 1007/2023** (Reglamento Veri*Factu), desarrollado por la **Orden HAC/1177/2024** y los
documentos técnicos de AEAT, obliga a los sistemas informáticos de facturación españoles a generar un
registro verificable por la AEAT para cada factura emitida:

1. Calcular un hash SHA-256 encadenado con el registro anterior.
2. Generar un XML `RegistroAlta` (o `RegistroAnulacion`) conforme al XSD `SuministroInformacion.xsd`.
3. Incluir un QR en el documento impreso que enlaza al servicio de cotejo de la AEAT.
4. (Sistemas VERI*FACTU) Enviar los registros a la AEAT vía SOAP.

`verifactu-js` implementa los pasos 1, 2 y 3, más el payload de envío (`wrapForSoap`). El transporte
SOAP, el certificado y la firma quedan fuera del alcance y son responsabilidad del integrador.

---

## 2. Qué hace esta librería

Dada la información de una factura, produce estos artefactos:

| Artefacto | Descripción |
|-----------|-------------|
| `hash` | Hex 64 chars MAYÚSCULAS (SHA-256), encadenado según el doc oficial de huella |
| `xml` | `<RegistroAlta>` (o `<RegistroAnulacion>`) que valida contra el XSD oficial |
| `qrUrl` | URL del servicio de cotejo AEAT `TIKE-CONT/ValidarQR` (prod o pre según `testMode`) |
| `fechaHoraGenRegistro` | Instante de generación usado en el hash — **debe persistirse** |

**La librería NO envía nada a la AEAT.** `wrapForSoap` produce el payload `RegFactuSistemaFacturacion`,
pero el envío (endpoint, mTLS, firma) es del sistema integrador.

### Flag `testMode`

| | Producción (`false`) | Pre-producción (`true`) |
|---|---|---|
| `qrUrl` base | `www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR` | `prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR` |
| XML | idéntico | idéntico |
| SOAP endpoint (CF) | `www1.agenciatributaria.gob.es/…/VerifactuSOAP` | `prewww1.aeat.es/…/VerifactuSOAP` |

El XML no cambia entre entornos; la distinción test/prod en SOAP la hace la Cloud Function con el endpoint.

---

## 3. Casos de uso

### 3.1 TPV de caja (pallaresa-tpv)

**En cada cobro (offline-first):** `issueTicket()` llama a `buildInvoiceRecord()` pasando
`registroAnterior` (numSerie + fecha + huella del último ticket, persistidos en `tpv_config/main`).
El resultado (`hash`, `xml`, `qrUrl`, `fechaHoraGenRegistro`) se guarda en `tpv_tickets/{id}`.

**En el batch periódico (Cloud Function ~30 min):** la CF puede usar `buildBatchInvoiceRecords()` con
el `lastRef` persistido, y `wrapForSoap()` para construir el payload del envío.

### 3.2 Facturas de EasyFichi

- **F2** (consumidor final): sin `destinatario`.
- **F1** (B2B): pasar `destinatario: { nif, nombre }`; la librería incluye `<Destinatarios>` y usa
  `TipoFactura=F1` en el hash. `descripcion` es obligatoria (cada cliente pasa la suya).
- **Anulaciones**: `buildAnulacionRecord()` consume un eslabón de la misma cadena.

La cadena de hashes de EasyFichi es **independiente por empresa** y de la cadena del TPV — cada
obligado tributario tiene su propia cadena. Requisito del integrador: leer y actualizar la referencia
`{numSerie, fecha, huella}` del último registro de forma **atómica** (transacción) para evitar
bifurcar la cadena con emisiones concurrentes.

---

## 4. Alcance y limitaciones

### Lo que cubre
- Facturas **F2** (simplificadas) y **F1** (B2B con destinatario NIF español).
- Registros de **anulación** con su fórmula de huella oficial.
- Cadena de huellas conforme al doc oficial AEAT (vectores oficiales en tests).
- XML conforme al XSD oficial (validación xmllint en CI) + payload `RegFactuSistemaFacturacion`.
- URL QR del servicio de cotejo oficial.

### Lo que NO cubre
- Firma XML y comunicación SOAP — responsabilidad del integrador.
- Rectificativas (R1–R5) — el XSD las contempla; previstas para v2.1 (`tipoFactura` + bloques
  `TipoRectificativa`/`FacturasRectificadas`/`ImporteRectificacion`).
- Destinatarios sin NIF español (`IDOtro` — pasaporte, VAT intracomunitario).
- Registros de evento (obligatorios solo para sistemas NO Verifactu).
- Validación de NIF/CIF — la librería confía en los datos del integrador (sí valida formatos:
  importes, huella, ISO 8601, longitud de `softwareId`).

---

## 5. Política de versioning

Los cambios en hash, XML o QR generados son **cambios fiscales**:

- Major bump obligatorio (los golden tests actúan de tripwire).
- Los integradores actualizan por tag explícito (`#v2.0.0`) — nunca `main` ni rangos semver.
- Un único mecanismo de distribución: `github:…#tag`. No vendorizar tarballs (causó que EasyFichi
  quedara en v1.1.0 sin F1 creyendo estar en v1.3.1).
- Todo cambio se anota en `CHANGELOG.md` con su sección de migración.

---

## 6. Formatos de datos de entrada

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| `fecha` | `Date` — la librería formatea DD-MM-YYYY | — |
| `fechaHoraGenRegistro` | `Date`, o string ISO 8601 **con huso** (validado) | `"2026-06-15T12:00:00+02:00"` |
| `cuotaTotal` / `importeTotal` / bases / cuotas | String, punto decimal, **exactamente 2 decimales** (validado) | `"12.60"` |
| `desgloseIva[].tipoImpositivo` | String porcentaje sin símbolo | `"10"` |
| `registroAnterior.huella` | Hex 64 chars **MAYÚSCULAS** (validado) | `"3C46…F60"` |
| `softwareId` | Máx. 2 caracteres (validado — límite del XSD) | `"PT"` |

**Importante:** los importes son strings para evitar redondeo flotante. Para clientes que trabajan en
centavos: `centsToImporte(1260) → '12.60'`. La validación de formato es estricta porque `'12.6'` y
`'12.60'` producen huellas distintas.
