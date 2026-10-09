'use server'

import { eq } from 'drizzle-orm'
import { playerStatAdjustments, players, seasons, squadRegistrations } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { adjustmentSchema, newPlayerSchema, playerSchema, registrationSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const PLAYER_TAGS = [tags.players(), tags.stats()]
const nothing = z.unknown()

const registrationConstraints = {
  squad_registrations_player_season_series_uq: {
    message: 'Ya está inscrito en esa serie y temporada.',
    field: 'seriesId',
  },
  squad_registrations_shirt_uq: {
    message: 'Ese número ya lo usa otro jugador de la serie en esa temporada.',
    field: 'shirtNumber',
  },
}

type PlayerData = z.output<typeof playerSchema>

function playerValues({ imageConsent, ...data }: PlayerData, previousConsentAt: Date | null) {
  // Se guarda cuándo se registró la autorización de imagen, no solo que existe.
  return { ...data, imageConsentAt: imageConsent ? (previousConsentAt ?? new Date()) : null }
}

export async function crearJugador(input: unknown): Result {
  return mutate({
    action: 'player.create',
    permission: 'players:write',
    entityType: 'player',
    schema: newPlayerSchema,
    input,
    tags: PLAYER_TAGS,
    constraints: registrationConstraints,
    write: async (tx, { seriesId, shirtNumber, ...data }) => {
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const slug = await resolveSlug(tx, players, `${data.firstName} ${data.lastName}`)
      const [row] = await tx
        .insert(players)
        .values({ ...playerValues(data, null), slug })
        .returning({ id: players.id })
      if (!row) throw new Error('El jugador no se creó.')

      if (seriesId) {
        const [season] = await tx.select({ id: seasons.id }).from(seasons).where(eq(seasons.isCurrent, true))
        if (!season) {
          throw new Rejection(
            'No hay una temporada marcada como actual: créala para poder inscribir.',
            'seriesId',
          )
        }
        await tx
          .insert(squadRegistrations)
          .values({ playerId: row.id, seasonId: season.id, seriesId, shirtNumber })
      }
      return {
        id: row.id,
        summary: `Creó al jugador ${data.firstName} ${data.lastName}`,
        // Sin fecha de nacimiento en la auditoría: es un dato privado.
        meta: { seriesId, shirtNumber },
        tags: [tags.player(row.id)],
      }
    },
  })
}

export async function actualizarJugador(id: string, input: unknown): Result {
  return mutate({
    action: 'player.update',
    permission: 'players:write',
    entityType: 'player',
    schema: playerSchema,
    input,
    tags: PLAYER_TAGS,
    write: async (tx, data) => {
      const playerId = assertId(id, 'No encontramos a ese jugador.')
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const [current] = await tx
        .select({
          slug: players.slug,
          firstName: players.firstName,
          lastName: players.lastName,
          imageConsentAt: players.imageConsentAt,
        })
        .from(players)
        .where(eq(players.id, playerId))
        .for('update')
      if (!current) throw new Rejection('No encontramos a ese jugador. Puede que lo hayan eliminado.')
      const sameName = current.firstName === data.firstName && current.lastName === data.lastName
      const slug = sameName
        ? current.slug
        : await resolveSlug(tx, players, `${data.firstName} ${data.lastName}`, playerId)
      await tx
        .update(players)
        .set({ ...playerValues(data, current.imageConsentAt), slug })
        .where(eq(players.id, playerId))
      await recordSlugChange(tx, 'player', playerId, current.slug, slug)
      return {
        id: playerId,
        summary: `Editó al jugador ${data.firstName} ${data.lastName}`,
        tags: [tags.player(playerId), tags.matches()],
      }
    },
  })
}

export async function eliminarJugador(id: string): Result {
  return mutate({
    action: 'player.delete',
    permission: 'players:write',
    entityType: 'player',
    schema: nothing,
    input: null,
    tags: PLAYER_TAGS,
    write: async (tx) => {
      const playerId = assertId(id, 'No encontramos a ese jugador.')
      // Las inscripciones se van con él; si ya jugó partidos, la BD lo impide y se pide desactivarlo.
      await tx.delete(squadRegistrations).where(eq(squadRegistrations.playerId, playerId))
      await tx.delete(playerStatAdjustments).where(eq(playerStatAdjustments.playerId, playerId))
      const [row] = await tx
        .delete(players)
        .where(eq(players.id, playerId))
        .returning({ firstName: players.firstName, lastName: players.lastName })
      if (!row) throw new Rejection('No encontramos a ese jugador. Puede que ya lo hayan eliminado.')
      return {
        id: playerId,
        summary: `Eliminó al jugador ${row.firstName} ${row.lastName}`,
        tags: [tags.player(playerId)],
      }
    },
  })
}

export async function inscribirJugador(playerId: string, input: unknown): Result {
  return mutate({
    action: 'player.registration.create',
    permission: 'players:write',
    entityType: 'squad_registration',
    schema: registrationSchema,
    input,
    tags: PLAYER_TAGS,
    constraints: registrationConstraints,
    write: async (tx, data) => {
      const id = assertId(playerId, 'No encontramos a ese jugador.')
      const [row] = await tx
        .insert(squadRegistrations)
        .values({ ...data, playerId: id })
        .returning({ id: squadRegistrations.id })
      if (!row) throw new Error('La inscripción no se creó.')
      return {
        id: row.id,
        summary: 'Inscribió a un jugador en una serie',
        meta: data,
        tags: [tags.player(id)],
      }
    },
  })
}

export async function actualizarInscripcion(registrationId: string, input: unknown): Result {
  return mutate({
    action: 'player.registration.update',
    permission: 'players:write',
    entityType: 'squad_registration',
    schema: registrationSchema,
    input,
    tags: PLAYER_TAGS,
    constraints: registrationConstraints,
    write: async (tx, data) => {
      const id = assertId(registrationId, 'No encontramos esa inscripción.')
      const [row] = await tx
        .update(squadRegistrations)
        .set(data)
        .where(eq(squadRegistrations.id, id))
        .returning({ playerId: squadRegistrations.playerId })
      if (!row) throw new Rejection('No encontramos esa inscripción. Puede que la hayan eliminado.')
      return { id, summary: 'Editó una inscripción', meta: data, tags: [tags.player(row.playerId)] }
    },
  })
}

export async function eliminarInscripcion(registrationId: string): Result {
  return mutate({
    action: 'player.registration.delete',
    permission: 'players:write',
    entityType: 'squad_registration',
    schema: nothing,
    input: null,
    tags: PLAYER_TAGS,
    write: async (tx) => {
      const id = assertId(registrationId, 'No encontramos esa inscripción.')
      const [row] = await tx
        .delete(squadRegistrations)
        .where(eq(squadRegistrations.id, id))
        .returning({ playerId: squadRegistrations.playerId })
      if (!row) throw new Rejection('No encontramos esa inscripción. Puede que ya la hayan eliminado.')
      return { id, summary: 'Eliminó una inscripción', tags: [tags.player(row.playerId)] }
    },
  })
}

/** Estadísticas históricas que se suman a las calculadas desde los partidos (especificación 8.6). */
export async function agregarAjuste(playerId: string, input: unknown): Result {
  return mutate({
    action: 'player.adjustment.create',
    permission: 'players:write',
    entityType: 'player_stat_adjustment',
    schema: adjustmentSchema,
    input,
    tags: PLAYER_TAGS,
    write: async (tx, data) => {
      const id = assertId(playerId, 'No encontramos a ese jugador.')
      const [row] = await tx
        .insert(playerStatAdjustments)
        .values({ ...data, playerId: id })
        .returning({ id: playerStatAdjustments.id })
      if (!row) throw new Error('El ajuste no se creó.')
      return { id: row.id, summary: 'Agregó estadísticas históricas', meta: data, tags: [tags.player(id)] }
    },
  })
}

export async function eliminarAjuste(adjustmentId: string): Result {
  return mutate({
    action: 'player.adjustment.delete',
    permission: 'players:write',
    entityType: 'player_stat_adjustment',
    schema: nothing,
    input: null,
    tags: PLAYER_TAGS,
    write: async (tx) => {
      const id = assertId(adjustmentId, 'No encontramos ese ajuste.')
      const [row] = await tx
        .delete(playerStatAdjustments)
        .where(eq(playerStatAdjustments.id, id))
        .returning({ playerId: playerStatAdjustments.playerId })
      if (!row) throw new Rejection('No encontramos ese ajuste. Puede que ya lo hayan eliminado.')
      return { id, summary: 'Eliminó estadísticas históricas', tags: [tags.player(row.playerId)] }
    },
  })
}
