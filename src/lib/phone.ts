const E164 = /^\+[1-9]\d{7,14}$/

/**
 * Teléfono tal como lo escribe una persona → E.164 (especificación 3.8). Acepta espacios, guiones y
 * paréntesis; un número chileno sin código de país (celular «9 1234 5678» o fijo de 9 dígitos) recibe el
 * +56. Devuelve `null` si no es un teléfono reconocible.
 */
export function toE164(input: string): string | null {
  const text = input.trim()
  const digits = text.replace(/[\s().-]/g, '')
  if (!/^\+?\d+$/.test(digits)) return null
  if (digits.startsWith('+')) return E164.test(digits) ? digits : null
  // Chile: 9 dígitos nacionales (celulares con 9; fijos con el código de zona).
  if (/^[2-9]\d{8}$/.test(digits)) return `+56${digits}`
  if (/^56[2-9]\d{8}$/.test(digits)) return `+${digits}`
  return null
}
