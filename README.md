# verifactu-js

Generación de datos fiscales VERI\*FACTU para software de facturación español (Real Decreto 1007/2023, Orden HAC/1177/2024).

Produce hash SHA-256 encadenado + XML `RegistroAlta`/`RegistroAnulacion` conformes al XSD oficial de AEAT + URL QR del servicio de cotejo, para cada factura emitida. Verificado contra los documentos técnicos oficiales de AEAT y sus vectores de test publicados (ver `CHANGELOG.md` v2.0.0).

**Alcance:** facturas simplificadas F2 (tickets de caja), facturas completas F1 (B2B con destinatario) y registros de anulación. Incluye `wrapForSoap()` para el payload de envío `RegFactuSistemaFacturacion`. No incluye firma .p12 ni transporte SOAP — eso es responsabilidad de la capa integradora.

---

## Aviso legal / Disclaimer

> **Esta librería se proporciona exclusivamente con fines informativos y de referencia técnica.**
>
> - No constituye asesoramiento jurídico, fiscal ni contable.
> - No ha sido certificada ni validada por la Agencia Tributaria (AEAT).
> - El cumplimiento del Real Decreto 1007/2023 y la validez legal de los registros fiscales generados son **responsabilidad exclusiva del desarrollador o empresa que la integre**, quien debe verificar su adecuación a la normativa vigente antes de usar en producción.
> - El autor no asume ninguna responsabilidad por errores, omisiones, pérdidas económicas, sanciones fiscales ni cualquier otro daño derivado del uso de este software, directo o indirecto.
>
> Véase también la cláusula `WITHOUT WARRANTY` de la [licencia MIT](LICENSE).

---

## Instalación

Siempre por tag git explícito (librería fiscal — nunca `#main` ni rangos semver):

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v2.0.0
```

## Uso

```ts
import { buildInvoiceRecord, centsToImporte } from 'verifactu-js' // ESM
const { buildInvoiceRecord } = require('verifactu-js')            // CJS (Node)

const { hash, xml, qrUrl, fechaHoraGenRegistro } = await buildInvoiceRecord({
  config: {
    nif: 'B12345678',
    nombreRazon: 'Mi Empresa, S.L.',
    softwareNif: 'B87654321',
    softwareNombre: 'MiTPV',
    softwareVersion: '1.0',
    softwareId: 'MT', // máx. 2 caracteres (límite del XSD de AEAT)
  },
  numSerie: 'A-2026-000042',
  fecha: new Date(),
  descripcion: 'Venta de productos',
  desgloseIva: [
    { tipoImpositivo: '10', baseImponible: '11.55', cuotaRepercutida: '1.05' },
  ],
  cuotaTotal: '1.05',
  importeTotal: '12.60',
  esPrimerRegistro: false,
  // Datos del ÚLTIMO registro emitido — persistir {numSerie, fecha, huella, fechaHoraGenRegistro}
  registroAnterior: {
    numSerie: 'A-2026-000041',
    fecha: new Date('2026-06-14'),
    huella: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
  },
})
```

También: `buildBatchInvoiceRecords(inputs, startingRef)` para encadenar N facturas,
`buildAnulacionRecord()` para anulaciones y `wrapForSoap(records, cabecera)` para el payload de envío.

## Documentación

- [BIBLE-FUNCTIONAL.md](BIBLE-FUNCTIONAL.md) — contexto legal, casos de uso, alcance, formatos de datos
- [BIBLE-TECHNICAL.md](BIBLE-TECHNICAL.md) — API completa, arquitectura, build, tests, proceso de actualización
- [CHANGELOG.md](CHANGELOG.md) — historial y guía de migración v1→v2

## Tests

```bash
npm run test    # 54 tests — incluye los vectores oficiales AEAT y validación XSD con xmllint
```

## Licencia

[MIT](LICENSE) — © 2026 Alfonso Matos Martínez
