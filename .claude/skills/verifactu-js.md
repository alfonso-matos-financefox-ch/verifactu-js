---
name: verifactu-js
description: Guía de orientación para trabajar en la librería verifactu-js. Usar al inicio de cualquier sesión de desarrollo, antes de explorar código o hacer cambios.
---

# verifactu-js — guía de agente

## Qué es esto

Librería TypeScript **sin dependencias runtime** que implementa los pasos 1–3 del Real Decreto 1007/2023 (Veri*Factu):
1. Hash SHA-256 encadenado (cadena de bloques simplificada)
2. XML `<RegistroFacturacion>` v1.0
3. URL QR de verificación AEAT

**No hay `submit()`, no hay SOAP, no hay mock de envío.** El envío es responsabilidad del sistema integrador (Cloud Function en EasyFichi/pallaresa-tpv).

## Tipos de factura soportados

| Tipo | Campo | Comportamiento |
|------|-------|----------------|
| F2 | `destinatario` ausente | Simplificada / consumidor final. Sin bloque `<Destinatarios>` en XML. |
| F1 | `destinatario?: { nif, nombre }` presente | Completa B2B. Incluye `<Destinatarios>` antes de `<TipoFactura>` (orden XSD). |

La API es **backward-compatible**: omitir `destinatario` → F2 exactamente como antes.

## Ficheros clave — lee estos antes de tocar código

```
src/index.ts   API pública: FiscalInput, FiscalData, buildTicketFiscalData, buildBatchFiscalData
src/hash.ts    buildHashInput() + computeHash() — SHA-256 vía crypto.subtle
src/xml.ts     buildTicketXml() + DestinatarioF1 + buildDestinatariosXml() (SRP helper)
src/qr.ts      buildQrUrl() — sin diferencia entre F1/F2
```

## Invariantes críticas

- **`exactOptionalPropertyTypes: true`** en tsconfig. No asignar `campo: value | undefined` directamente — usar spread condicional: `...(x !== undefined ? { campo: x } : {})`.
- **El `TipoFactura` entra en el hash.** F1 y F2 producen hashes distintos para los mismos datos. Es deliberado.
- **El bloque `<Destinatarios>` va antes de `<TipoFactura>`** en el XML (orden XSD exigido por la AEAT).
- **Importes como strings** (`"1.05"`, no `1.05`) — evitar aritmética flotante en datos fiscales.
- **`dist/` se commitea en git** — es necesario para instalación vía `github:` sin paso de build.
- **Nunca `#main`** en consumidores — siempre tag explícito (`#v1.4.0`).

## Flujo de desarrollo

```bash
# 1. Cambios en src/ + tests/
npx vitest run          # todos los tests deben pasar (golden.test.ts = tests fiscales — si fallan es BREAKING)

# 2. Build obligatorio antes del commit
npm run build           # regenera dist/ (ESM + CJS + tipos)

# 3. Commit con dist/ incluido
git add src/ tests/ dist/ package.json
git commit -m "feat/fix: descripción"

# 4. Tag semántico
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z
```

## Al añadir soporte para un nuevo tipo de factura o cambiar el hash/XML

1. Actualizar `src/hash.ts` si cambia el algoritmo de concatenación.
2. Actualizar `src/xml.ts` añadiendo helper SRP por cada nuevo bloque XML.
3. Actualizar `src/index.ts` — derivar nuevos campos, no hardcodearlos.
4. Añadir tests en `tests/xml.test.ts` y `tests/hash.test.ts`.
5. Calcular el nuevo golden hash: `printf '%s' '<hash-input-string>' | shasum -a 256`.
6. Añadir golden en `tests/golden.test.ts`.
7. **Actualizar `BIBLE-FUNCTIONAL.md` y `BIBLE-TECHNICAL.md`** — son la fuente de verdad.

## Al añadir un nuevo campo opcional a FiscalInput/XmlInput

- Declararlo como `campo?: Tipo` (no `campo?: Tipo | undefined`) — `exactOptionalPropertyTypes`.
- Propagarlo con spread condicional en todas las capas (index → xml).
- Verificar que `BatchFiscalInput` lo hereda correctamente (es `Omit<FiscalInput, 'previousHash' | 'esPrimerRegistro'>`).
- Si afecta al hash o al XML: **es un cambio fiscal** → nueva versión mayor.

## Consumidores actuales

| Proyecto | Uso | Campo `destinatario` |
|----------|-----|----------------------|
| `pallaresa-tpv` | TPV caja, tickets físicos | Nunca (siempre F2) |
| `easyfichi/functions` | Facturas B2B y consumidor | Cuando `terceroId`/`terceroCif` presente → F1 |

## Tests de referencia

- `tests/golden.test.ts` — golden F2: hash `af6861d6...`; golden F1: hash `81cc57f1...`
- Un fallo en golden = cambio fiscal = bump de versión mayor requerido.
