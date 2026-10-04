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
  `TipoFactura=F1` en el hash. Cliente **sin NIF español** (v2.4.0): `destinatario: { nombre, idOtro:
  { codigoPais, idType, id } }` — p. ej. G2 Travel Ltd (Hong Kong) `HK`/`04`/n.º de registro, cliente francés
  con NIF-IVA `FR`/`02`/`FR…`, francés solo con SIRET `FR`/`04` o `06`. El IVA no cambia (restauración prestada
  en España); solo cambia la identificación. La huella y el QR no dependen del destinatario. `descripcion` es obligatoria (cada cliente pasa la suya).
- **F3** (v2.2.0, factura que sustituye tickets ya declarados — canje de simplificadas): `tipoFactura: 'F3'`
  + `destinatario` + `facturasSustituidas: [{ numSerie, fecha }]` (los tickets). Declararla como F1
  contaría el ingreso dos veces.
- **Rectificativas R1..R5** (v2.3.0): `tipoFactura: 'R1'..'R5'` + `tipoRectificativa` (`'I'` por diferencias,
  importes normalmente negativos; `'S'` por sustitución, con `importeRectificacion` = base y cuota de la
  original) + `facturasRectificadas: [{ numSerie, fecha }]` (opcional para la AEAT, recomendable). R1..R4
  llevan destinatario; R5 (rectificativa de un ticket) no. **No** emitir una rectificativa como F1 negativa.
- **Anulaciones**: `buildAnulacionRecord()` consume un eslabón de la misma cadena.

La cadena de hashes de EasyFichi es **independiente por empresa** y de la cadena del TPV — cada
obligado tributario tiene su propia cadena. Requisito del integrador: leer y actualizar la referencia
`{numSerie, fecha, huella}` del último registro de forma **atómica** (transacción) para evitar
bifurcar la cadena con emisiones concurrentes.

---

## 4. Alcance y limitaciones

### Lo que cubre
- Facturas **F2** (simplificadas), **F1** (B2B con destinatario NIF español o extranjero vía `IDOtro`, v2.4.0), **F3** (sustitución de simplificadas, v2.2.0)
  y **rectificativas R1..R5** (sustitución `S` o diferencias `I`, v2.3.0).
- Registros de **anulación** con su fórmula de huella oficial.
- Cadena de huellas conforme al doc oficial AEAT (vectores oficiales en tests).
- XML conforme al XSD oficial (validación xmllint en CI) + payload `RegFactuSistemaFacturacion`.
- URL QR del servicio de cotejo oficial.

### Lo que NO cubre
- Firma XML y comunicación SOAP — responsabilidad del integrador.
- Comprobar que un NIF-IVA (`IDOtro` 02) está dado de alta en VIES/censo (la AEAT lo exige; requiere
  conexión). Sí se valida su estructura por Estado miembro. Irlanda del Norte (`XI`) no está soportada.
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
