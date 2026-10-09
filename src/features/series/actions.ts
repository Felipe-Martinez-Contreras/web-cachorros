'use server'

import { and, asc, eq, ne, sql } from 'drizzle-orm'
import {
  competitions,
  seasons,
  series,
  siteSettings,
  squadRegistrations,
  staffAssignments,
} from '@/db/schema'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { competitionSchema, copySquadSchema, seasonSchema, seriesSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

// Las series, temporadas y competencias aparecen en el fixture, el plantel y la portada.
const SPORT_TAGS = [tags.matches(), tags.players(), tags.stats(), tags.settings()]
const nothing = z.unknown()

const seriesConstraints = {
  series_slug_uq: { message: 'Ya existe una serie con ese nombre.', field: 'name' },
}

export async function crearSerie(input: unknown): Result {
  return mutate({
    action: 'series.create',
    permission: 'sport:write',
    entityType: 'series',
    schema: seriesSchema,
    input,
    tags: SPORT_TAGS,
    constraints: seriesConstraints,
    write: async (tx, data) => {
      const slug = await resolveSlug(tx, series, data.name)
      const [last] = await tx.select({ max: sql<number>`coalesce(max(${series.sortOrder}), 0)` }).from(series)
      const [row] = await tx
        .insert(series)
        .values({ ...data, slug, sortOrder: (last?.max ?? 0) + 10 })
        .returning({ id: series.id })
      if (!row) throw new Error('La serie no se creó.')
      return { id: row.id, summary: `Creó la serie ${data.name}`, meta: data }
    },
  })
}

export async function actualizarSerie(id: string, input: unknown): Result {
  return mutate({
    action: 'series.update',
    permission: 'sport:write',
    entityType: 'series',
    schema: seriesSchema,
    input,
    tags: SPORT_TAGS,
    constraints: seriesConstraints,
    write: async (tx, data) => {
      const seriesId = assertId(id, 'No encontramos esa serie.')
      const [current] = await tx
        .select({ slug: series.slug, name: series.name })
        .from(series)
        .where(eq(series.id, seriesId))
        .for('update')
      if (!current) throw new Rejection('No encontramos esa serie. Puede que la hayan eliminado.')
      const slug =
        data.name === current.name ? current.slug : await resolveSlug(tx, series, data.name, seriesId)
      await tx
        .update(series)
        .set({ ...data, slug })
        .where(eq(series.id, seriesId))
      await recordSlugChange(tx, 'series', seriesId, current.slug, slug)
      return { id: seriesId, summary: `Editó la serie ${data.name}`, meta: data }
    },
  })
}

/** Sube o baja una serie en el orden en que se muestran (botones accesibles, especificación 7.4). */
export async function moverSerie(id: string, direction: 'subir' | 'bajar'): Result {
  return mutate({
    action: 'series.reorder',
    permission: 'sport:write',
    entityType: 'series',
    schema: nothing,
    input: null,
    tags: SPORT_TAGS,
    write: async (tx) => {
      const seriesId = assertId(id, 'No encontramos esa serie.')
      const rows = await tx
        .select({ id: series.id, name: series.name })
        .from(series)
        .orderBy(asc(series.sortOrder), asc(series.name))
        .for('update')
      const index = rows.findIndex((row) => row.id === seriesId)
      const target = direction === 'subir' ? index - 1 : index + 1
      const moved = rows[index]
      const other = rows[target]
      if (!moved) throw new Rejection('No encontramos esa serie.')
      if (!other) throw new Rejection('Esa serie ya está en el extremo de la lista.')
      rows[index] = other
      rows[target] = moved
      // Se renumera todo de 10 en 10: el orden queda limpio aunque hubiera valores repetidos.
      for (const [position, row] of rows.entries()) {
        await tx
          .update(series)
          .set({ sortOrder: (position + 1) * 10 })
          .where(eq(series.id, row.id))
      }
      return { id: seriesId, summary: `Cambió el orden de la serie ${moved.name}` }
    },
  })
}

export async function eliminarSerie(id: string): Result {
  return mutate({
    action: 'series.delete',
    permission: 'sport:write',
    entityType: 'series',
    schema: nothing,
    input: null,
    tags: SPORT_TAGS,
    write: async (tx) => {
      const seriesId = assertId(id, 'No encontramos esa serie.')
      const [featured] = await tx
        .select({ id: siteSettings.id })
        .from(siteSettings)
        .where(eq(siteSettings.featuredSeriesId, seriesId))
      if (featured) {
        throw new Rejection(
          'Es la serie destacada de la portada. Elige otra en Configuración antes de eliminarla.',
        )
      }
      const [row] = await tx.delete(series).where(eq(series.id, seriesId)).returning({ name: series.name })
      if (!row) throw new Rejection('No encontramos esa serie. Puede que ya la hayan eliminado.')
      return { id: seriesId, summary: `Eliminó la serie ${row.name}` }
    },
  })
}

const seasonConstraints = {
  seasons_name_uq: { message: 'Ya existe una temporada con ese nombre.', field: 'name' },
}

export async function crearTemporada(input: unknown): Result {
  return mutate({
    action: 'season.create',
    permission: 'sport:write',
    entityType: 'season',
    schema: seasonSchema,
    input,
    tags: SPORT_TAGS,
    constraints: seasonConstraints,
    write: async (tx, data) => {
      // Una sola temporada actual (8.6): antes de marcar esta, se desmarca la anterior.
      if (data.isCurrent)
        await tx.update(seasons).set({ isCurrent: false }).where(eq(seasons.isCurrent, true))
      const [row] = await tx.insert(seasons).values(data).returning({ id: seasons.id })
      if (!row) throw new Error('La temporada no se creó.')
      return { id: row.id, summary: `Creó la temporada ${data.name}`, meta: data }
    },
  })
}

export async function actualizarTemporada(id: string, input: unknown): Result {
  return mutate({
    action: 'season.update',
    permission: 'sport:write',
    entityType: 'season',
    schema: seasonSchema,
    input,
    tags: SPORT_TAGS,
    constraints: seasonConstraints,
    write: async (tx, data) => {
      const seasonId = assertId(id, 'No encontramos esa temporada.')
      if (data.isCurrent) {
        await tx
          .update(seasons)
          .set({ isCurrent: false })
          .where(and(eq(seasons.isCurrent, true), ne(seasons.id, seasonId)))
      }
      const [row] = await tx
        .update(seasons)
        .set(data)
        .where(eq(seasons.id, seasonId))
        .returning({ id: seasons.id })
      if (!row) throw new Rejection('No encontramos esa temporada. Puede que la hayan eliminado.')
      return { id: seasonId, summary: `Editó la temporada ${data.name}`, meta: data }
    },
  })
}

export async function eliminarTemporada(id: string): Result {
  return mutate({
    action: 'season.delete',
    permission: 'sport:write',
    entityType: 'season',
    schema: nothing,
    input: null,
    tags: SPORT_TAGS,
    write: async (tx) => {
      const seasonId = assertId(id, 'No encontramos esa temporada.')
      const [row] = await tx.delete(seasons).where(eq(seasons.id, seasonId)).returning({ name: seasons.name })
      if (!row) throw new Rejection('No encontramos esa temporada. Puede que ya la hayan eliminado.')
      return { id: seasonId, summary: `Eliminó la temporada ${row.name}` }
    },
  })
}

/**
 * Duplica el plantel y el cuerpo técnico de otra temporada en esta (especificación 7.4). No copia las
 * bajas y nunca pisa lo que ya está inscrito: se puede repetir sin duplicar.
 */
export async function copiarPlantel(id: string, input: unknown): Result {
  return mutate({
    action: 'season.copy-squad',
    permission: 'players:write',
    entityType: 'season',
    schema: copySquadSchema,
    input,
    tags: [tags.players(), tags.stats()],
    write: async (tx, data) => {
      const seasonId = assertId(id, 'No encontramos esa temporada.')
      if (data.fromSeasonId === seasonId) {
        throw new Rejection('Elige una temporada distinta de esta.', 'fromSeasonId')
      }
      const found = await tx
        .select({ id: seasons.id, name: seasons.name })
        .from(seasons)
        .where(sql`${seasons.id} in (${seasonId}, ${data.fromSeasonId})`)
      const target = found.find((row) => row.id === seasonId)
      const source = found.find((row) => row.id === data.fromSeasonId)
      if (!target || !source) throw new Rejection('No encontramos una de las temporadas.', 'fromSeasonId')

      const registrations = await tx
        .select({
          playerId: squadRegistrations.playerId,
          seriesId: squadRegistrations.seriesId,
          shirtNumber: squadRegistrations.shirtNumber,
          isCaptain: squadRegistrations.isCaptain,
        })
        .from(squadRegistrations)
        .where(and(eq(squadRegistrations.seasonId, data.fromSeasonId), ne(squadRegistrations.status, 'baja')))
      const players =
        registrations.length === 0
          ? []
          : await tx
              .insert(squadRegistrations)
              .values(registrations.map((row) => ({ ...row, seasonId })))
              // Ya inscrito, o su número lo tomó otro jugador: se deja como está.
              .onConflictDoNothing()
              .returning({ id: squadRegistrations.id })

      const assignments = await tx
        .select({
          staffId: staffAssignments.staffId,
          seriesId: staffAssignments.seriesId,
          role: staffAssignments.role,
          sortOrder: staffAssignments.sortOrder,
        })
        .from(staffAssignments)
        .where(eq(staffAssignments.seasonId, data.fromSeasonId))
      const staff =
        assignments.length === 0
          ? []
          : await tx
              .insert(staffAssignments)
              .values(assignments.map((row) => ({ ...row, seasonId })))
              .onConflictDoNothing()
              .returning({ id: staffAssignments.id })

      return {
        id: seasonId,
        summary: `Copió el plantel de ${source.name} a ${target.name}`,
        meta: { fromSeasonId: data.fromSeasonId, players: players.length, staff: staff.length },
      }
    },
  })
}

const competitionConstraints = {
  competitions_season_name_uq: {
    message: 'Esa temporada ya tiene una competencia con ese nombre.',
    field: 'name',
  },
}

export async function crearCompetencia(input: unknown): Result {
  return mutate({
    action: 'competition.create',
    permission: 'sport:write',
    entityType: 'competition',
    schema: competitionSchema,
    input,
    tags: SPORT_TAGS,
    constraints: competitionConstraints,
    write: async (tx, data) => {
      const [row] = await tx.insert(competitions).values(data).returning({ id: competitions.id })
      if (!row) throw new Error('La competencia no se creó.')
      return { id: row.id, summary: `Creó la competencia ${data.name}`, meta: data }
    },
  })
}

export async function actualizarCompetencia(id: string, input: unknown): Result {
  return mutate({
    action: 'competition.update',
    permission: 'sport:write',
    entityType: 'competition',
    schema: competitionSchema,
    input,
    tags: SPORT_TAGS,
    constraints: competitionConstraints,
    write: async (tx, data) => {
      const competitionId = assertId(id, 'No encontramos esa competencia.')
      const [row] = await tx
        .update(competitions)
        .set(data)
        .where(eq(competitions.id, competitionId))
        .returning({ id: competitions.id })
      if (!row) throw new Rejection('No encontramos esa competencia. Puede que la hayan eliminado.')
      return { id: competitionId, summary: `Editó la competencia ${data.name}`, meta: data }
    },
  })
}

export async function eliminarCompetencia(id: string): Result {
  return mutate({
    action: 'competition.delete',
    permission: 'sport:write',
    entityType: 'competition',
    schema: nothing,
    input: null,
    tags: SPORT_TAGS,
    write: async (tx) => {
      const competitionId = assertId(id, 'No encontramos esa competencia.')
      const [row] = await tx
        .delete(competitions)
        .where(eq(competitions.id, competitionId))
        .returning({ name: competitions.name })
      if (!row) throw new Rejection('No encontramos esa competencia. Puede que ya la hayan eliminado.')
      return { id: competitionId, summary: `Eliminó la competencia ${row.name}` }
    },
  })
}
