import { z } from '@/lib/zod'

// Piezas de Zod para los formularios del panel. Un campo de formulario vacío llega como '' (o `null` si
// lo envía otro código): los opcionales lo convierten en `null`, que es lo que se guarda en la BD.

const blankToNull = (value: unknown) =>
  value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value

/** Texto obligatorio, sin espacios sobrantes. */
export function requiredText(message: string, max = 120) {
  return z.string({ error: message }).trim().min(1, message).max(max, `Usa como máximo ${max} caracteres.`)
}

/** Texto opcional: vacío → `null`. */
export function optionalText(max = 500) {
  return z.preprocess(
    blankToNull,
    z.string().trim().max(max, `Usa como máximo ${max} caracteres.`).nullable(),
  )
}

/** Entero obligatorio dentro de un rango. */
export function requiredInt(min: number, max: number, message: string) {
  return z.preprocess(
    blankToNull,
    z.coerce.number({ error: message }).int(message).min(min, message).max(max, message),
  )
}

/** Entero opcional dentro de un rango: vacío → `null`. */
export function optionalInt(min: number, max: number, message: string) {
  return z.preprocess(
    blankToNull,
    z.coerce.number({ error: message }).int(message).min(min, message).max(max, message).nullable(),
  )
}

/** Número decimal opcional (coordenadas). */
export function optionalNumber(min: number, max: number, message: string) {
  return z.preprocess(
    blankToNull,
    z.coerce.number({ error: message }).min(min, message).max(max, message).nullable(),
  )
}

export function requiredUuid(message: string) {
  return z.uuid({ error: message })
}

export function optionalUuid() {
  return z.preprocess(blankToNull, z.uuid({ error: 'Elige una opción de la lista.' }).nullable())
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Fecha de calendario `AAAA-MM-DD` (lo que entrega `<input type="date">`). */
export function requiredDate(message: string) {
  return z.string({ error: message }).regex(ISO_DATE, message).refine(isRealDate, message)
}

export function optionalDate(message = 'Escribe una fecha válida.') {
  return z.preprocess(blankToNull, z.string().regex(ISO_DATE, message).refine(isRealDate, message).nullable())
}

/** Hora `HH:MM` (lo que entrega `<input type="time">`). */
export function requiredTime(message: string) {
  return z.string({ error: message }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, message)
}

/** Casilla: acepta el booleano de react-hook-form y los valores de un formulario nativo. */
export function checkbox() {
  return z.preprocess((value) => value === true || value === 'on' || value === 'true', z.boolean())
}

/** Enum del dominio a partir de sus etiquetas (`src/lib/labels.ts`), sin importar el esquema de la BD. */
export function labeledEnum<T extends string>(labels: Record<T, string>, message: string) {
  return z.enum(Object.keys(labels) as [T, ...T[]], { error: message })
}

/** Opciones de un `<select>` a partir de las etiquetas de un enum. */
export function optionsFromLabels<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
