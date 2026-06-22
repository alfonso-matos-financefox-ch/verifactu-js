# verifactu-js

Generación de datos fiscales VERI\*FACTU para software de facturación español (Real Decreto 1007/2023).

Produce hash SHA-256 encadenado + XML `RegistroFacturacion` + URL QR de verificación AEAT para cada factura emitida.

**Alcance:** facturas simplificadas F2 (tickets de caja) y facturas completas F1 (B2B con destinatario). No incluye firma .p12 ni envío SOAP — eso es responsabilidad de la capa integradora.

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

```bash
npm install verifactu-js
```

O directamente desde GitHub:

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v1.4.0
```

## Uso

```ts
import { buildTicketFiscalData } from 'verifactu-js'         // ESM
const { buildTicketFiscalData } = require('verifactu-js')    // CJS (Node)

const { hash, xml, qrUrl } = await buildTicketFiscalData({
  config: {
    nif: 'B12345678',
    nombreRazon: 'Mi Empresa, S.L.',
    softwareNif: 'B87654321',
    softwareNombre: 'MiTPV',
    softwareVersion: '1.0',
    softwareId: 'MITPV',
  },
  numSerie: 'A-2026-000042',
  serie: 'A',
  fecha: new Date(),
  numRegistro: 42,
  desgloseIva: [
    { tipoImpositivo: '10', baseImponible: '11.55', cuotaRepercutida: '1.05' },
  ],
  cuotaTotal: '1.05',
  importeTotal: '12.60',
  previousHash: '',   // '' si es el primer registro de la cadena
  esPrimerRegistro: true,
})
```

## Documentación

- [BIBLE-FUNCTIONAL.md](BIBLE-FUNCTIONAL.md) — contexto legal, casos de uso, alcance, formatos de datos
- [BIBLE-TECHNICAL.md](BIBLE-TECHNICAL.md) — API completa, arquitectura, build, tests, proceso de actualización

## Tests

```bash
npm run test    # 14 tests
```

## Licencia

[MIT](LICENSE) — © 2026 Alfonso Matos Martínez
