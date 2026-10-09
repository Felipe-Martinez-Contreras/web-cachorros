import 'server-only'
import { updateTag } from 'next/cache'
import type { ZodType } from 'zod'
import { db, type Tx } from '@/db/client'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { requirePermission, type SessionUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import type { Permission } from '@/lib/permissions'
import { runAction } from '@/lib/run-action'

/** Lo que devuelve la escritura de una entidad para auditar e invalidar. */
export type WriteOutcome = {
  id: string
  /** Frase para «Actividad»: «Creó la serie Honor». */
  summary: string
  meta?: Record<string, unknown>
  /** Tags extra que dependen de la fila escrita (por ejemplo `player:<id>`). */
  tags?: string[]
}

/** Rechazo de negocio dentro de la transacción (que se deshace): mensaje y, si aplica, el campo. */
export class Rejection extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'Rejection'
    this.field = field
  }
}

/** Los ids llegan enlazados desde el cliente: se validan antes de consultar. */
export function assertId(
  id: unknown,
  message = 'No encontramos ese registro. Puede que lo hayan eliminado.',
): string {
  if (!isUuid(id)) throw new Rejection(message)
  return id
}

type ConstraintMessages = Record<string, { message: string; field?: string }>

type MutationOptions<T> = {
  /** Nombre para auditoría y logs: `series.update`. */
  action: string
  permission: Permission
  entityType: string
  schema: ZodType<T>
  input: unknown
  write: (tx: Tx, data: T, user: SessionUser) => Promise<WriteOutcome>
  /** Tags que siempre invalida esta mutación (conjunto mínimo, especificación 3.4). */
  tags: string[]
  /** Mensajes en español para las restricciones de la BD que el usuario puede provocar. */
  constraints?: ConstraintMessages
}

type PgError = { code?: string; constraint_name?: string; cause?: unknown }

/** Drizzle envuelve el error de PostgreSQL: se busca en la cadena de causas. */
function pgError(error: unknown): PgError | null {
  let current = error as PgError | undefined
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current
    current = current.cause as PgError | undefined
  }
  return null
}

function rejected(message: string, field?: string): ActionResult<never> {
  // Con campo, el detalle se muestra junto a él y arriba va el mismo aviso general que usa la validación.
  return field
    ? { ok: false, message: 'Revisa los campos marcados.', fieldErrors: { [field]: [message] } }
    : fail(message)
}

function constraintFailure(error: unknown, constraints: ConstraintMessages): ActionResult<never> | null {
  const pg = pgError(error)
  if (!pg) return null
  const known = pg.constraint_name ? constraints[pg.constraint_name] : undefined
  if (known) return rejected(known.message, known.field)
  // ON DELETE RESTRICT: se intentó borrar algo que todavía tiene datos asociados.
  if (pg.code === '23001') {
    return fail('No se puede eliminar porque tiene datos asociados. Si ya no se usa, desactívalo.')
  }
  // Clave foránea al escribir: lo elegido en un selector fue eliminado mientras tanto.
  if (pg.code === '23503') {
    return fail('Uno de los datos elegidos ya no existe. Recarga la página y vuelve a intentarlo.')
  }
  if (pg.code === '23505') return fail('Ya existe un registro con esos datos.')
  return null
}

/**
 * Patrón obligatorio de las Server Actions (especificación 3.5) para las mutaciones de los catálogos del
 * panel: autorización → validación → escritura atómica → auditoría → invalidación mínima → resultado.
 */
export async function mutate<T>(options: MutationOptions<T>): Promise<ActionResult<{ id: string }>> {
  return runAction(options.action, async () => {
    const user = await requirePermission(options.permission) // 1. autorización
    const parsed = options.schema.safeParse(options.input) // 2. validación
    if (!parsed.success) return fail(parsed.error)

    let outcome: WriteOutcome
    try {
      outcome = await db.transaction(async (tx) => {
        const result = await options.write(tx, parsed.data, user) // 3. escritura atómica
        await audit(tx, user, options.action, {
          // 4. auditoría, en la misma transacción
          entityType: options.entityType,
          entityId: result.id,
          summary: result.summary,
          meta: result.meta,
        })
        return result
      })
    } catch (error) {
      if (error instanceof Rejection) return rejected(error.message, error.field)
      const failure = constraintFailure(error, options.constraints ?? {})
      if (failure) return failure
      throw error
    }

    for (const tag of new Set([...options.tags, ...(outcome.tags ?? [])])) updateTag(tag) // 5. invalidación
    return ok({ id: outcome.id }) // 6. resultado tipado
  })
}
