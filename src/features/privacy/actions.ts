'use server'

import { members } from '@/db/schema'
import { ANONYMIZED_NAME } from '@/features/inbox/retention'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { requirePermission } from '@/lib/auth/session'
import { mutate, Rejection } from '@/lib/entity-action'
import { runAction } from '@/lib/run-action'
import {
  findPersonalData,
  PERSONAL_DATA_SOURCES,
  type PersonalDataSource,
  type PersonalDataSummary,
  personalDataCondition,
  summarize,
} from './queries'
import { personalDataQuerySchema } from './schemas'

/** Cuántos registros hay de una persona y dónde. Es una lectura: no se audita (sí exportar y eliminar). */
export async function buscarDatosPersonales(input: unknown): Promise<ActionResult<PersonalDataSummary>> {
  return runAction('personal_data.search', async () => {
    await requirePermission('privacy:manage')
    const parsed = personalDataQuerySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error)
    const who = parsed.data.q
    return ok(summarize(who, await findPersonalData(who)))
  })
}

/**
 * Derecho de supresión (especificación 9.6): borra las solicitudes y los mensajes de la persona, y en el
 * padrón deja al socio como «baja» sin nombre ni contacto (el número sigue reservado). Todo en una
 * transacción; la auditoría anota cuántos registros y por qué dato se buscó, nunca el dato.
 */
export async function eliminarDatosPersonales(input: unknown): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'personal_data.erase',
    permission: 'privacy:manage',
    entityType: 'personal_data',
    schema: personalDataQuerySchema,
    input,
    tags: [],
    write: async (tx, { q: who }) => {
      const counts = {} as Record<PersonalDataSource, number>
      for (const source of Object.keys(PERSONAL_DATA_SOURCES) as PersonalDataSource[]) {
        const condition = personalDataCondition(source, who)
        if (!condition) {
          counts[source] = 0
          continue
        }
        if (source === 'members') {
          const rows = await tx
            .update(members)
            .set({ fullName: ANONYMIZED_NAME, rut: null, email: null, phoneE164: null, status: 'baja' })
            .where(condition)
            .returning({ id: members.id })
          counts[source] = rows.length
        } else {
          const { table } = PERSONAL_DATA_SOURCES[source]
          const rows = await tx.delete(table).where(condition).returning({ id: table.id })
          counts[source] = rows.length
        }
      }
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
      if (total === 0) throw new Rejection('No encontramos datos de esa persona.')
      return {
        id: 'persona',
        summary: `Eliminó los datos de una persona (${total} ${total === 1 ? 'registro' : 'registros'})`,
        meta: { kind: who.kind, ...counts },
      }
    },
  })
}
