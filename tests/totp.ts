import { createHmac } from 'node:crypto'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input: string): Buffer {
  const clean = input.replace(/[\s=]/g, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const index = BASE32.indexOf(char)
    if (index < 0) throw new Error('La clave no es base32.')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

/**
 * Código TOTP (RFC 6238: HMAC-SHA1, 6 dígitos, 30 segundos) para las pruebas: hace de «app autenticadora»
 * sin agregar una dependencia. Recibe la dirección `otpauth://` o la clave en base32.
 */
export function totpCode(secretOrUri: string, at: number = Date.now()): string {
  const secret = secretOrUri.startsWith('otpauth:')
    ? (new URL(secretOrUri).searchParams.get('secret') ?? '')
    : secretOrUri
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)))
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = (digest.at(-1) ?? 0) & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, '0')
}
