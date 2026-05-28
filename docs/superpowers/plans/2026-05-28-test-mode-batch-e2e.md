# Test Mode, Batch Helper y E2E Script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `testMode` flag to `VerifactuConfig`, `buildBatchFiscalData()` helper, and a developer E2E script — releasing as v1.1.0.

**Architecture:** `testMode` propagates from `VerifactuConfig` through `buildTicketFiscalData` down to `qr.ts` only (XML is unchanged). `buildBatchFiscalData` wraps the existing function in a hash-chaining loop and is added as a second export from `src/index.ts`. The E2E script consumes the built `dist/index.js` directly via ESM import.

**Tech Stack:** TypeScript 5, tsup (ESM+CJS build), Vitest 1, Node.js ESM script.

---

## File map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/qr.ts` | Two URL constants, `testMode: boolean` in `QrInput`, conditional base |
| Modify | `src/index.ts` | `testMode?: boolean` in `VerifactuConfig`, pass to `buildQrUrl`, add `BatchFiscalInput` / `BatchFiscalResult` types and `buildBatchFiscalData` export |
| Modify | `tests/qr.test.ts` | 2 new tests; add `testMode: false` to 2 existing calls |
| Create | `tests/batch.test.ts` | 5 tests for `buildBatchFiscalData` |
| Create | `scripts/test-e2e.mjs` | Developer E2E script |
| Modify | `package.json` | Version `1.0.0` → `1.1.0` |

---

## Task 1: `testMode` support in `src/qr.ts` (TDD)

**Files:**
- Modify: `src/qr.ts`
- Modify: `tests/qr.test.ts`

- [ ] **Step 1.1: Add 2 new failing tests to `tests/qr.test.ts`**

Append these two `it` blocks inside the existing `describe('buildQrUrl', ...)` block:

```ts
  it('builds test URL when testMode is true', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
      testMode: true,
    })
    expect(url).toBe(
      'https://prewww2.aeat.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389' +
      '&numserie=A-2026-000001' +
      '&fecha=26-05-2026' +
      '&importe=12.60'
    )
  })

  it('builds prod URL when testMode is false', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
      testMode: false,
    })
    expect(url).toContain('www2.agenciatributaria.gob.es')
  })
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd /Users/alfonsomatosmartinez/Projects/verifactu-js && npx vitest run tests/qr.test.ts
```

Expected: compilation error — `testMode` does not exist in type `QrInput`. This is the red phase.

- [ ] **Step 1.3: Replace the full content of `src/qr.ts`**

```ts
export interface QrInput {
  nif: string
  numSerie: string
  fecha: string        // DD-MM-YYYY
  importeTotal: string // '12.60'
  testMode: boolean
}

const AEAT_QR_BASE_PROD = 'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR'
const AEAT_QR_BASE_TEST = 'https://prewww2.aeat.es/wlpl/TEWC-CORE/ValidarQR'

export function buildQrUrl(i: QrInput): string {
  const base = i.testMode ? AEAT_QR_BASE_TEST : AEAT_QR_BASE_PROD
  const params = new URLSearchParams({
    nif: i.nif,
    numserie: i.numSerie,
    fecha: i.fecha,
    importe: i.importeTotal,
  })
  return `${base}?${params.toString()}`
}
```

- [ ] **Step 1.4: Update the 2 existing `buildQrUrl` calls in `tests/qr.test.ts` to pass `testMode: false`**

