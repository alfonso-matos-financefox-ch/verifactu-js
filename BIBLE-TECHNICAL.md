# BIBLE-TECHNICAL — verifactu-js

> Documento de referencia técnico. Arquitectura, API pública, decisiones de diseño e invariantes. Destino: desarrolladores que mantengan o extiendan la librería.

> **v2.0.0 (2026-07-04):** reescritura de conformidad contra los docs técnicos oficiales de AEAT.
> Fuentes verificadas y detalle de divergencias v1→v2: `docs/superpowers/specs/2026-07-04-v2-conformidad-aeat.md`. Breaking changes: `CHANGELOG.md`.

---

## 1. Stack y entornos

| Aspecto | Valor |
|---------|-------|
| Lenguaje | TypeScript 5.x, `strict: true` |
| Build | `tsup` (esbuild) — dual ESM + CJS |
| Tests | Vitest 1.x, `environment: node`; validación XSD con `xmllint` (se omite si no está instalado) |
| Runtime mínimo | Node ≥20 (`engines` en package.json; usa `globalThis.crypto.subtle`) / cualquier browser moderno en contexto seguro (https) |
| Sin dependencias runtime | cero dependencias en `dependencies` |

---

## 2. API pública

Toda la API se exporta desde `src/index.ts` (único entry point).

### Instalación

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v2.0.0
```

```ts
import { buildInvoiceRecord, buildBatchInvoiceRecords, buildAnulacionRecord, wrapForSoap, centsToImporte } from 'verifactu-js'
```

---

### `buildInvoiceRecord(input: FiscalInput): Promise<FiscalData>`

Genera hash + XML (`RegistroAlta`) + QR para una factura. El caller gestiona el encadenamiento vía `esPrimerRegistro` / `registroAnterior`.

```ts
interface VerifactuConfig {
  nif: string              // NIF del emisor (la empresa)
  nombreRazon: string      // Razón social del emisor
  softwareNif: string      // NIF del fabricante del software
  softwareNombre: string   // Nombre del software
  softwareVersion: string  // Versión del software
  softwareId: string       // IdSistemaInformatico — MÁX. 2 CARACTERES (XSD TextMax2Type); se valida
  numeroInstalacion?: string // default '1'
  testMode?: boolean       // default false — true apunta el QR a prewww2.aeat.es
}

interface DestinatarioF1 {
  nif: string
  nombre: string
}

// Referencia al ÚLTIMO registro emitido. El cliente debe persistir los tres campos:
// el XML Encadenamiento/RegistroAnterior exige numSerie y fecha de la factura anterior,
// no solo su huella.
interface RegistroAnteriorRef {
  numSerie: string
  fecha: Date
  huella: string    // hex MAYÚSCULAS 64 chars — se valida
  idEmisor?: string // default: config.nif
}

interface FiscalInput {
  config: VerifactuConfig
  numSerie: string                       // ej. "A-2026-000042"
  fecha: Date                            // fecha de expedición
  fechaHoraGenRegistro?: Date | string   // instante de generación del registro — ENTRA EN EL HASH.
                                         // Date → formateo con huso del runtime; string → verbatim
                                         // (ISO 8601 con offset, se valida). Default: ahora.
  tipoFactura?: 'F1' | 'F2'              // default: 'F1' si hay destinatario, 'F2' si no.
                                         // Incoherencias (F1 sin destinatario, F2 con) lanzan.
  descripcion: string                    // DescripcionOperacion — obligatorio (v1 lo hardcodeaba)
  desgloseIva: IvaLine[]
  cuotaTotal: string                     // "1.05" — punto y 2 decimales exactos, se valida
  importeTotal: string
  esPrimerRegistro: boolean
  registroAnterior?: RegistroAnteriorRef // obligatorio si esPrimerRegistro === false
  destinatario?: DestinatarioF1
}

interface IvaLine {
  tipoImpositivo: string          // "10", "21" (o "10.00")
  baseImponible: string           // → <BaseImponibleOimporteNoSujeto>
  cuotaRepercutida: string
  claveRegimen?: string           // default '01' (régimen general)
  calificacionOperacion?: string  // default 'S1' (sujeta no exenta, sin inversión)
}

interface FiscalData {
  hash: string                 // SHA-256 hex 64 chars MAYÚSCULAS
  xml: string                  // <RegistroAlta xmlns="…SuministroInformacion.xsd"> — valida contra XSD
  qrUrl: string                // servicio de cotejo TIKE-CONT (prod o prewww2 según testMode)
  fechaHoraGenRegistro: string // el valor exacto que entró en el hash — EL CLIENTE DEBE PERSISTIRLO
}
```

### `buildAnulacionRecord(input: AnulacionInput): Promise<AnulacionData>`

Registro de anulación (`RegistroAnulacion`) con su fórmula de huella propia (doc AEAT §3b). Sin QR.
Consume un eslabón de la MISMA cadena que los registros de alta.

```ts
interface AnulacionInput {
  config: VerifactuConfig
  numSerieAnulada: string
  fechaAnulada: Date
  fechaHoraGenRegistro?: Date | string
  esPrimerRegistro: boolean
  registroAnterior?: RegistroAnteriorRef
}
interface AnulacionData { hash: string; xml: string; fechaHoraGenRegistro: string }
```

### `buildBatchInvoiceRecords(inputs, startingRef): Promise<BatchInvoiceResult>`

Encadena N facturas gestionando el encadenamiento internamente.

```ts
type BatchInvoiceInput = Omit<FiscalInput, 'esPrimerRegistro' | 'registroAnterior'>

