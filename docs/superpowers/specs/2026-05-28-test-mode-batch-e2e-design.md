# Design: Test Mode, Batch Helper y E2E Script
**Fecha:** 2026-05-28
**Estado:** Aprobado

---

## Contexto

`verifactu-js` v1.0 implementa la generación de artefactos fiscales (hash SHA-256, XML `RegistroFacturacion`, QR URL) para un único ticket. Dos clientes lo integrarán:

- **pallaresa-tpv** (browser, offline-first): lo usa bundleado directamente. Acumula tickets cada ~30 min y, cuando hay red, una Cloud Function los envía en batch a la AEAT vía SOAP.
- **EasyFichi módulo de facturación** (Cloud Function, siempre online): lo llama por cada factura y envía el XML a la AEAT de forma síncrona.

Este diseño añade tres capacidades al repo:

1. **`testMode`** — flag de entorno que cambia el QR URL base y marca el XML como envío de prueba.
2. **`buildBatchFiscalData()`** — helper que encadena hashes de N tickets en una sola llamada.
3. **Script E2E de nivel 1** — script Node.js que valida el flujo completo sin red.

---

## 1. Flag `testMode` en `VerifactuConfig`

### Por qué en `VerifactuConfig` y no en `FiscalInput`

El modo test es una propiedad del entorno de ejecución (producción vs desarrollo), no de la factura individual. Todas las facturas de una sesión comparten el mismo modo. Ponerlo en `VerifactuConfig` — que ya agrupa los datos del software emisor — mantiene `FiscalInput` limpio y evita que el caller lo pase en cada factura.

### Cambio en la interfaz pública

```ts
export interface VerifactuConfig {
  nif: string
  nombreRazon: string
  softwareNif: string
  softwareNombre: string
  softwareVersion: string
  softwareId: string
  testMode?: boolean   // default: false
}
```

### Efecto en los artefactos

| Artefacto | Producción (`testMode: false`) | Test (`testMode: true`) |
|-----------|-------------------------------|------------------------|
| `qrUrl` base | `https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR` | URL pre-producción AEAT (**pendiente verificar** — puede ser `https://preweb.aeat.es/wlpl/TEWC-CORE/ValidarQR` u otro path) |
| XML `<TipoEnvio>` | `A` (Alta en el sistema) | `T` (Test) — **posición en el XML a verificar** contra el RD 1007/2023 Anexo II |

### Cambios en el código

**`src/qr.ts`** — el campo `testMode` llega desde fuera:

```ts
const AEAT_QR_BASE_PROD = 'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR'
const AEAT_QR_BASE_TEST = 'https://preweb.aeat.es/wlpl/TEWC-CORE/ValidarQR'

export interface QrInput {
  nif: string
  numSerie: string
  fecha: string
  importeTotal: string
  testMode: boolean
}

export function buildQrUrl(i: QrInput): string {
  const base = i.testMode ? AEAT_QR_BASE_TEST : AEAT_QR_BASE_PROD
  const params = new URLSearchParams({ nif: i.nif, numserie: i.numSerie, fecha: i.fecha, importe: i.importeTotal })
  return `${base}?${params.toString()}`
}
```

**`src/xml.ts`** — añadir `<TipoEnvio>` en la posición que indique el RD 1007/2023 Anexo II (a verificar antes de implementar — provisional dentro de `<SistemaInformatico>`):

```ts
// XmlInput añade:
testMode: boolean

// En buildTicketXml, dentro del bloque <SistemaInformatico>:
<TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu>
<TipoEnvio>${i.testMode ? 'T' : 'A'}</TipoEnvio>   // ← nuevo
```

**`src/index.ts`** — propaga `testMode` desde `config` a los módulos internos. Sin cambio de firma en `buildTicketFiscalData` — el flag ya está en `FiscalInput.config`.

### Retrocompatibilidad

`testMode` es opcional con default `false`. Todos los callers existentes (TPV, EasyFichi) no necesitan cambios hasta que quieran activarlo.

---

## 2. `buildBatchFiscalData()`

### Motivación

El caller (TPV, test script) necesita procesar N tickets en secuencia con la cadena de hashes encadenada. Sin este helper, el caller tiene que gestionar manualmente `previousHash` y `esPrimerRegistro` en cada iteración — propenso a errores en código crítico de compliance fiscal.

### Tipos nuevos

```ts
// BatchFiscalInput es FiscalInput sin los campos de encadenamiento,
// que la función calcula internamente.
export type BatchFiscalInput = Omit<FiscalInput, 'previousHash' | 'esPrimerRegistro'>

export interface BatchFiscalResult {
  results: FiscalData[]  // un entry por ticket, en orden de entrada
  lastHash: string       // hash del último registro — persistir para el próximo batch
}
```

### Firma

```ts
export async function buildBatchFiscalData(
  inputs: BatchFiscalInput[],
  startingHash: string,        // "" si es el primer batch de la cadena
): Promise<BatchFiscalResult>
```

### Algoritmo

```
currentHash = startingHash
results = []

para cada input en inputs (en orden):
  esPrimerRegistro = (currentHash === "" && índice === 0)
  result = await buildTicketFiscalData({ ...input, previousHash: currentHash, esPrimerRegistro })
  results.push(result)
  currentHash = result.hash

return { results, lastHash: currentHash }
```

### Invariantes