The first existing test starts with `const url = buildQrUrl({`. Add `testMode: false,` to both calls (the first two `it` blocks that don't have `testMode`).

The full updated `tests/qr.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildQrUrl } from '../src/qr'

describe('buildQrUrl', () => {
  it('builds the correct AEAT verification URL', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
      testMode: false,
    })
    expect(url).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389' +
      '&numserie=A-2026-000001' +
      '&fecha=26-05-2026' +
      '&importe=12.60'
    )
  })

  it('encodes special characters in URL params', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A 2026 001',
      fecha: '26-05-2026',
      importeTotal: '5.00',
      testMode: false,
    })
    expect(url).toContain('numserie=A+2026+001')
  })

  it('builds test URL when testMode is true', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
      testMode: true,
    })
    expect(url).toBe(
      'https://prewww2.aeat.es/wlpl/TEWC-CORE/ValidarQR' +
      '?nif=B62215389' +
      '&numserie=A-2026-000001' +
      '&fecha=26-05-2026' +
      '&importe=12.60'
    )
  })

  it('builds prod URL when testMode is false', () => {
    const url = buildQrUrl({
      nif: 'B62215389',
      numSerie: 'A-2026-000001',
      fecha: '26-05-2026',
      importeTotal: '12.60',
      testMode: false,
    })
    expect(url).toContain('www2.agenciatributaria.gob.es')
  })
})
```

- [ ] **Step 1.5: Run qr tests to confirm all 4 pass**

```bash
npx vitest run tests/qr.test.ts
```

Expected: `Tests 4 passed (4)`.

- [ ] **Step 1.6: Run full test suite to confirm nothing else broke**

```bash
npx vitest run
```

Expected: all 14 existing tests pass (the 2 xml and hash tests are unaffected; the 2 existing qr tests now have `testMode: false` and still pass).

- [ ] **Step 1.7: Commit**

```bash
git add src/qr.ts tests/qr.test.ts
git commit -m "feat: add testMode to QrInput — prewww2.aeat.es for test env"
```

---

## Task 2: Propagate `testMode` through `buildTicketFiscalData`

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 2.1: Replace the full content of `src/index.ts`**

Only two changes from the current file: `testMode?: boolean` in `VerifactuConfig`, and `testMode: input.config.testMode ?? false` passed to `buildQrUrl`.

```ts
import { buildHashInput, computeHash } from './hash.js'
import { buildQrUrl } from './qr.js'
import { buildTicketXml } from './xml.js'
import type { IvaLine, XmlInput } from './xml.js'

export type { IvaLine }

export interface VerifactuConfig {
  nif: string
  nombreRazon: string
  softwareNif: string
  softwareNombre: string
  softwareVersion: string
  softwareId: string
  testMode?: boolean   // default: false
}

export interface FiscalInput {
  config: VerifactuConfig
  numSerie: string
  serie: string
  fecha: Date
  numRegistro: number
  desgloseIva: IvaLine[]
  cuotaTotal: string
  importeTotal: string
  previousHash: string
  esPrimerRegistro: boolean
}

export interface FiscalData {
  hash: string
  xml: string
  qrUrl: string
}

function formatFecha(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

function formatFechaHora(d: Date): string {
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
  const mn = String(Math.abs(offset) % 60).padStart(2, '0')
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mn}`
}

export async function buildTicketFiscalData(input: FiscalInput): Promise<FiscalData> {
  const fecha = formatFecha(input.fecha)

  const hashStr = buildHashInput({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    tipoFactura: 'F2',
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash,
  })

  const hash = await computeHash(hashStr)

  const xmlInput: XmlInput = {
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
    tipoFactura: 'F2',
    descripcion: 'Venda de productes',
    desgloseIva: input.desgloseIva,
    cuotaTotal: input.cuotaTotal,
    importeTotal: input.importeTotal,
    previousHash: input.previousHash,
    hash,
    esPrimerRegistro: input.esPrimerRegistro,
  }

  const xml = buildTicketXml(xmlInput)
  const qrUrl = buildQrUrl({
    nif: input.config.nif,
    numSerie: input.numSerie,
    fecha,
    importeTotal: input.importeTotal,
    testMode: input.config.testMode ?? false,
  })

  return { hash, xml, qrUrl }
}
```

- [ ] **Step 2.2: Run full test suite**

```bash
npx vitest run
```

Expected: all 16 tests pass (14 original + 2 new from Task 1).

- [ ] **Step 2.3: Commit**

```bash
git add src/index.ts
git commit -m "feat: propagate testMode from VerifactuConfig to buildQrUrl"
```

---

## Task 3: `buildBatchFiscalData` (TDD)

**Files:**
- Create: `tests/batch.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 3.1: Create `tests/batch.test.ts` with 5 failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { buildBatchFiscalData } from '../src/index'
import type { BatchFiscalInput, VerifactuConfig } from '../src/index'

const config: VerifactuConfig = {
  nif: 'B12345678',
  nombreRazon: 'Test Restauració S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'test-sw',
  softwareVersion: '1.0',
  softwareId: 'TEST-001',
}

const ticket1: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000001',
  serie: 'A',
  fecha: new Date('2026-01-01T10:00:00'),
  numRegistro: 1,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
  cuotaTotal: '1.15',
  importeTotal: '12.60',
}