async function buildBatchInvoiceRecords(
  inputs: BatchInvoiceInput[],
  startingRef: RegistroAnteriorRef | null,  // null = inicio absoluto de cadena
): Promise<BatchInvoiceResult>

interface BatchInvoiceResult {
  results: FiscalData[]
  lastRef: RegistroAnteriorRef | null  // persistir para encadenar el próximo batch
}
```

Invariantes: el orden de `inputs` determina la cadena; `startingRef: null` → primer input con `PrimerRegistro`; `inputs` vacío devuelve `{ results: [], lastRef: startingRef }`.

### `wrapForSoap(records: string[], cabecera: CabeceraInput): string`

Envuelve 1–1000 registros (`xml` de alta y/o anulación) en el payload `RegFactuSistemaFacturacion`
conforme a `SuministroLR.xsd`. El envelope `soapenv:Envelope/Body` y la firma siguen siendo del integrador.

```ts
interface CabeceraInput { obligado: { nombreRazon: string; nif: string } }
```

### Helpers

```ts
centsToImporte(cents: number): string  // 1260 → '12.60', -5 → '-0.05'; lanza si no es entero
// Constantes: SOAP_MAX_RECORDS (1000), SF_NAMESPACE, SFLR_NAMESPACE
```

---

## 3. Arquitectura interna

```
src/
  index.ts   — API pública, orquestación, validaciones de frontera
  hash.ts    — buildAltaHashInput() / buildAnulacionHashInput() + computeHash()
  xml.ts     — buildRegistroAltaXml() / buildRegistroAnulacionXml() / wrapForSoap()
  qr.ts      — buildQrUrl()
```

`xml.ts` y `qr.ts` son puros síncronos; solo `hash.ts` es async (`crypto.subtle`). **La librería no
contiene lógica de envío AEAT** — no hay cliente SOAP ni firma. Tipos internos (`AltaXmlInput`,
`AltaHashInput`, `QrInput`) no se exportan.

---

## 4. Algoritmo de hash

Implementa el doc oficial AEAT **"Detalle de las especificaciones técnicas para generación de la
huella o hash de los registros de facturación" v0.1.2** (desarrolla la Orden HAC/1177/2024).
Copia de los datos clave en `docs/superpowers/specs/2026-07-04-v2-conformidad-aeat.md`.

Registro de **alta** — cadena `campo=valor` unidos por `&`, valores con trim, campo vacío → `Nombre=`:

```
IDEmisorFactura=…&NumSerieFactura=…&FechaExpedicionFactura=DD-MM-YYYY&TipoFactura=…&CuotaTotal=…&ImporteTotal=…&Huella=…&FechaHoraHusoGenRegistro=…
```

Registro de **anulación**:

```
IDEmisorFacturaAnulada=…&NumSerieFacturaAnulada=…&FechaExpedicionFacturaAnulada=…&Huella=…&FechaHoraHusoGenRegistro=…
```

UTF-8 → SHA-256 → hex **MAYÚSCULAS**, 64 chars.

**Invariantes:**
- `FechaHoraHusoGenRegistro` entra en el hash → el mismo input generado en instantes distintos produce
  huellas distintas. Por eso se acepta como parámetro y se devuelve en `FiscalData` para persistir.
- `TipoFactura` entra en el hash → F1 y F2 de la misma factura difieren.
- `Huella=` vacío solo en el primer registro de la cadena (`esPrimerRegistro: true`).
- Los importes deben ser strings con formato fijo (2 decimales): `'12.6'` y `'12.60'` producen huellas
  distintas, por eso la validación de frontera exige un único formato.

Tests con los 3 vectores oficiales del doc AEAT §6 (`tests/hash.test.ts`).

---

## 5. Formato XML

`buildRegistroAltaXml` genera `<RegistroAlta xmlns="…SuministroInformacion.xsd">` conforme al XSD
oficial (copia en `tests/schemas/`, validado en CI con xmllint). Secuencia:

```
IDVersion (1.0) → IDFactura{IDEmisorFactura, NumSerieFactura, FechaExpedicionFactura}
  → NombreRazonEmisor → TipoFactura → DescripcionOperacion
  → [Destinatarios]                ← solo F1, DESPUÉS de DescripcionOperacion
  → Desglose{DetalleDesglose{ClaveRegimen, CalificacionOperacion, TipoImpositivo,
             BaseImponibleOimporteNoSujeto, CuotaRepercutida}}
  → CuotaTotal → ImporteTotal
  → Encadenamiento{PrimerRegistro=S | RegistroAnterior{IDEmisorFactura, NumSerieFactura,
                   FechaExpedicionFactura, Huella}}   ← CHOICE: uno u otro, nunca ambos.
                   Los datos son de la factura ANTERIOR.
  → SistemaInformatico → FechaHoraHusoGenRegistro → TipoHuella (01) → Huella
