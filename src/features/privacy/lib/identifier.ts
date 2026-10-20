import { toE164 } from '@/lib/phone'
import { formatRut, isValidRut } from '@/lib/rut'

/** Cómo se busca a una persona en sus datos (especificación 9.6): correo, RUT o celular. Lógica pura. */
export type PersonIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'rut'; value: string }
  | { kind: 'phone'; value: string }

export const identifierKindLabels: Record<PersonIdentifier['kind'], string> = {
  email: 'correo',
  rut: 'RUT',
  phone: 'celular',
}

/**
 * Reconoce lo que se escribió y lo deja en el formato en que se guarda (correo en minúsculas, RUT con puntos
 * y guion, celular en E.164). El RUT se pide con guion: sin él, `912345678` sería a la vez RUT y celular.
 */
export function parseIdentifier(input: string): PersonIdentifier | null {
  const text = input.trim()
  if (text.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? { kind: 'email', value: text.toLowerCase() } : null
  }
  if (/^[\d.]+-[\dkK]$/.test(text)) return isValidRut(text) ? { kind: 'rut', value: formatRut(text) } : null
  const phone = toE164(text)
  return phone ? { kind: 'phone', value: phone } : null
}
