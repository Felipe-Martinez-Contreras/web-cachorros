import { TIME_ZONE } from './clock'

// Único módulo de formatos (especificación 3.8): `Intl` con `es-CL` y `timeZone` explícito, para que el
// resultado sea idéntico en el servidor y en el navegador sin importar la zona del dispositivo.
const LOCALE = 'es-CL'

type DateInput = Date | string | number

const dateTimeParts = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const longParts = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const isoParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const numberFormat = new Intl.NumberFormat(LOCALE, { useGrouping: 'always', maximumFractionDigits: 0 })

function parts(format: Intl.DateTimeFormat, value: DateInput): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of format.formatToParts(new Date(value))) {
    // Algunas versiones de ICU abrevian con punto («sáb.», «oct.»): se quita para un formato estable.
    if (part.type !== 'literal') out[part.type] = part.value.replace('.', '')
  }
  return out
}

/** «16:00» */
export function formatTime(value: DateInput): string {
  const p = parts(dateTimeParts, value)
  return `${p.hour}:${p.minute}`
}

/** «sáb 10 oct» */
export function formatDayMonth(value: DateInput): string {
  const p = parts(dateTimeParts, value)
  return `${p.weekday} ${p.day} ${p.month}`
}

/** «sáb 10 oct · 16:00» */
export function formatMatchDate(value: DateInput): string {
  return `${formatDayMonth(value)} · ${formatTime(value)}`
}

/** «10 oct 2026» */
export function formatShortDate(value: DateInput): string {
  const p = parts(dateTimeParts, value)
  return `${p.day} ${p.month} ${p.year}`
}

/** «sábado 10 de octubre de 2026» */
export function formatLongDate(value: DateInput): string {
  const p = parts(longParts, value)
  return `${p.weekday} ${p.day} de ${p.month} de ${p.year}`
}

/** «sábado 10 de octubre de 2026, 16:00 h» */
export function formatLongDateTime(value: DateInput): string {
  return `${formatLongDate(value)}, ${formatTime(value)} h`
}

/** «10/10» (para «Actualizada al dd/mm»). */
export function formatDayMonthNumeric(value: DateInput): string {
  const [, month, day] = toIsoDate(value).split('-')
  return `${day}/${month}`
}

/** Fecha de calendario en Santiago como `YYYY-MM-DD`. */
export function toIsoDate(value: DateInput): string {
  const p = parts(isoParts, value)
  return `${p.year}-${p.month}-${p.day}`
}

/**
 * Una columna `date` de la BD (`YYYY-MM-DD`) no tiene zona horaria: se ancla al mediodía UTC para que
 * siga siendo el mismo día al formatearla en Santiago.
 */
export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00Z`)
}

/** «1.234» */
export function formatNumber(value: number): string {
  return numberFormat.format(value)
}

/** Pesos chilenos, sin decimales: «$15.000». */
export function formatClp(amount: number): string {
  return `${amount < 0 ? '-' : ''}$${numberFormat.format(Math.abs(amount))}`
}

/** Teléfono E.164 chileno para mostrar: `+56912345678` → «+56 9 1234 5678». Otros se devuelven tal cual. */
export function formatPhone(e164: string): string {
  const mobile = /^\+56(9)(\d{4})(\d{4})$/.exec(e164)
  if (mobile) return `+56 ${mobile[1]} ${mobile[2]} ${mobile[3]}`
  const landline = /^\+56(\d{2})(\d{3})(\d{4})$/.exec(e164)
  if (landline) return `+56 ${landline[1]} ${landline[2]} ${landline[3]}`
  return e164
}

/** Número para `https://wa.me/<número>`: sin `+` ni espacios. */
export function whatsappNumber(e164: string): string {
  return e164.replace(/\D/g, '')
}

/** Años cumplidos entre dos fechas de calendario (`YYYY-MM-DD`). */
export function yearsBetween(fromIso: string, toIso: string): number {
  const [fy = 0, fm = 0, fd = 0] = fromIso.split('-').map(Number)
  const [ty = 0, tm = 0, td = 0] = toIso.split('-').map(Number)
  const beforeBirthday = tm < fm || (tm === fm && td < fd)
  return ty - fy - (beforeBirthday ? 1 : 0)
}