```

`buildRegistroAnulacionXml`: `IDVersion → IDFactura{IDEmisorFacturaAnulada, NumSerieFacturaAnulada,
FechaExpedicionFacturaAnulada} → Encadenamiento → SistemaInformatico → FechaHoraHusoGenRegistro →
TipoHuella → Huella`.

El XML se genera como string (sin DOM). Caracteres especiales escapados en todos los campos de texto.

---

## 6. Build y distribución

```bash
npm run build   # tsup → dist/index.js (ESM) + dist/index.cjs (CJS) + types
```

`dist/` se commitea en git para que `npm install github:…#tag` funcione sin build en el consumidor.
`package.json` declara `files: ["dist"]` y `engines: { node: ">=20" }`.

### Instalación en consumidores

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v2.0.0
```

**Regla:** un único mecanismo de distribución — tag git explícito. No vendorizar tarballs (causó el
drift de EasyFichi, que quedó en v1.1.0 sin F1 creyendo estar en v1.3.1). **Nunca `#main`.**

---

## 7. Tests

| Fichero | Cobertura |
|---------|-----------|
| `hash.test.ts` | **Vectores oficiales AEAT** (alta primer registro, alta encadenada, anulación), trim, campo vacío, salida uppercase |
| `xml.test.ts` | Secuencia de elementos según XSD, DetalleDesglose con defaults 01/S1, Encadenamiento choice, RegistroAnterior con datos de la factura anterior, anulación, wrapForSoap, escape |
| `xsd.test.ts` | **Validación real contra los XSD oficiales** (alta F1/F2, anulación, envelope SOAP) con xmllint; se omite si xmllint no está |
| `qr.test.ts` | TIKE-CONT prod/pruebas, orden de parámetros, URL-encoding |
| `chain.test.ts` | Invariantes de encadenamiento, validación de importes/tipoImpositivo/softwareId/fechaHora, coherencia tipoFactura↔destinatario, centsToImporte |
| `batch.test.ts` | Encadenado de refs, continuación de cadena, equivalencia batch↔individual, batch vacío |
| `golden.test.ts` | Golden master F2/F1/anulación/QR con `fechaHoraGenRegistro` fija. Si falla, hay cambio fiscal → major bump |

---

## 8. Proceso de actualización

```bash
npm run test       # todos deben pasar — prestar atención a golden.test.ts
npm run build      # regenera dist/
git add src/ tests/ dist/ package.json CHANGELOG.md
git commit -m "feat/fix: descripción"
git tag vX.Y.Z && git push origin main && git push origin vX.Y.Z
# Actualizar CHANGELOG.md y el tag en los consumidores (pallaresa-tpv, fichaje_app)
```

Cambio que altere hash/XML/QR generados = **breaking fiscal** → major bump + coordinación con todos
los consumidores (las cadenas existentes quedan invalidadas).

---

## 9. Decisiones de diseño

### Importes como strings, no numbers
Evita que la aritmética flotante altere valores fiscales. v2 **valida en frontera** el formato
(punto + 2 decimales exactos) porque `'12.6'` y `'12.60'` producen huellas distintas. Para clientes
en centavos existe `centsToImporte()`.

### Sin dependencias runtime
`crypto.subtle` es Web API estándar (Node ≥20, browsers en contexto seguro). Cero supply chain.

### XML como string (sin DOM)
El esquema es estático; template literals + validación XSD en CI dan la misma garantía sin dependencias.

### `esPrimerRegistro` explícito + `registroAnterior` estructurado
El flag explícito previene que un hash vacío por bug se trate como inicio de cadena. `registroAnterior`
es un objeto (no solo el hash) porque el XSD exige numSerie/fecha del registro anterior en el XML.

### `fechaHoraGenRegistro` como parámetro
Entra en el hash, así que no puede ser un `new Date()` oculto: el cliente puede fijarla (reproducibilidad,
tests) y SIEMPRE recibe de vuelta el valor usado para persistirlo. Default: ahora.

### Sin envío SOAP ni firma
Frontera deliberada (se añadió y retiró `submit()` en v1.2). `wrapForSoap` genera el payload, pero
el transporte, mTLS/certificados y la firma son del integrador (Cloud Function).

### Timezone del runtime
`fecha: Date` se formatea con funciones locales del runtime. En Cloud Functions configurar
`TZ=Europe/Madrid`. Para `fechaHoraGenRegistro` los integradores server-side deberían pasar string
ISO con offset explícito y persistirlo.
