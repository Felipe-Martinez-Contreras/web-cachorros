import { createHmac, timingSafeEqual } from 'node:crypto'

/** Tiempo mínimo de llenado (especificación 9.4). */
export const MIN_FILL_MS = 3000
/** Un formulario abierto por más tiempo se debe recargar. */
export const MAX_FILL_MS = 24 * 60 * 60 * 1000

export type StampResult = 'ok' | 'too-fast' | 'expired' | 'invalid'

const sign = (issuedAt: string, key: string) =>
  createHmac('sha256', key).update(`formulario:${issuedAt}`).digest('base64url')

/** `<milisegundos>.<firma>`: el servidor puede comprobar cuándo se dibujó sin guardar nada. */
export function issueStamp(key: string, now = Date.now()): string {
  const issuedAt = String(now)
  return `${issuedAt}.${sign(issuedAt, key)}`
}

export function checkStamp(stamp: string | null, key: string, now = Date.now()): StampResult {
  const [issuedAt, signature, ...rest] = (stamp ?? '').split('.')
  if (!issuedAt || !signature || rest.length > 0 || !/^\d{13}$/.test(issuedAt)) return 'invalid'
  const expected = Buffer.from(sign(issuedAt, key))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return 'invalid'
  const elapsed = now - Number(issuedAt)
  if (elapsed < MIN_FILL_MS) return 'too-fast'
  if (elapsed > MAX_FILL_MS) return 'expired'
  return 'ok'
}

/** El campo trampa debe llegar vacío. */
export function isHoneypotFilled(value: FormDataEntryValue | null): boolean {
  return typeof value === 'string' ? value.trim() !== '' : value !== null
}
