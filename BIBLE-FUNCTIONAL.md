# BIBLE-FUNCTIONAL — verifactu-js

> Documento de referencia funcional. Describe QUÉ hace la librería, para quién y con qué reglas de negocio. No contiene código. Destino: desarrolladores que integren o mantengan la librería.

---

## 1. Contexto legal

**Real Decreto 1007/2023** (Reglamento Veri*Factu) obliga a los sistemas informáticos de facturación españoles a generar un registro verificable por la AEAT para cada factura emitida. El mecanismo se llama **VERI*FACTU** y consiste en:

1. Calcular un hash SHA-256 encadenado con el registro anterior (cadena de bloques simplificada).
2. Generar un XML `RegistroFacturacion` con los datos fiscales y el hash.
3. Incluir un QR en el documento impreso que enlaza al portal de verificación de la AEAT.
4. (Opcional en la fase actual) Enviar el XML firmado a la AEAT vía SOAP.

`verifactu-js` implementa los pasos 1, 2 y 3. El paso 4 (envío SOAP con certificado .p12) queda fuera del alcance de esta librería y es responsabilidad de la Cloud Function del sistema que la integre.

---

## 2. Qué hace esta librería

Dada la información de una factura, produce tres artefactos:

| Artefacto | Descripción |
|-----------|-------------|
| `hash` | Cadena hex de 64 caracteres (SHA-256) encadenada con el hash del registro anterior |
| `xml` | XML `<RegistroFacturacion>` v1.0 listo para firmar y enviar a la AEAT |
| `qrUrl` | URL de verificación AEAT (prod o pre-prod según `testMode`) |

Estos artefactos se almacenan en el ticket/factura y se usan para:
- Imprimir el QR en el documento físico (papel o pantalla).
- Enviar el XML firmado a la AEAT cuando esté disponible el certificado .p12.
- Cumplir el requisito de cadena de hashes auditable.

**La librería NO envía nada a la AEAT.** No hay función `submit()`, no hay cliente SOAP, no hay mock de envío. El envío es responsabilidad del sistema integrador (Cloud Function en el caso de `pallaresa-tpv`).

### Flag `testMode`

`VerifactuConfig.testMode: boolean` (default `false`) controla el entorno:

| | Producción (`false`) | Pre-producción (`true`) |
|---|---|---|
| `qrUrl` base | `www2.agenciatributaria.gob.es` | `prewww2.aeat.es` |
| XML | idéntico | idéntico |
| SOAP endpoint (CF) | `www1.agenciatributaria.gob.es/…/VerifactuSOAP` | `prewww1.aeat.es/…/VerifactuSOAP` |

El XML no cambia entre entornos. La distinción test/prod en el protocolo SOAP la hace la Cloud Function eligiendo el endpoint correcto.

---

## 3. Casos de uso

### 3.1 TPV de caja (pallaresa-tpv)

**En cada cobro (offline-first):** `issueTicket()` llama a `buildTicketFiscalData()` pasando el hash del ticket anterior almacenado en `tpv_config/main.lastHash`. El resultado (`hash`, `xml`, `qrUrl`) se guarda en `tpv_tickets/{id}` con `aeatStatus: 'pending'`. La cadena de hashes se actualiza en Firestore dentro de una transacción atómica.

**En el batch periódico (Cloud Function ~30 min):** la CF usa `buildBatchFiscalData()` si necesita recalcular la cadena para tickets que aún no tienen hash, pasando `tpv_config/main.lastHash` como `startingHash`. Guarda el `lastHash` resultante de vuelta en Firestore. El XML firmado se envía al endpoint SOAP de la AEAT.

### 3.2 Facturas de EasyFichi

Las facturas emitidas desde EasyFichi pueden ser:
- **F2** (al consumidor final): sin `destinatario` en `FiscalInput`.
- **F1** (B2B): pasar `destinatario: { nif, nombre }` cuando la factura tenga `terceroId`/`terceroCif`. La librería incluirá automáticamente el bloque `<Destinatarios>` en el XML y usará `TipoFactura=F1` en el hash.

La Cloud Function de facturación llama a `buildTicketFiscalData()` en Node.js usando el módulo CJS (`require('verifactu-js')`).

La cadena de hashes de EasyFichi es **independiente** de la cadena del TPV — son dos sistemas de facturación distintos con sus propias series.

---

## 4. Alcance y limitaciones

### Lo que cubre
- Facturas simplificadas tipo **F2** (tickets de caja, facturas al consumidor final, sin datos del destinatario).
- Facturas completas tipo **F1** (B2B con datos del destinatario: NIF + razón social). Pasar `destinatario` en `FiscalInput` activa automáticamente F1; omitirlo produce F2. La API es backward-compatible.
- Cadena hash SHA-256 con la concatenación exacta exigida por el RD 1007/2023 (el `TipoFactura` entra en el hash, por lo que F1 y F2 producen hashes distintos).
- XML `RegistroFacturacion` versión 1.0 con bloque `<Destinatarios>` en F1.
- URL QR del portal de verificación de la AEAT (idéntica para F1 y F2).

### Lo que NO cubre
- Firma XML con certificado .p12 — responsabilidad de la Cloud Function integradora.
- Comunicación SOAP con los endpoints de la AEAT — ídem. No hay `submit()`.
- Mock de envío AEAT — el integrador implementa su propio mock si lo necesita.
- Rectificativas (tipo R1–R5) — no implementadas.
- Validación de NIF/CIF — la librería confía en que los datos de entrada son correctos.

---

## 5. Política de versioning

Los cambios en el algoritmo de hash o en el formato XML son **cambios fiscales** y deben tratarse con la máxima precaución:

- Cualquier cambio que afecte al output del hash o del XML implica una versión mayor (`v2.0.0`).
- Los sistemas integradores deben actualizar el tag explícitamente (`#v2.0.0`) — nunca usar `main` ni un rango semver automático.
- Antes de actualizar en producción: verificar que los hashes generados con la nueva versión son aceptados por el validador de la AEAT.

---

## 6. Formatos de datos de entrada

| Campo | Formato | Ejemplo |
|-------|---------|---------|
| `fecha` | Calculado internamente desde `Date` | — |
| `cuotaTotal` | String decimal, separador punto, 2 decimales | `"1.05"` |
| `importeTotal` | String decimal, separador punto, 2 decimales | `"12.60"` |
| `desgloseIva[].tipoImpositivo` | String porcentaje sin símbolo | `"10"` |
| `desgloseIva[].baseImponible` | String decimal, 2 decimales | `"11.55"` |
| `desgloseIva[].cuotaRepercutida` | String decimal, 2 decimales | `"1.05"` |
| `previousHash` | Hex 64 chars del registro anterior, o `""` si es el primero | `"a3f2..."` o `""` |
| `esPrimerRegistro` | `true` solo para el primer registro de la cadena | `false` |

**Importante:** los importes son strings, no numbers, para evitar errores de redondeo flotante. El sistema integrador es responsable de formatearlos correctamente antes de llamar a la librería.
