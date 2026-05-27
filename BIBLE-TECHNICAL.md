# BIBLE-TECHNICAL — verifactu-js

> Documento de referencia técnico. Arquitectura, API pública, decisiones de diseño e invariantes. Destino: desarrolladores que mantengan o extiendan la librería.

---

## 1. Stack y entornos

| Aspecto | Valor |
|---------|-------|
| Lenguaje | TypeScript 5.x, `strict: true` |
| Build | `tsup` (esbuild) — dual ESM + CJS |
| Tests | Vitest 1.x, `environment: node` |
| Runtime mínimo | Node 18+ (usa `globalThis.crypto.subtle`) / cualquier browser moderno |
| Sin dependencias runtime | cero dependencias en `dependencies` |

---

## 2. API pública

Toda la API se exporta desde `src/index.ts` (único entry point).

### `buildTicketFiscalData(input: FiscalInput): Promise<FiscalData>`

Función principal. Orquesta hash → XML → QR y devuelve los tres artefactos.

```ts
import { buildTicketFiscalData } from 'verifactu-js'         // ESM
const { buildTicketFiscalData } = require('verifactu-js')    // CJS
```

### Tipos de entrada

```ts
interface VerifactuConfig {
  nif: string              // NIF del emisor (la empresa)
  nombreRazon: string      // Razón social del emisor
  softwareNif: string      // NIF del fabricante del software
  softwareNombre: string   // Nombre del software
  softwareVersion: string  // Versión del software
  softwareId: string       // Identificador del software en AEAT
}

interface FiscalInput {
  config: VerifactuConfig
  numSerie: string          // Número de serie de la factura (ej. "A-2026-000042")
  serie: string             // Serie (ej. "A")
  fecha: Date               // Fecha de expedición (Date nativo)
  numRegistro: number       // Número de registro en la cadena (1, 2, 3...)
  desgloseIva: IvaLine[]    // Líneas de IVA
  cuotaTotal: string        // Total cuota IVA ("1.05")
  importeTotal: string      // Total factura ("12.60")
  previousHash: string      // Hash del registro anterior ("" si es el primero)
  esPrimerRegistro: boolean // true solo para el primer registro de la cadena
}

interface IvaLine {
  tipoImpositivo: string      // Porcentaje sin símbolo ("10", "21")
  baseImponible: string       // Base imponible ("11.55")
  cuotaRepercutida: string    // Cuota IVA ("1.05")
}
```

### Tipo de salida

```ts
interface FiscalData {
  hash: string    // SHA-256 hex 64 chars
  xml: string     // XML RegistroFacturacion completo (string, no DOM)
  qrUrl: string   // URL portal verificación AEAT
}
```

---

## 3. Arquitectura interna

```
src/
  index.ts   — API pública, orquestación, tipos FiscalInput/FiscalData/VerifactuConfig
  hash.ts    — buildHashInput() + computeHash() (crypto.subtle)
  xml.ts     — buildTicketXml(), tipos XmlInput/IvaLine
  qr.ts      — buildQrUrl(), tipo QrInput
```

Cada módulo es independiente: `xml.ts` y `qr.ts` son funciones puras síncronas. Solo `hash.ts` es async (por `crypto.subtle`). `index.ts` los compone y expone únicamente `buildTicketFiscalData`.

Los tipos internos (`XmlInput`, `HashInput`, `QrInput`) no se exportan — solo `FiscalInput`, `FiscalData`, `VerifactuConfig` e `IvaLine` son parte de la API pública.

---

## 4. Algoritmo de hash

Implementa la concatenación exigida por el RD 1007/2023, Anexo I:

```
IDEmisorFactura={nif}
NumSerieFactura={numSerie}
FechaExpedicionFactura={DD-MM-YYYY}
TipoFactura={F2}
CuotaTotalFactura={cuotaTotal}
ImporteTotal={importeTotal}
Encadenamiento={previousHash}
```

Sin separadores entre campos. El resultado se hashea con SHA-256 vía `crypto.subtle.digest('SHA-256', ...)` y se codifica como hex lowercase de 64 caracteres.

