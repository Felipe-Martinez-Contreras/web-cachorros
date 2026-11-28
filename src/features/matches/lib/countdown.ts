import { TZDate } from '@date-fns/tz'
import { differenceInCalendarDays } from 'date-fns'
import { TIME_ZONE } from '@/lib/clock'

export type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** El partido ya debería haber comenzado. */
  isPast: boolean
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Tiempo real que falta para el inicio. Es una diferencia entre instantes (UTC), así que el cambio de
 * horario de Chile no la altera: la noche en que se atrasa el reloj, «mañana a la misma hora» son 25 horas.
 */
export function countdownParts(target: Date | string, now: Date): CountdownParts {
  const remaining = new Date(target).getTime() - now.getTime()
  if (remaining <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
  return {
    days: Math.floor(remaining / DAY),
    hours: Math.floor((remaining % DAY) / HOUR),
    minutes: Math.floor((remaining % HOUR) / MINUTE),
    seconds: Math.floor((remaining % MINUTE) / SECOND),
    isPast: false,
  }
}

/** Placas de la cuenta regresiva: sin segundos, para que ninguna placa gire cada segundo. */
export const COUNTDOWN_UNITS = [
  ['days', 'días'],
  ['hours', 'horas'],
  ['minutes', 'min'],
] as const

/**
 * Cifras de cada placa de la cuenta regresiva, con dos dígitos («03»). Sin `parts` (antes de montar, en el
 * servidor) cada placa muestra «--» con el mismo ancho. Más de 99 días se muestran completos.
 */
export function countdownPlates(parts: CountdownParts | null): Record<CountdownUnit, string> {
  const plate = (value: number | undefined) => (value === undefined ? '--' : String(value).padStart(2, '0'))
  return {
    days: plate(parts?.days),
    hours: plate(parts?.hours),
    minutes: plate(parts?.minutes),
  }
}

export type CountdownUnit = (typeof COUNTDOWN_UNITS)[number][0]

/**
 * Milisegundos hasta que cambie el minuto que muestra la cuenta regresiva (`null` si ya comenzó). Así la
 * cuenta se recalcula una vez por minuto, justo a tiempo.
 */
export function msUntilNextMinute(target: Date | string, now: Date): number | null {
  const remaining = new Date(target).getTime() - now.getTime()
  if (remaining <= 0) return null
  return remaining % MINUTE || MINUTE
}

/** Días de calendario en Santiago entre hoy y la fecha (0 = hoy, 1 = mañana, negativos = pasado). */
export function calendarDaysUntil(target: Date | string, now: Date): number {
  return differenceInCalendarDays(
    new TZDate(new Date(target).getTime(), TIME_ZONE),
    new TZDate(now.getTime(), TIME_ZONE),
  )
}

/** «Hoy», «Mañana», «En 3 días», «Ayer», «Hace 2 días». */
export function relativeDayLabel(target: Date | string, now: Date): string {
  const days = calendarDaysUntil(target, now)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  if (days === -1) return 'Ayer'
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`
}

/** Inicio (00:00) del día de calendario en Santiago que está a `offsetDays` de `now`. */
export function startOfSantiagoDay(now: Date, offsetDays = 0): Date {
  const local = new TZDate(now.getTime(), TIME_ZONE)
  return new Date(
    new TZDate(local.getFullYear(), local.getMonth(), local.getDate() + offsetDays, TIME_ZONE).getTime(),
  )
}

/** Fecha y hora de pared en Santiago → instante. Lo usa el seed para programar partidos «el sábado a las 16:00». */
export function santiagoDateTime(now: Date, offsetDays: number, hour: number, minute = 0): Date {
  const local = new TZDate(now.getTime(), TIME_ZONE)
  return new Date(
    new TZDate(
      local.getFullYear(),
      local.getMonth(),
      local.getDate() + offsetDays,
      hour,
      minute,
      TIME_ZONE,
    ).getTime(),
  )
}