const ticket2: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000002',
  serie: 'A',
  fecha: new Date('2026-01-01T11:00:00'),
  numRegistro: 2,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '7.64', cuotaRepercutida: '0.76' }],
  cuotaTotal: '0.76',
  importeTotal: '8.40',
}

const ticket3: BatchFiscalInput = {
  config,
  numSerie: 'A-2026-000003',
  serie: 'A',
  fecha: new Date('2026-01-01T12:00:00'),
  numRegistro: 3,
  desgloseIva: [{ tipoImpositivo: '10', baseImponible: '20.09', cuotaRepercutida: '2.01' }],
  cuotaTotal: '2.01',
  importeTotal: '22.10',
}

describe('buildBatchFiscalData', () => {
  it('returns empty results with unchanged lastHash when inputs is empty', async () => {
    const result = await buildBatchFiscalData([], 'a'.repeat(64))
    expect(result.results).toHaveLength(0)
    expect(result.lastHash).toBe('a'.repeat(64))
  })

  it('returns empty results with unchanged empty startingHash when inputs is empty', async () => {
    const result = await buildBatchFiscalData([], '')
    expect(result.results).toHaveLength(0)
    expect(result.lastHash).toBe('')
  })

  it('marks first ticket as primer registro when startingHash is empty string', async () => {
    const result = await buildBatchFiscalData([ticket1], '')
    expect(result.results[0].xml).toContain('<PrimerRegistro>S</PrimerRegistro>')
  })

  it('does not mark first ticket as primer registro when startingHash is non-empty', async () => {
    const prevHash = 'b'.repeat(64)
    const result = await buildBatchFiscalData([ticket1], prevHash)
    expect(result.results[0].xml).toContain('<PrimerRegistro>N</PrimerRegistro>')
    expect(result.results[0].xml).toContain(`<Huella>${prevHash}</Huella>`)
  })

  it('chains hashes correctly across 3 tickets and sets lastHash to last result hash', async () => {
    const result = await buildBatchFiscalData([ticket1, ticket2, ticket3], '')

    expect(result.results).toHaveLength(3)
    expect(result.lastHash).toBe(result.results[2].hash)
    // ticket 2 references ticket 1's hash
    expect(result.results[1].xml).toContain(`<Huella>${result.results[0].hash}</Huella>`)
    // ticket 3 references ticket 2's hash
    expect(result.results[2].xml).toContain(`<Huella>${result.results[1].hash}</Huella>`)
  })
})
```

- [ ] **Step 3.2: Run batch tests to confirm they fail**

```bash
npx vitest run tests/batch.test.ts
```

Expected: compilation error — `buildBatchFiscalData`, `BatchFiscalInput` not exported from `src/index`. This is the red phase.

- [ ] **Step 3.3: Add the new types and function to `src/index.ts`**

Append the following to the end of `src/index.ts` (after `buildTicketFiscalData`):

```ts
export type BatchFiscalInput = Omit<FiscalInput, 'previousHash' | 'esPrimerRegistro'>

export interface BatchFiscalResult {
  results: FiscalData[]
  lastHash: string
}

export async function buildBatchFiscalData(
  inputs: BatchFiscalInput[],
  startingHash: string,
): Promise<BatchFiscalResult> {
  let currentHash = startingHash
  const results: FiscalData[] = []

  for (let i = 0; i < inputs.length; i++) {
    const esPrimerRegistro = currentHash === '' && i === 0
    const result = await buildTicketFiscalData({
      ...inputs[i],
      previousHash: currentHash,
      esPrimerRegistro,
    })
    results.push(result)
    currentHash = result.hash
  }

  return { results, lastHash: currentHash }
}
```

- [ ] **Step 3.4: Run batch tests to confirm all 5 pass**

```bash
npx vitest run tests/batch.test.ts
```

Expected: `Tests 5 passed (5)`.

- [ ] **Step 3.5: Run full test suite**

```bash
npx vitest run
```

Expected: all 21 tests pass (14 original + 2 qr + 5 batch).

- [ ] **Step 3.6: Commit**

```bash
git add src/index.ts tests/batch.test.ts
git commit -m "feat: add buildBatchFiscalData — hash-chaining helper for N tickets"
```

---

## Task 4: E2E script `scripts/test-e2e.mjs`

**Files:**
- Create: `scripts/test-e2e.mjs`

- [ ] **Step 4.1: Build the project**

```bash
npm run build
```

Expected: `dist/index.js` and `dist/index.cjs` regenerated cleanly.

- [ ] **Step 4.2: Create the `scripts/` directory and `scripts/test-e2e.mjs`**

```js
import { buildBatchFiscalData } from '../dist/index.js'

