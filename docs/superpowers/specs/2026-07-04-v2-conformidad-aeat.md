# v2.0.0 — Conformidad con especificaciones oficiales AEAT

**Fecha:** 2026-07-04. **Motivo:** auditoría multi-repo detectó que el núcleo hash/XML/QR de v1.x
se implementó desde conocimiento del modelo (citando "RD 1007/2023 Anexo I") sin consultar los
documentos técnicos de AEAT. Verificado contra fuentes oficiales descargadas hoy.

## Fuentes oficiales (verificadas 2026-07-04)

| Doc | URL | Versión |
|-----|-----|---------|
| Huella/hash | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf` | 0.1.2 (27/08/2024) |
| QR y cotejo | `https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf` | 0.5.0 |
| XSD | `https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd` (+ `SuministroLR.xsd`) | copia en `tests/schemas/` |

## Huella (registro de alta) — formato oficial

Cadena `campo=valor` unidos por `&`, valores con **trim**, campo vacío → `Nombre=`:

```
IDEmisorFactura=...&NumSerieFactura=...&FechaExpedicionFactura=DD-MM-YYYY&TipoFactura=...&CuotaTotal=...&ImporteTotal=...&Huella=<huella anterior o vacío>&FechaHoraHusoGenRegistro=<ISO 8601 con huso>
```

UTF-8 → SHA-256 → hex **MAYÚSCULAS**, 64 chars. La `FechaHoraHusoGenRegistro` **entra en el hash**
(instante de generación del registro, no la fecha de la factura) — debe persistirse junto al hash.

**Anulación:** `IDEmisorFacturaAnulada=&NumSerieFacturaAnulada=&FechaExpedicionFacturaAnulada=&Huella=&FechaHoraHusoGenRegistro=`.

### Vectores oficiales (doc huella §6 — usados en tests/hash.test.ts)

| Caso | Entrada clave | Huella esperada |
|------|---------------|-----------------|
| 1 (alta, primer registro) | `89890001K / 12345678/G33 / 01-01-2024 / F1 / 12.35 / 123.45 / Huella= / 2024-01-01T19:20:30+01:00` | `3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60` |
| 2 (alta, segundo) | ídem con `12345679/G34`, huella caso 1, `19:20:35` | `F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97` |
| 3 (anulación) | `12345679/G34`, huella caso 2, `19:20:40` | `177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68` |

## XML — divergencias v1 → v2 (contra XSD oficial)

| v1 (incorrecto) | v2 (XSD) |
|----|----|
| raíz `<RegistroFacturacion>` | `<RegistroAlta xmlns="…SuministroInformacion.xsd">` |
| `Destinatarios` antes de `TipoFactura` | después de `DescripcionOperacion`, antes de `Desglose` |
| `<DetalleIVA>` | `<DetalleDesglose>` con `ClaveRegimen` (def. 01) y `CalificacionOperacion` (def. S1) |
| `<PrimerRegistro>N</PrimerRegistro><RegistroAnterior>` | `Encadenamiento` es **choice**: `PrimerRegistro` O `RegistroAnterior` |
| `RegistroAnterior` con numSerie/fecha de la factura **actual** | debe llevar los de la factura **anterior** |
| `<FechaHoraHusoHorarioSistema>` | `<FechaHoraHusoGenRegistro>` (dateTime, tras `SistemaInformatico`) |
| `<NumRegistro>` | no existe en el esquema — eliminado |
| `<HuellaRegistro>` | `<TipoHuella>01</TipoHuella><Huella>…</Huella>` |
| `IdSistemaInformatico` libre | `TextMax2Type` — **máx. 2 caracteres** (se valida) |

Envelope para envío (usado por `wrapForSoap`): `RegFactuSistemaFacturacion` (ns `SuministroLR.xsd`) =
`Cabecera{ObligadoEmision{NombreRazon,NIF}}` + hasta 1000 `RegistroFactura{RegistroAlta|RegistroAnulacion}`.
El envelope SOAP (`soapenv:Envelope/Body`) y la firma siguen siendo responsabilidad del integrador (CF).

## QR — corrección

Path oficial `wlpl/TIKE-CONT/ValidarQR` (v1 usaba `TEWC-CORE`, incorrecto). Hosts sin cambio:
prod `www2.agenciatributaria.gob.es`, pruebas `prewww2.aeat.es`. Parámetros `nif`, `numserie`,
`fecha` (DD-MM-AAAA), `importe` (punto decimal), URL-encoded UTF-8. Sin parámetro `formato=json` en el QR impreso.

## Consecuencias para los clientes (breaking)

1. **Persistir más estado**: además de `lastHash`, ahora hace falta `numSerie` + `fecha` del último
   registro (para `RegistroAnterior`) y cada registro debe guardar su `fechaHoraGenRegistro` (entra en el hash).
2. Huellas pasan a MAYÚSCULAS — validaciones de cliente que exigían lowercase deben invertirse.
3. `IdSistemaInformatico` ≤ 2 chars — pallaresa (`PALLARESA-TPV-1`) y EasyFichi deben registrar códigos de 2 chars.
4. Toda cadena v1 es incompatible — coordinar con el reset de producción de pallaresa.
