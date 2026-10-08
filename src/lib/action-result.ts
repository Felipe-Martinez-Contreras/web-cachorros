import type { ZodError } from 'zod'
import * as z from 'zod'

/** Resultado tipado de toda Server Action (especificación 3.5). */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(error: ZodError | string): ActionResult<never> {
  if (typeof error === 'string') return { ok: false, message: error }
  return {
    ok: false,
    message: 'Revisa los campos marcados.',
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  }
}
