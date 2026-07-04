---
name: verifactu-js
description: Guía de orientación para trabajar en la librería verifactu-js. Usar al inicio de cualquier sesión de desarrollo, antes de explorar código o hacer cambios.
---

# verifactu-js — guía de agente

## Qué es esto

Librería TypeScript **sin dependencias runtime** que implementa la generación de registros Veri*Factu
(RD 1007/2023, Orden HAC/1177/2024) conforme a los **documentos técnicos oficiales de AEAT**:
1. Huella SHA-256 encadenada (formato oficial `campo=valor&…`, hex MAYÚSCULAS)
2. XML `<RegistroAlta>` / `<RegistroAnulacion>` conformes al XSD `SuministroInformacion.xsd`
3. URL QR del servicio de cotejo `TIKE-CONT/ValidarQR`
4. `wrapForSoap()` — payload `RegFactuSistemaFacturacion` para el envío

**No hay transporte SOAP ni firma.** El envío es responsabilidad del integrador (Cloud Function).

**Fuentes oficiales verificadas (2026-07-04)** — specs y URLs en
`docs/superpowers/specs/2026-07-04-v2-conformidad-aeat.md`; XSDs oficiales en `tests/schemas/`.
**Ante cualquier duda sobre el formato fiscal, consultar esas fuentes, NO el conocimiento del modelo**
(así se introdujeron los errores de v1.x).

## API v2 (breaking respecto a v1 — ver CHANGELOG.md)

| Función | Uso |
|---------|-----|
| `buildInvoiceRecord(input)` | Una factura F1/F2 → `{hash, xml, qrUrl, fechaHoraGenRegistro}` |
| `buildBatchInvoiceRecords(inputs, startingRef)` | N facturas encadenadas → `{results, lastRef}` |
| `buildAnulacionRecord(input)` | Registro de anulación (misma cadena) |
| `wrapForSoap(records, cabecera)` | Payload de envío (máx. 1000 registros) |
| `centsToImporte(cents)` | 1260 → `'12.60'` para clientes en centavos |

## Invariantes críticas

- **`fechaHoraGenRegistro` ENTRA EN EL HASH** — es parámetro (o default now) y se devuelve para
  que el cliente lo persista. Nunca regenerarla para un registro ya emitido.
- **El encadenamiento necesita `{numSerie, fecha, huella}` del registro anterior** (no solo el hash):
  el XML `RegistroAnterior` exige los tres. Los clientes persisten `RegistroAnteriorRef` completo.
- **Huellas en hex MAYÚSCULAS** — la validación rechaza lowercase (formato oficial AEAT).
- **Importes: string con punto y 2 decimales exactos, validados** — `'12.6'` ≠ `'12.60'` en el hash.
- **`softwareId` máx. 2 chars** (XSD `TextMax2Type`) — se valida y lanza.
- **`Encadenamiento` es choice** — `PrimerRegistro` O `RegistroAnterior`, nunca ambos.
- **`descripcion` es obligatoria** — no hay default hardcodeado (multi-cliente).
- **`exactOptionalPropertyTypes: true`** — spread condicional para opcionales: `...(x !== undefined ? { campo: x } : {})`.
- **`dist/` se commitea** — necesario para `npm install github:…#tag` sin build.
- **Nunca `#main` ni tarballs vendorizados** en consumidores — siempre tag explícito. (El tarball
  vendorizado dejó a EasyFichi en v1.1.0 sin F1 creyendo estar en v1.3.1.)

## Flujo de desarrollo

```bash
npx vitest run   # 54 tests: vectores oficiales AEAT + validación XSD (xmllint) + goldens
npm run build    # regenera dist/ — SIEMPRE antes de commit con cambios en src/
git add src/ tests/ dist/ package.json CHANGELOG.md
git commit -m "feat/fix: descripción"
git tag vX.Y.Z && git push origin main && git push origin vX.Y.Z
```

Golden test fallando = cambio fiscal = major bump + entrada de migración en CHANGELOG.md +
coordinación con TODOS los consumidores (sus cadenas quedan invalidadas).

## Al cambiar hash/XML

1. **Verificar primero contra los docs oficiales** (spec 2026-07-04 + XSDs en tests/schemas/).
2. Los vectores oficiales de `tests/hash.test.ts` NO se tocan jamás (son de AEAT).
3. La validación XSD (`tests/xsd.test.ts`) debe seguir pasando.
4. Actualizar goldens + CHANGELOG + Biblias.

## Consumidores actuales

| Proyecto | Uso | Estado |
|----------|-----|--------|
| `pallaresa-tpv` | TPV caja, F2 vía cliente browser + CF batch | Pin `github:#tag` — migrar a v2 antes del reset de producción |
| `fichaje_app/functions` | Facturas F1/F2 multi-empresa | ⚠️ tarball vendorizado v1.1.0 — migrar a v2 + eliminar doble cadena (ver auditoría 2026-07-04 en pallaresa-tpv/.planning/) |

## Roadmap

- v2.1: rectificativas R1–R5 (`TipoRectificativa`, `FacturasRectificadas`, `ImporteRectificacion`),
  destinatarios `IDOtro` (VAT intracomunitario/pasaporte).
- Pendiente de decisión: registro en AEAT de `softwareId`/NIF reales antes de 2027-01-01.
