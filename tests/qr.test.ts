import { describe, it, expect } from 'vitest'
import { buildQrUrl } from '../src/qr.js'

// Doc AEAT "especificaciones QR" v0.5.0 §5.1 y §8
describe('buildQrUrl', () => {
  const base = {
    nif: '89890001K',
    numSerie: '12345678-G33',
    fecha: '01-09-2024',
    importeTotal: '241.40',
  }

  it('producción → www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR', () => {
    const url = buildQrUrl({ ...base, testMode: false })
    expect(url).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.40',
    )
  })

  it('pruebas → prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR', () => {
    const url = buildQrUrl({ ...base, testMode: true })
    expect(url.startsWith('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?')).toBe(true)
  })

  it('parámetros en orden nif, numserie, fecha, importe', () => {
    const url = buildQrUrl({ ...base, testMode: false })
    const query = url.split('?')[1]!
    expect(query.split('&').map(p => p.split('=')[0])).toEqual([
      'nif',
      'numserie',
      'fecha',
      'importe',
    ])
  })

  it('URL-encoding de caracteres especiales en numserie (doc AEAT §4)', () => {
    const url = buildQrUrl({ ...base, numSerie: '12345678&G33', testMode: true })
    expect(url).toContain('numserie=12345678%26G33')
  })
})
