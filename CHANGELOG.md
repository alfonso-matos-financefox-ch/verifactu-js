# Changelog

Todos los cambios notables de esta librería. Formato basado en [Keep a Changelog](https://keepachangelog.com/es/).
**Regla fiscal:** cualquier cambio que altere hash, XML o QR generados es BREAKING → major bump y coordinación con todos los consumidores.

## [2.4.0] — 2026-10-04

- **Destinatarios sin NIF español** (bloque XSD `IDOtro`). `destinatario` acepta ahora
  `{ nombre, nif }` (como siempre) **o** `{ nombre, idOtro: { codigoPais, idType, id } }`, exactamente uno.
  `idType`: `'02'` NIF-IVA, `'03'` pasaporte, `'04'` documento oficial del país de residencia,
  `'05'` certificado de residencia, `'06'` otro documento probatorio, `'07'` no censado.
  Genera `<IDDestinatario><NombreRazon/><IDOtro><CodigoPais/><IDType/><ID/></IDOtro></IDDestinatario>`.
  Vale para F1, F3 y R1..R4 (y por tanto en lotes); las anulaciones no llevan destinatario.
- Tipos nuevos exportados: `Destinatario` (unión), `DestinatarioNif`, `DestinatarioIdOtro`, `IDOtro`, `IDTypeOtro`,
  `DestinatarioError` (con `code`), `DestinatarioErrorCode` y `CODIGOS_PAIS_XSD`. `DestinatarioF1` se mantiene
  (alias de `DestinatarioNif`, deprecado).
- Validación (lanza `DestinatarioError`, `message` empieza por `Invalid destinatario:`):
  - `NIF_E_IDOTRO` (vienen los dos) / `SIN_IDENTIFICACION` (ninguno).
  - Con IDOtro: `NOMBRE` (1-120), `CODIGO_PAIS` (lista `CountryType2` del XSD; Grecia es `GR`), `ID_TYPE` (02..07),
    `ID` (1-20).
  - `COMBINACION` — reglas de rechazo de la AEAT («Validaciones» v1.2.2, ap. 13 y nota (1); `errores.properties`):
    `CodigoPais=ES` solo con 03 o 07 (1234/1126); 07 exige `ES` (1126) y un NIF de persona física válido (1131);
    02 solo para Estados miembros distintos de España, con el ID empezando por el código del país (1122; Grecia `EL`)
    y la estructura de NIF-IVA de la nota (1), solo mayúsculas.
  - `TIPO_FACTURA` — R3 solo admite IDOtro 07 (1191); R2 solo 02 o 07 (1192).
  - La rama NIF no se valida más que antes (sin cambios para quien ya la usa).
- **No es breaking**: el caso NIF genera exactamente el mismo XML (golden intacto). Huella y QR **no dependen
  del destinatario**: misma huella y QR con NIF o con IDOtro (test).
- Tests: `idotro.test.ts` (validaciones, huella/QR, lote, lista de países = XSD) y XSD real de IDOtro 02 FR,
  04 HK, 06 FR (SIRET), 07 ES, F3 y R4/S con IDOtro y envelope SOAP. `scripts/test-e2e.mjs` añade una F1 con
  IDOtro (solo generación: la librería no envía; el envío a preproducción AEAT lo hace el integrador con certificado).
- Fuera de alcance (no se puede validar sin conexión): que el NIF-IVA esté identificado en VIES/censo (la AEAT lo
  exige para 02), Irlanda del Norte (`XI`, no está en `CountryType2`) y el formato del ID para 03-06.

### Pendiente para el consumidor (fichaje_app / EasyFichi — punto E-B4 de `plan-unificacion-facturacion-2026-10-04.md`)

- Subir la dependencia de `#v2.2.0` a `#v2.4.0` (de paso coge las rectificativas R1-R5 de la v2.3.0).
- Guardar en el contacto `codigoPais`, `idType` y número de documento para los clientes sin NIF español
  (G2 Travel Ltd: `HK` + `04` + n.º de registro mercantil; clientes franceses con NIF-IVA: `FR` + `02` +
  `FR…` (11 caracteres tras el prefijo); franceses solo con SIRET: `FR` + `04` o `06` + SIRET).
- Decidir NIF o IDOtro al construir el registro (`{ nombre, nif }` o `{ nombre, idOtro }`, nunca ambos) y
  capturar `DestinatarioError` para mostrar el motivo (`code`) en el formulario del contacto.

## [2.3.0] — 2026-10-03

- Facturas **rectificativas** `tipoFactura: 'R1' | 'R2' | 'R3' | 'R4' | 'R5'` (R1 art. 80.1-80.2 LIVA y
  error fundado en derecho, R2 art. 80.3, R3 art. 80.4, R4 resto, R5 rectificativa de simplificada).
  Campos nuevos en `FiscalInput`:
  - `tipoRectificativa: 'S' | 'I'` — obligatorio con R1..R5, prohibido fuera.
  - `facturasRectificadas: { numSerie, fecha, idEmisor? }[]` — opcional (<=1000), solo con R1..R5.
    Genera `FacturasRectificadas/IDFacturaRectificada`.
  - `importeRectificacion: { baseRectificada, cuotaRectificada, cuotaRecargoRectificado? }` — obligatorio
    con `S` (base/cuota de la factura original), prohibido con `I`.
- Destinatario: obligatorio en R1..R4 (como F1/F3), prohibido en R5 (como F2).
- Orden XSD entre `TipoFactura` y `DescripcionOperacion`: `TipoRectificativa → FacturasRectificadas →
  FacturasSustituidas → ImporteRectificacion`.
- **No es breaking**: F1/F2/F3 generan exactamente lo mismo (golden intacto). Solo `TipoFactura` entra en
  la huella; ni `TipoRectificativa` ni las rectificadas.
- Tests: `rectificativas.test.ts` + XSD real de R1/I (importes negativos), R4/S y R5.

## [2.2.0] — 2026-10-03

- `tipoFactura: 'F3'` — «factura emitida en sustitución de facturas simplificadas facturadas y
  declaradas» (canje de tickets por factura completa). Nuevo campo `facturasSustituidas`
  (`{ numSerie, fecha, idEmisor? }[]`, `idEmisor` default `config.nif`) que genera el bloque XSD
  `FacturasSustituidas/IDFacturaSustituida` entre `TipoFactura` y `DescripcionOperacion`.
- Validación: F3 exige `destinatario` y >=1 sustituida (máx. 1000); `facturasSustituidas` con F1/F2 lanza.
- **No es breaking**: F1/F2 generan exactamente lo mismo (golden intacto). La lista de sustituidas
  no entra en la huella (el algoritmo de huella de alta solo usa `TipoFactura`).
- Test XSD real del registro F3 con xmllint.

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
