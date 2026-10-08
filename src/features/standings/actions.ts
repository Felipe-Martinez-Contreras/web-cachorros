'use server'

import { eq } from 'drizzle-orm'
import { standingsRows, standingsTables } from '@/db/schema'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { z } from '@/lib/zod'
import { newStandingsSchema, standingsSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const NOT_FOUND = 'No encontramos esa tabla. Puede que la hayan eliminado.'

export async function crearTabla(input: unknown): Result {
  return mutate({
    action: 'standings.create',
    permission: 'standings:write',
    entityType: 'standings_table',
    schema: newStandingsSchema,
    input,
    tags: [],
    constraints: {
      standings_tables_uq: {
        message: 'Esa serie ya tiene una tabla en esa competencia (con ese grupo). Edítala desde la lista.',
        field: 'seriesId',
      },
    },
    write: async (tx, data) => {
      const [row] = await tx.insert(standingsTables).values(data).returning({ id: standingsTables.id })
      if (!row) throw new Error('La tabla no se creó.')
      return {
        id: row.id,
        summary: 'Creó una tabla de posiciones',
        meta: data,
        tags: [tags.standings(data.competitionId, data.seriesId)],
      }
    },
  })
}

/** Guarda la grilla completa: reemplaza las filas en una sola transacción. */
export async function guardarTabla(id: string, input: unknown): Result {
  return mutate({
    action: 'standings.update',
    permission: 'standings:write',
    entityType: 'standings_table',
    schema: standingsSchema,
    input,
    tags: [],
    write: async (tx, { rows, ...header }) => {
      const tableId = assertId(id, NOT_FOUND)
      const [table] = await tx
        .update(standingsTables)
        .set(header)
        .where(eq(standingsTables.id, tableId))
        .returning({ competitionId: standingsTables.competitionId, seriesId: standingsTables.seriesId })
      if (!table) throw new Rejection(NOT_FOUND)
      await tx.delete(standingsRows).where(eq(standingsRows.tableId, tableId))
      if (rows.length > 0) {
        // En una tabla calculada los partidos salen de los resultados: solo se guardan los ajustes.
        const calculated = header.mode === 'calculada'
        await tx.insert(standingsRows).values(
          rows.map((row) => ({
            ...row,
            ...(calculated ? { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 } : {}),
            tableId,
          })),
        )
      }
      return {
        id: tableId,
        summary: `Actualizó una tabla de posiciones (${rows.length} equipos)`,
        meta: { mode: header.mode, asOf: header.asOf, teams: rows.length },
        tags: [tags.standings(table.competitionId, table.seriesId)],
      }
    },
  })
}

export async function eliminarTabla(id: string): Result {
  return mutate({
    action: 'standings.delete',
    permission: 'standings:write',
    entityType: 'standings_table',
    schema: z.unknown(),
    input: null,
    tags: [],
    write: async (tx) => {
      const tableId = assertId(id, NOT_FOUND)
      const [table] = await tx
        .delete(standingsTables)
        .where(eq(standingsTables.id, tableId))
        .returning({ competitionId: standingsTables.competitionId, seriesId: standingsTables.seriesId })
      if (!table) throw new Rejection(NOT_FOUND)
      return {
        id: tableId,
        summary: 'Eliminó una tabla de posiciones',
        tags: [tags.standings(table.competitionId, table.seriesId)],
      }
    },
  })
}