const config = {
  nif: 'B12345678',
  nombreRazon: 'Test Restauració S.L.',
  softwareNif: '00000000T',
  softwareNombre: 'test-sw',
  softwareVersion: '1.0',
  softwareId: 'TEST-001',
  testMode: true,
}

const inputs = [
  {
    config,
    numSerie: 'A-2026-000001',
    serie: 'A',
    fecha: new Date('2026-01-01T10:00:00'),
    numRegistro: 1,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.45', cuotaRepercutida: '1.15' }],
    cuotaTotal: '1.15',
    importeTotal: '12.60',
  },
  {
    config,
    numSerie: 'A-2026-000002',
    serie: 'A',
    fecha: new Date('2026-01-01T11:00:00'),
    numRegistro: 2,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '7.64', cuotaRepercutida: '0.76' }],
    cuotaTotal: '0.76',
    importeTotal: '8.40',
  },
  {
    config,
    numSerie: 'A-2026-000003',
    serie: 'A',
    fecha: new Date('2026-01-01T12:00:00'),
    numRegistro: 3,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '20.09', cuotaRepercutida: '2.01' }],
    cuotaTotal: '2.01',
    importeTotal: '22.10',
  },
  {
    config,
    numSerie: 'A-2026-000004',
    serie: 'A',
    fecha: new Date('2026-01-01T13:00:00'),
    numRegistro: 4,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '15.36', cuotaRepercutida: '1.54' }],
    cuotaTotal: '1.54',
    importeTotal: '16.90',
  },
  {
    config,
    numSerie: 'A-2026-000005',
    serie: 'A',
    fecha: new Date('2026-01-01T14:00:00'),
    numRegistro: 5,
    desgloseIva: [{ tipoImpositivo: '10', baseImponible: '11.09', cuotaRepercutida: '1.11' }],
    cuotaTotal: '1.11',
    importeTotal: '12.20',
  },
]

console.log('▶ Generando 5 tickets en modo TEST...\n')

const { results, lastHash } = await buildBatchFiscalData(inputs, '')

results.forEach((r, i) => {
  const input = inputs[i]
  console.log(`[${i + 1}/5] ${input.numSerie}  ${input.importeTotal}€`)
  console.log(`      hash:  ${r.hash}`)
  console.log(`      qrUrl: ${r.qrUrl}\n`)
})

console.log(`✔ Cadena de ${results.length} registros OK.`)
console.log(`  lastHash: ${lastHash}\n`)
console.log('▶ XML del registro 1 (lo que se firmaría y enviaría a AEAT SOAP):')
console.log(results[0].xml)
```

- [ ] **Step 4.3: Run the script and verify output**

```bash
node scripts/test-e2e.mjs
```

Expected output (values will differ, but structure must match):
- 5 blocks with `[N/5]`, a 64-char hash, and a `qrUrl` starting with `https://prewww2.aeat.es/...`
- A `✔ Cadena de 5 registros OK.` line with a 64-char `lastHash`
- The XML of registro 1 starting with `<RegistroFacturacion>` and containing `<PrimerRegistro>S</PrimerRegistro>`

- [ ] **Step 4.4: Commit**

```bash
git add scripts/test-e2e.mjs
git commit -m "chore: add scripts/test-e2e.mjs — level-1 E2E without network"
```

---

## Task 5: Version bump, final build, git tag

**Files:**
- Modify: `package.json`

- [ ] **Step 5.1: Run full test suite one last time**

```bash
npx vitest run
```

Expected: all 21 tests pass.

- [ ] **Step 5.2: Change version in `package.json` from `"1.0.0"` to `"1.1.0"`**

Edit the `"version"` field only:

```json
"version": "1.1.0",
```

- [ ] **Step 5.3: Rebuild to regenerate `dist/` with the new version**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 5.4: Commit all changed files including `dist/`**

```bash
git add package.json dist/
git commit -m "chore: bump to v1.1.0"
```

- [ ] **Step 5.5: Tag and push**

```bash
git tag v1.1.0
git push origin main && git push origin v1.1.0
```

After this, consumers install v1.1.0 with:
```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v1.1.0
```
