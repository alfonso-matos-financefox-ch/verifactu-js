# Changelog

Todos los cambios notables de esta librería. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/).
**Regla fiscal:** cualquier cambio que altere hash, XML o QR generados es BREAKING → major bump y coordinación con todos los consumidores.

## [2.1.0] — 2026-08-22

- `VerifactuConfig.softwareNombreRazon` (opcional): nombre o razón social de la persona o entidad
  **productora** del software, que es lo que va en `SistemaInformatico/NombreRazon`.

  Hasta la 2.0.1 ese campo se rellenaba con `softwareNombre` (el nombre comercial), de modo que el
  par `NombreRazon` + `NIF` del bloque no identificaba a nadie coherente: el nombre era del producto
  y el NIF de la entidad. La AEAT define ese bloque como «el código de identificación del sistema
  informático utilizado, junto con los datos identificativos del **productor** del citado sistema
  informático» (contenido del registro de facturación de alta, punto 16). El nombre comercial va en
  `NombreSistemaInformatico`, que ya se rellenaba bien.

  Con software autodesarrollado el productor es el propio obligado, así que el valor coincide con
  `config.nombreRazon`.

  **No es breaking**: omitir el campo reproduce el comportamiento de <= 2.0.1. Pero el XML resultante
  es el incorrecto, así que los consumidores deben pasarlo. Cambia la huella de los registros
  nuevos; no afecta a los ya encadenados, que siguen siendo válidos.

## [2.0.1] — 2026-07-04

- `fecha` (y `fechaAnulada`, `registroAnterior.fecha`) acepta también string `'YYYY-MM-DD'` usada
  verbatim — fix del bug de TZ en servidores UTC (un `Date` de madrugada española producía la fecha
  del día anterior en hash+XML). Recomendado para Cloud Functions.
- `desgloseIva` vacío ahora lanza (el XSD exige ≥1 `DetalleDesglose`; antes generaba XML inválido).
- Docs: CLAUDE.md actualizado a la terminología v2.

## [2.0.0] — 2026-07-04

Reescritura de conformidad contra los documentos técnicos oficiales de AEAT (verificados y
archivados — ver `docs/superpowers/specs/2026-07-04-v2-conformidad-aeat.md`). El núcleo v1.x se
había implementado sin consultar las especificaciones oficiales y generaba huellas, XML y QR que
AEAT habría rechazado.

### BREAKING — huella
- Formato oficial `campo=valor&campo=valor` (v1 concatenaba sin `&`).
- `CuotaTotal=` y `Huella=` (v1 usaba `CuotaTotalFactura=` y `Encadenamiento=`).
- Nuevo campo `FechaHoraHusoGenRegistro` **dentro del hash** — instante de generación del registro;
  se devuelve en `FiscalData.fechaHoraGenRegistro` y el cliente debe persistirlo.
- Salida hex en **MAYÚSCULAS** (v1 lowercase). `registroAnterior.huella` se valida uppercase.
- Valores con trim. Tests con los 3 vectores oficiales del doc AEAT v0.1.2 §6.

### BREAKING — XML
- Raíz `<RegistroAlta>` con namespace `SuministroInformacion.xsd` (v1: `<RegistroFacturacion>` inexistente).
- `Encadenamiento` como choice: `PrimerRegistro` **o** `RegistroAnterior` (v1 emitía ambos).
- `RegistroAnterior` lleva numSerie/fecha de la factura **anterior** (v1 ponía los de la actual) →
  los clientes deben persistir `RegistroAnteriorRef {numSerie, fecha, huella}`, no solo el hash.
- `DetalleDesglose` (v1: `DetalleIVA`) con `ClaveRegimen` (default `01`) y `CalificacionOperacion` (default `S1`).
- `Destinatarios` recolocado tras `DescripcionOperacion`; `FechaHoraHusoGenRegistro` (v1:
  `FechaHoraHusoHorarioSistema`); `TipoHuella` + `Huella` (v1: `HuellaRegistro`); eliminado `NumRegistro`.
- Validación XSD real en CI (`tests/xsd.test.ts` con xmllint y los esquemas oficiales en `tests/schemas/`).

### BREAKING — API
- `buildTicketFiscalData` → `buildInvoiceRecord`; `buildBatchFiscalData` → `buildBatchInvoiceRecords(inputs, startingRef)`.
- `FiscalInput`: eliminados `serie` y `numRegistro`; `descripcion` ahora es parámetro obligatorio
  (v1 hardcodeaba 'Venda de productes'); `tipoFactura?: 'F1'|'F2'` explícito con inferencia por
  `destinatario` como fallback; `fechaHoraGenRegistro?: Date | string`.
- `previousHash`/`esPrimerRegistro` → `esPrimerRegistro` + `registroAnterior?: RegistroAnteriorRef`.
- `softwareId` máx. 2 caracteres (XSD `TextMax2Type`) — se valida y lanza.
- Importes validados en frontera: string con punto y exactamente 2 decimales.

### BREAKING — QR
- Path oficial `wlpl/TIKE-CONT/ValidarQR` (v1 usaba `TEWC-CORE`, incorrecto). Hosts sin cambio.

### Añadido
- `buildAnulacionRecord()` — registros de anulación con su fórmula de huella oficial.
- `wrapForSoap(records, cabecera)` — payload `RegFactuSistemaFacturacion` conforme a `SuministroLR.xsd`.
- `centsToImporte(cents)` — conversión céntimos→string para los clientes que trabajan en centavos.
- `package.json`: `files: ["dist"]`, `engines: node >=20`.

### Migración de clientes
1. Persistir por registro: `hash`, `fechaHoraGenRegistro`, `numSerie`, `fecha` (los cuatro hacen
   falta para encadenar el siguiente).
2. Invertir validaciones lowercase→uppercase de huellas.
3. Registrar un `softwareId` de ≤2 caracteres.
4. Las cadenas v1 son incompatibles — reiniciar cadena (coordinar con reset de producción).

## [1.4.0] — 2026-06

Soporte F1 (destinatario). Ver git log para versiones anteriores.
