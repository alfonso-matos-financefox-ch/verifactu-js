// tests/submit.test.ts
import { describe, it, expect } from 'vitest'
import { submit } from '../src/index'
import type { VerifactuConfig } from '../src/index'

const config: VerifactuConfig = {
  nif:             'B12345678',
  nombreRazon:     'Test Restauració S.L.',
  softwareNif:     '00000000T',
  softwareNombre:  'test-sw',
  softwareVersion: '1.0',
  softwareId:      'TEST-001',
}

const fakeXml  = '<RegistroFacturacion/>'
const fakeHash = 'a3f8c1e2d4b7f90e1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4'

describe('submit', () => {
  it('mock mode: returns ok:true with 16-char uppercase hex CSV', async () => {
    const response = await submit(fakeXml, { ...config, testMode: true }, fakeHash)
    expect(response.ok).toBe(true)
    if (!response.ok) throw new Error('Expected ok:true')
    expect(response.csv).toHaveLength(16)
    expect(/^[0-9A-F]+$/.test(response.csv)).toBe(true)
  })

  it('mock mode: CSV is the first 16 chars of hash, uppercased', async () => {
    const response = await submit(fakeXml, { ...config, testMode: true }, fakeHash)
    if (!response.ok) throw new Error('Expected ok:true')
    expect(response.csv).toBe(fakeHash.slice(0, 16).toUpperCase())
  })

  it('mock mode: CSV is deterministic — same hash always yields same CSV', async () => {
    const r1 = await submit(fakeXml, { ...config, testMode: true }, fakeHash)
    const r2 = await submit(fakeXml, { ...config, testMode: true }, fakeHash)
    if (!r1.ok || !r2.ok) throw new Error('Expected ok:true')
    expect(r1.csv).toBe(r2.csv)
  })

  it('real mode: rejects with placeholder message', async () => {
    await expect(submit(fakeXml, { ...config, testMode: false }, fakeHash))
      .rejects.toThrow('Real SOAP not yet implemented')
  })
})
