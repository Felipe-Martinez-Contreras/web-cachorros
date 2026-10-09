'use server'

import { asc, eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { hallOfFame, historicKits, historyMilestones, honours } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import { type ActionResult, fail } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { z } from '@/lib/zod'
import { toMilestoneDate } from './lib/dates'
import { honourSchema, idolSchema, kitSchema, milestoneSchema } from './schemas'
import { type HistorySection, isHistorySection } from './sections'

type Result = Promise<ActionResult<{ id: string }>>

const HISTORY_TAGS = [tags.history()]
const nothing = z.unknown()
const GONE = 'No encontramos ese registro. Puede que lo hayan eliminado.'
const UNKNOWN_SECTION = 'Esa sección de Historia no existe.'

/** Crea (sin `id`) o edita un registro; devuelve su id o rechaza si ya no existe. */
function saved(row: { id: string } | undefined): string {
  if (!row) throw new Rejection(GONE)
  return row.id
}

type Handler = {
  entityType: string
  save: (id: string | null, input: unknown) => Result
  remove: (tx: Tx, id: string) => Promise<string | undefined>
  /** Solo las secciones con orden manual: filas en su orden actual y cómo escribir el nuevo. */
  order?: {
    list: (tx: Tx) => Promise<{ id: string; name: string }[]>
    set: (tx: Tx, id: string, sortOrder: number) => Promise<unknown>
  }
}

const base = { permission: 'history:write', tags: HISTORY_TAGS } as const
const verb = (id: string | null) => (id ? 'Editó' : 'Agregó')

const handlers: Record<HistorySection, Handler> = {
  hitos: {
    entityType: 'history_milestone',
    save: (id, input) =>
      mutate({
        ...base,
        action: id ? 'history_milestone.update' : 'history_milestone.create',
        entityType: 'history_milestone',
        schema: milestoneSchema,
        input,
        write: async (tx, data) => {
          await assertPublishableMedia(tx, data.imageMediaId, 'imageMediaId')
          const date = toMilestoneDate(data)
          if (!date) throw new Rejection('Esa fecha no existe.', 'day')
          const values = {
            title: data.title,
            body: data.body,
            imageMediaId: data.imageMediaId,
            isPlaceholder: data.isPlaceholder,
            occurredOn: date.occurredOn,
            datePrecision: date.precision,
          }
          const [row] = id
            ? await tx
                .update(historyMilestones)
                .set(values)
                .where(eq(historyMilestones.id, assertId(id, GONE)))
                .returning({ id: historyMilestones.id })
            : await tx.insert(historyMilestones).values(values).returning({ id: historyMilestones.id })
          return { id: saved(row), summary: `${verb(id)} el hito «${data.title}»`, meta: values }
        },
      }),
    remove: async (tx, id) => {
      const [row] = await tx
        .delete(historyMilestones)
        .where(eq(historyMilestones.id, id))
        .returning({ name: historyMilestones.title })
      return row?.name
    },
  },
  titulos: {
    entityType: 'honour',
    save: (id, input) =>
      mutate({
        ...base,
        action: id ? 'honour.update' : 'honour.create',
        entityType: 'honour',
        schema: honourSchema,
        input,
        write: async (tx, data) => {
          await assertPublishableMedia(tx, data.imageMediaId, 'imageMediaId')
          const [row] = id
            ? await tx
                .update(honours)
                .set(data)
                .where(eq(honours.id, assertId(id, GONE)))
                .returning({ id: honours.id })
            : await tx.insert(honours).values(data).returning({ id: honours.id })
          return { id: saved(row), summary: `${verb(id)} el título «${data.name}»`, meta: data }
        },
      }),
    remove: async (tx, id) => {
      const [row] = await tx.delete(honours).where(eq(honours.id, id)).returning({ name: honours.name })
      return row?.name
    },
  },
  'salon-de-la-fama': {
    entityType: 'hall_of_fame',
    save: (id, input) =>
      mutate({
        ...base,
        action: id ? 'hall_of_fame.update' : 'hall_of_fame.create',
        entityType: 'hall_of_fame',
        schema: idolSchema,
        input,
        write: async (tx, data) => {
          await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
          const [row] = id
            ? await tx
                .update(hallOfFame)
                .set(data)
                .where(eq(hallOfFame.id, assertId(id, GONE)))
                .returning({ id: hallOfFame.id })
            : await tx
                .insert(hallOfFame)
                // Lo nuevo va al final de la lista.
                .values({ ...data, sortOrder: await nextSortOrder(tx, 'salon-de-la-fama') })
                .returning({ id: hallOfFame.id })
          return { id: saved(row), summary: `${verb(id)} a ${data.fullName} en el salón de la fama` }
        },
      }),
    remove: async (tx, id) => {
      const [row] = await tx
        .delete(hallOfFame)
        .where(eq(hallOfFame.id, id))
        .returning({ name: hallOfFame.fullName })
      return row?.name
    },
    order: {
      list: (tx) =>
        tx
          .select({ id: hallOfFame.id, name: hallOfFame.fullName })
          .from(hallOfFame)
          .orderBy(asc(hallOfFame.sortOrder), asc(hallOfFame.createdAt))
          .for('update'),
      set: (tx, id, sortOrder) => tx.update(hallOfFame).set({ sortOrder }).where(eq(hallOfFame.id, id)),
    },
  },
  camisetas: {
    entityType: 'historic_kit',
    save: (id, input) =>
      mutate({
        ...base,
        action: id ? 'historic_kit.update' : 'historic_kit.create',
        entityType: 'historic_kit',
        schema: kitSchema,
        input,
        write: async (tx, data) => {
          await assertPublishableMedia(tx, data.imageMediaId, 'imageMediaId')
          const [row] = id
            ? await tx
                .update(historicKits)
                .set(data)
                .where(eq(historicKits.id, assertId(id, GONE)))
                .returning({ id: historicKits.id })
            : await tx
                .insert(historicKits)
                .values({ ...data, sortOrder: await nextSortOrder(tx, 'camisetas') })
                .returning({ id: historicKits.id })
          return { id: saved(row), summary: `${verb(id)} una camiseta histórica`, meta: data }
        },
      }),
    remove: async (tx, id) => {
      const [row] = await tx
        .delete(historicKits)
        .where(eq(historicKits.id, id))
        .returning({ name: historicKits.description })
      return row?.name
    },
    order: {
      list: (tx) =>
        tx
          .select({ id: historicKits.id, name: historicKits.description })
          .from(historicKits)
          .orderBy(asc(historicKits.sortOrder), asc(historicKits.createdAt))
          .for('update'),
      set: (tx, id, sortOrder) => tx.update(historicKits).set({ sortOrder }).where(eq(historicKits.id, id)),
    },
  },
}

async function nextSortOrder(tx: Tx, section: 'salon-de-la-fama' | 'camisetas'): Promise<number> {
  const rows = (await handlers[section].order?.list(tx)) ?? []
  return (rows.length + 1) * 10
}

/** Crea un registro de Historia en la sección indicada. */
export async function crearRegistroDeHistoria(section: string, input: unknown): Result {
  if (!isHistorySection(section)) return fail(UNKNOWN_SECTION)
  return handlers[section].save(null, input)
}

export async function actualizarRegistroDeHistoria(section: string, id: string, input: unknown): Result {
  if (!isHistorySection(section)) return fail(UNKNOWN_SECTION)
  return handlers[section].save(id, input)
}

export async function eliminarRegistroDeHistoria(section: string, id: string): Result {
  if (!isHistorySection(section)) return fail(UNKNOWN_SECTION)
  const handler = handlers[section]
  return mutate({
    ...base,
    action: `${handler.entityType}.delete`,
    entityType: handler.entityType,
    schema: nothing,
    input: null,
    write: async (tx) => {
      const rowId = assertId(id, GONE)
      const name = await handler.remove(tx, rowId)
      if (name === undefined)
        throw new Rejection('No encontramos ese registro. Puede que ya lo hayan eliminado.')
      return { id: rowId, summary: `Eliminó de Historia: «${name}»` }
    },
  })
}

/** Sube o baja un registro en las secciones con orden manual (salón de la fama y camisetas). */
export async function moverRegistroDeHistoria(
  section: string,
  id: string,
  direction: 'subir' | 'bajar',
): Result {
  if (!isHistorySection(section)) return fail(UNKNOWN_SECTION)
  const handler = handlers[section]
  const order = handler.order
  if (!order) return fail('Esa sección se ordena sola, por fecha.')
  return mutate({
    ...base,
    action: `${handler.entityType}.reorder`,
    entityType: handler.entityType,
    schema: nothing,
    input: null,
    write: async (tx) => {
      const rowId = assertId(id, GONE)
      const rows = await order.list(tx)
      const index = rows.findIndex((row) => row.id === rowId)
      const target = direction === 'subir' ? index - 1 : index + 1
      const moved = rows[index]
      const other = rows[target]
      if (!moved) throw new Rejection(GONE)
      if (!other) throw new Rejection('Ya está en el extremo de la lista.')
      rows[index] = other
      rows[target] = moved
      // Se renumera todo de 10 en 10: el orden queda limpio aunque hubiera valores repetidos.
      for (const [position, row] of rows.entries()) await order.set(tx, row.id, (position + 1) * 10)
      return { id: rowId, summary: `Cambió el orden de «${moved.name}» en Historia` }
    },
  })
}
