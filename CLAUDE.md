# verifactu-js

Librería TypeScript que implementa los pasos 1–3 del Real Decreto 1007/2023 (Veri*Factu): hash SHA-256 encadenado, XML `RegistroFacturacion` y QR de verificación AEAT.

Usada por **pallaresa-tpv** vía `npm install github:alfonso-matos-financefox-ch/verifactu-js#vX.Y.Z`.

## Cómo empezar — OBLIGATORIO para agentes nuevos

Lee en este orden antes de explorar el código o hacer cualquier cambio:

1. **`BIBLE-FUNCTIONAL.md`** — qué hace la librería, contexto legal RD 1007/2023, artefactos que produce.
2. **`BIBLE-TECHNICAL.md`** — API pública completa, arquitectura interna, algoritmo de hash, invariantes, proceso de release.

Las Biblias son la fuente de verdad. Leyéndolas evitas explorar el código desde cero.

## Stack

- **TypeScript 5.x strict**, build dual ESM + CJS con `tsup`
- **Tests:** Vitest, `environment: node`, sin jsdom ni dependencias de browser
- **Sin dependencias runtime** — solo `crypto.subtle` (Web API estándar Node 18+)

## Comandos

```bash
npm run test    # Vitest — prestar atención a golden.test.ts (cambio fiscal = fallo)
npm run build   # regenera dist/ — SIEMPRE antes de hacer commit con cambios en src/
```

## Proceso de release (resumen)

```bash
npm run test && npm run build
git add src/ tests/ dist/ package.json
git commit -m "feat/fix: descripción"
git tag vX.Y.Z
git push origin main && git push origin vX.Y.Z
```

El `dist/` se commitea en git para que la instalación vía `github:` funcione sin build en el consumidor. **Nunca apuntar a `#main`** en los consumidores — las actualizaciones de una librería fiscal deben ser explícitas.

## Tras cada cambio de comportamiento

Actualiza `BIBLE-FUNCTIONAL.md` y/o `BIBLE-TECHNICAL.md` para mantenerlas coherentes con el código.
