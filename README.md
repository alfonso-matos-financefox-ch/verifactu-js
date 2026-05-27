# verifactu-js

Generación de datos fiscales VERI\*FACTU para software de facturación español (Real Decreto 1007/2023).

Produce hash SHA-256 encadenado + XML `RegistroFacturacion` + URL QR de verificación AEAT para cada factura emitida.

**Alcance:** facturas simplificadas F2 (tickets de caja). No incluye firma .p12 ni envío SOAP — eso es responsabilidad de la Cloud Function integradora.

---

## Instalación

```bash
npm install github:alfonso-matos-financefox-ch/verifactu-js#v1.1.0
```

Requiere acceso al repo privado (SSH o token configurado en la máquina).

## Uso

```ts
import { buildTicketFiscalData } from 'verifactu-js'         // ESM
const { buildTicketFiscalData } = require('verifactu-js')    // CJS (Node)

const { hash, xml, qrUrl } = await buildTicketFiscalData({
  config: {
    nif: 'B62215389',
    nombreRazon: 'GRANJA I XOCOLATERIA LA PALLARESA, S.L.',
    softwareNif: 'B12345678',
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
  previousHash: '<hash del ticket anterior, o "" si es el primero>',
  esPrimerRegistro: false,
})
```

## Documentación

- [BIBLE-FUNCTIONAL.md](BIBLE-FUNCTIONAL.md) — contexto legal, casos de uso, alcance, formatos de datos
- [BIBLE-TECHNICAL.md](BIBLE-TECHNICAL.md) — API completa, arquitectura, build, tests, proceso de actualización

## Tests

```bash
npm run test    # 14 tests
```

## Actualizar en proyectos consumidores

```bash
# En package.json del consumidor:
# "verifactu-js": "github:alfonso-matos-financefox-ch/verifactu-js#vX.Y.Z"
npm install github:alfonso-matos-financefox-ch/verifactu-js#vX.Y.Z
```

Nunca apuntar a `#main` — los cambios en una librería fiscal deben ser explícitos.