**Invariante:** el campo `Encadenamiento` es vacío (`""`) para `esPrimerRegistro: true`, y el hash del registro anterior para el resto. El XML refleja esto con `<PrimerRegistro>S</PrimerRegistro>` o con el bloque `<RegistroAnterior>`.

---

## 5. Formato XML

Genera un `<RegistroFacturacion>` v1.0 con:
- `<TipoFactura>F2</TipoFactura>` — factura simplificada
- `<DescripcionOperacion>Venda de productes</DescripcionOperacion>` — descripción fija
- `<TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu>` — solo Verifactú (no BATUZ/TICKETBAI)
- `<NumeroInstalacion>1</NumeroInstalacion>` — instalación única

El XML se genera como string (sin DOM ni parser), lo que garantiza compatibilidad total en Node y browser sin dependencias.

---

## 6. Build y distribución

### Dual build con tsup

```bash
npm run build   # genera dist/index.js (ESM) + dist/index.cjs (CJS) + types
```

`tsup.config.ts`:
```ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

El `dist/` se compromete en git (no está en `.gitignore`) para que la instalación vía `github:` funcione sin paso de build en el consumidor.

### Exports en package.json

```json
"exports": {
  ".": {
    "import":  { "types": "./dist/index.d.ts",  "default": "./dist/index.js"  },
    "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
}
```

### Instalación en proyectos consumidores

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v1.1.0
```

---

## 7. Tests

14 tests en `tests/`, agrupados por módulo:

| Fichero | Cobertura |
|---------|-----------|
| `hash.test.ts` | Concatenación correcta de campos, hash SHA-256 determinista y único |
| `xml.test.ts` | XML generado para primer registro y registros encadenados, desglose IVA, campos del sistema |
| `qr.test.ts` | URL QR con parámetros correctos |

```bash
npm run test
```

No se usa `@testing-library` ni jsdom. Assertions nativas de Vitest. Entorno `node`.

---

## 8. Proceso de actualización

Cuando se modifique la librería:

```bash
# 1. Hacer cambios en src/
# 2. Actualizar tests
npm run test       # verificar 14/14

# 3. Rebuild
npm run build      # regenera dist/

# 4. Commit incluyendo dist/
git add src/ tests/ dist/ package.json
git commit -m "feat/fix: descripción"

# 5. Nuevo tag semántico
git tag v1.2.0
git push origin main && git push origin v1.2.0

# 6. Actualizar el tag en los proyectos consumidores
# En pallaresa-tpv/package.json:
# "verifactu-js": "github:alfonso-matos-financefox-ch/verifactu-js#v1.2.0"
# npm install github:...#v1.2.0
```

**Nunca apuntar a `#main`** — las actualizaciones de una librería fiscal deben ser explícitas e intencionales.

---

## 9. Decisiones de diseño

### Importes como strings, no numbers
Los importes (`cuotaTotal`, `importeTotal`, `baseImponible`, etc.) son strings para evitar que la aritmética flotante de JavaScript altere los valores fiscales. El sistema integrador formatea los numbers con 2 decimales antes de llamar a la librería. El XML y el hash reflejan exactamente los strings recibidos, sin transformación.

### Sin dependencias runtime
`crypto.subtle` es una Web API estándar disponible en Node 18+ y todos los browsers modernos. No se necesita ningún paquete npm para el hash. Esto elimina el riesgo de supply chain en una librería de compliance fiscal.

### XML como string (sin DOM)
Usar template literals para generar el XML evita dependencias en `xmlbuilder2`, `fast-xml-parser` u otros. El formato XML de VeriFACTU es estático y bien definido; no hay ventaja en usar un parser/builder para un schema que no cambia.

### `esPrimerRegistro` explícito
En lugar de inferir si es el primer registro comprobando `previousHash === ""`, se exige el flag explícito. Esto previene que un hash vacío por error (bug en el integrador) sea tratado silenciosamente como primer registro de la cadena.
