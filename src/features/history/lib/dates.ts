// Fechas de los hitos de la historia (especificación 6.4 y 8.4): de muchos solo se sabe el año, o el mes.
// La columna guarda una fecha completa y `date_precision` dice cuánto de ella es cierto. Lógica pura.

export type DatePrecision = 'dia' | 'mes' | 'anio'

export type MilestoneDateParts = { year: number; month: number | null; day: number | null }

const two = (value: number) => String(value).padStart(2, '0')

/** Año, mes y día (los dos últimos opcionales) → fecha de la columna y su precisión; `null` si no existe. */
export function toMilestoneDate(
  parts: MilestoneDateParts,
): { occurredOn: string; precision: DatePrecision } | null {
  const { year, month, day } = parts
  if (day !== null && month === null) return null
  const occurredOn = `${year}-${two(month ?? 1)}-${two(day ?? 1)}`
  const date = new Date(`${occurredOn}T12:00:00Z`)
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(occurredOn)) return null
  return { occurredOn, precision: day !== null ? 'dia' : month !== null ? 'mes' : 'anio' }
}

/** Lo inverso, para volver a llenar el formulario: solo las partes que la precisión respalda. */
export function fromMilestoneDate(occurredOn: string, precision: DatePrecision): MilestoneDateParts {
  const [year = 0, month = 1, day = 1] = occurredOn.split('-').map(Number)
  return {
    year,
    month: precision === 'anio' ? null : month,
    day: precision === 'dia' ? day : null,
  }
}

const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long', timeZone: 'UTC' })

/** «1 de abril de 1934», «abril de 1934» o «1934», según lo que se sabe. */
export function formatMilestoneDate(occurredOn: string, precision: DatePrecision): string {
  const { year, month, day } = fromMilestoneDate(occurredOn, precision)
  if (month === null) return String(year)
  const name = monthName.format(new Date(Date.UTC(2000, month - 1, 15)))
  return day === null ? `${name} de ${year}` : `${day} de ${name} de ${year}`
}

export function yearOf(occurredOn: string): number {
  return Number(occurredOn.slice(0, 4))
}

/** Década a la que pertenece un año: 1934 → 1930. */
export function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10
}

/** Décadas presentes en una lista de años, de la más antigua a la más reciente y sin repetir. */
export function decadesOf(years: readonly number[]): number[] {
  return [...new Set(years.map(decadeOf))].sort((a, b) => a - b)
}

/** Década pedida en la URL (`?decada=1930`); `null` si no es una de las que existen. */
export function resolveDecade(
  param: string | string[] | undefined,
  available: readonly number[],
): number | null {
  const value = Number(Array.isArray(param) ? param[0] : param)
  return available.includes(value) ? value : null
}
