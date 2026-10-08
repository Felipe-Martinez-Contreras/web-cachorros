/** Dígito verificador de un RUT (módulo 11). */
export function rutCheckDigit(body: number): string {
  let sum = 0
  let factor = 2
  for (let rest = body; rest > 0; rest = Math.floor(rest / 10)) {
    sum += (rest % 10) * factor
    factor = factor === 7 ? 2 : factor + 1
  }
  const result = 11 - (sum % 11)
  if (result === 11) return '0'
  if (result === 10) return 'K'
  return String(result)
}

/** Quita puntos, guion y espacios: `12.345.678-5` → `123456785`. */
export function cleanRut(input: string): string {
  return input.replace(/[^0-9kK]/g, '').toUpperCase()
}

export function isValidRut(input: string): boolean {
  const clean = cleanRut(input)
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false
  return rutCheckDigit(Number(clean.slice(0, -1))) === clean.slice(-1)
}

/** Formato chileno: `12.345.678-5`. Si no es un RUT reconocible, devuelve el texto original. */
export function formatRut(input: string): string {
  const clean = cleanRut(input)
  if (clean.length < 2) return input
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${body}-${clean.slice(-1)}`
}