- El orden de `inputs` es el orden de la cadena. El caller es responsable de pasarlos ordenados por fecha/numRegistro.
- `startingHash: ""` solo cuando es el primer registro absoluto de la cadena. Para todos los batch posteriores, el caller pasa el `lastHash` del batch anterior (persistido en Firestore en `tpv_config/main.lastHash`).
- Si `inputs` está vacío, devuelve `{ results: [], lastHash: startingHash }`.

---

## 3. Script E2E de nivel 1

### Propósito

Verificar el flujo fiscal completo sin red ni certificado. Ejecutable en local en cualquier momento.

### Fichero

`scripts/test-e2e.mjs` — script ES Module puro, sin dependencias externas, usa `dist/index.js` directamente.

### Datos de prueba

Usa un NIF/empresa ficticio de prueba (no real). Genera 5 tickets con IVA al 10% (negocio de restauración), importes variados.

### Output esperado

```
▶ Generando 5 tickets en modo TEST...

[1/5] A-2026-000001  12.60€
      hash:  a3f2c8d1e5b9f4a2...
      qrUrl: https://preweb.aeat.es/wlpl/TEWC-CORE/ValidarQR?nif=B12345678&...

[2/5] A-2026-000002   8.40€
      hash:  7b9e4f2ac3d1e8b5...
      qrUrl: https://preweb.aeat.es/...

...

[5/5] A-2026-000005  22.10€
      hash:  c1d5a8b3f2e9a4c7...
      qrUrl: https://preweb.aeat.es/...

✔ Cadena de 5 registros OK.
  lastHash: c1d5a8b3f2e9a4c7...

▶ XML del registro 1 (lo que se firmaría y enviaría a AEAT SOAP):
<RegistroFacturacion>...<TipoEnvio>T</TipoEnvio>...</RegistroFacturacion>
```

### Ejecución

```bash
npm run build         # asegura dist/ actualizado
node scripts/test-e2e.mjs
```

No se añade al `package.json` como script oficial — es una herramienta de desarrollo.

---

## 4. Arquitectura SOAP (fuera de la librería)

Esta sección documenta la responsabilidad de cada capa para que los agentes de TPV y EasyFichi sepan qué construir. `verifactu-js` no implementa nada de esto.

### Flujo TPV (offline-first)

```
En cada cobro (sin red necesaria):
  TPV → buildTicketFiscalData()
       → guarda { hash, xml, qrUrl, aeatStatus: 'pending' } en Firestore

Cada ~30 min (Cloud Function scheduled, cuando hay red):
  CF → lee tpv_tickets con aeatStatus: 'pending'
     → por cada ticket: firma XML con p12 (node-forge / xml-crypto)
     → POST SOAP → https://preweb.aeat.es (test) o https://www1.agenciatributaria.gob.es (prod)
     → actualiza aeatStatus: 'ok' | 'error'
     → actualiza tpv_config/main.lastAeatSubmission
```

### Flujo EasyFichi (síncrono)

```
En cada factura:
  EasyFichi CF → buildTicketFiscalData()
               → firma XML con p12
               → POST SOAP → AEAT (inmediato)
               → guarda { hash, xml, qrUrl, aeatStatus } en Firestore
               → devuelve { qrUrl } al caller (para que el TPV lo imprima)
```

### QR en el documento impreso

`verifactu-js` devuelve `qrUrl` (string). La imagen QR la renderiza el consumidor:

- **TPV (Flutter web):** paquete `qrcode.react` (ya planificado en Feature 5 del TPV).
- **EasyFichi (PDF server-side):** paquete Node.js como `qrcode` para incrustar en el PDF.

### Fase 2 — AEAT pre-producción (cuando llegue el p12)

1. Cloud Function configurada con `testMode: true` en `VerifactuConfig`.
2. El QR generado apunta a `preweb.aeat.es`.
3. El XML tiene `<TipoEnvio>T</TipoEnvio>`.
4. SOAP endpoint de pre-producción: **a verificar** en la documentación técnica de la AEAT (WSDL de VeriFACTU).
5. Verificación: abrir el `qrUrl` en el navegador y confirmar que la AEAT muestra los datos de la factura.

### Fase 3 — Producción (enero 2027)

Cambiar `testMode: false` (o eliminar el flag). Todo lo demás igual.

---

## Cambios al versioning

Estos cambios afectan al output del XML (`<TipoEnvio>` nuevo) y al `qrUrl` (base diferente en test). Son cambios de funcionalidad, no del algoritmo de hash ni del formato fiscal obligatorio. **→ v1.1.0** (minor, retrocompatible).

Los proyectos consumidores actualizan a `#v1.1.0` explícitamente cuando quieran activar `testMode`.

---

## Tests a añadir

| Fichero | Tests nuevos |
|---------|-------------|
| `tests/qr.test.ts` | QR URL en modo test apunta a `preweb.aeat.es` |
| `tests/xml.test.ts` | XML con `testMode: true` contiene `<TipoEnvio>T</TipoEnvio>` |
| `tests/xml.test.ts` | XML con `testMode: false` (default) contiene `<TipoEnvio>A</TipoEnvio>` |
| `tests/batch.test.ts` | Fichero nuevo — encadenamiento correcto de 3 registros, `lastHash` correcto, `startingHash: ""` activa `esPrimerRegistro` en primer elemento |
