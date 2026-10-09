import { describe, expect, it } from 'vitest'
import { describeDevice, twoFactorSetup } from '@/features/users/lib/two-factor'
import { authErrorMessage } from '@/lib/auth/errors'
import { totpCode } from '../totp'

describe('twoFactorSetup', () => {
  const uri = 'otpauth://totp/Club:admin%40club.cl?secret=JBSWY3DPEHPK3PXP&issuer=Club'

  it('entrega el QR como imagen SVG incrustada y la clave en grupos de cuatro', () => {
    const setup = twoFactorSetup(uri)
    expect(setup?.uri).toBe(uri)
    expect(setup?.secret).toBe('JBSW Y3DP EHPK 3PXP')
    expect(setup?.qr.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    const svg = decodeURIComponent(setup?.qr.replace('data:image/svg+xml;utf8,', '') ?? '')
    expect(svg).toMatch(/^<svg[^>]*>/)
    expect(svg).not.toContain('<script')
  })

  it('rechaza lo que no es una dirección otpauth con clave', () => {
    for (const value of [
      'https://club.cl/?secret=X',
      'otpauth://totp/Club?issuer=Club',
      'no es una url',
      '',
    ]) {
      expect(twoFactorSetup(value)).toBeNull()
    }
  })
})

describe('describeDevice', () => {
  it('resume el navegador y el sistema en palabras simples', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
      ),
    ).toBe('Chrome en Android')
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari en iPhone o iPad')
    expect(
      describeDevice(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0',
      ),
    ).toBe('Edge en Windows')
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0')).toBe(
      'Firefox en Linux',
    )
    expect(describeDevice('curl/8.7.1')).toBe('Dispositivo desconocido')
    expect(describeDevice(null)).toBe('Dispositivo desconocido')
  })
})

describe('mensajes de la verificación en dos pasos', () => {
  it('están en español', () => {
    expect(authErrorMessage({ code: 'INVALID_CODE' })).toBe(
      'Ese código no es correcto. Revisa la app y vuelve a intentarlo.',
    )
    expect(authErrorMessage({ code: 'INVALID_BACKUP_CODE' })).toContain('código de respaldo')
    expect(authErrorMessage({ code: 'INVALID_TWO_FACTOR_COOKIE' })).toContain('Vuelve a escribir')
    expect(authErrorMessage({ code: 'ALGO_NUEVO' })).toBe(
      'No pudimos completar la acción. Inténtalo de nuevo en unos segundos.',
    )
  })
})

describe('totpCode (ayuda de las pruebas)', () => {
  it('coincide con los vectores de la RFC 6238 (SHA-1)', () => {
    // Clave ASCII «12345678901234567890» en base32.
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(totpCode(secret, 59_000)).toBe('287082')
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804')
    expect(totpCode(`otpauth://totp/x?secret=${secret}`, 1_234_567_890_000)).toBe('005924')
  })
})
