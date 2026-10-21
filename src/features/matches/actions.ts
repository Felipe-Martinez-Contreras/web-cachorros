'use server'

import { and, desc, eq, inArray, lt, ne, sql } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import {
  competitions,
  matchEvents,
  matches,
  matchLineups,
  players,
  seasons,
  series,
  squadRegistrations,
  teams,
} from '@/db/schema'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { eventPeriod, resolveTransition } from './lib/live'
import { clubSideOf, matchSlugBase, periodForMinute, roundLabelFor, santiagoWallTime } from './lib/schedule'
import { deriveScore } from './lib/score'
import {
  lineupSchema,
  matchdaySchema,
  matchEventSchema,
  matchResultSchema,
  matchSchema,
  matchStatusSchema,
  periodTransitionSchema,
  suspendMatchSchema,
  undoEventSchema,
} from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()
const NOT_FOUND = 'No encontramos ese partido. Puede que lo hayan eliminado.'

/** Conjunto mínimo de tags de un partido: su detalle, las listas, la franja en vivo, estadísticas y tabla. */
function matchTags(match: { id: string; competitionId: string; seriesId: string }): string[] {
  return [
    tags.match(match.id),
    tags.matches(),
    tags.live(),
    tags.stats(),
    tags.standings(match.competitionId, match.seriesId),
  ]
}

type MatchData = z.output<typeof matchSchema>

/** Completa lo que la app deriva del formulario: temporada, lado del club, rótulo de la fecha y slug. */
async function scheduleValues(tx: Tx, data: MatchData, currentId?: string) {
  const [competition] = await tx
    .select({ seasonId: competitions.seasonId, year: seasons.year })
    .from(competitions)
    .innerJoin(seasons, eq(seasons.id, competitions.seasonId))
    .where(eq(competitions.id, data.competitionId))
  if (!competition) throw new Rejection('Esa competencia ya no existe. Elige otra.', 'competitionId')
  const [serie] = await tx.select({ slug: series.slug }).from(series).where(eq(series.id, data.seriesId))
  if (!serie) throw new Rejection('Esa serie ya no existe. Elige otra.', 'seriesId')
  const sides = await tx
    .select({ id: teams.id, shortName: teams.shortName, isOwnClub: teams.isOwnClub })
    .from(teams)
    .where(inArray(teams.id, [data.homeTeamId, data.awayTeamId]))
  const home = sides.find((team) => team.id === data.homeTeamId)
  const away = sides.find((team) => team.id === data.awayTeamId)
  if (!home) throw new Rejection('Ese equipo ya no existe. Elige otro.', 'homeTeamId')
  if (!away) throw new Rejection('Ese equipo ya no existe. Elige otro.', 'awayTeamId')

  const ownTeamId = sides.find((team) => team.isOwnClub)?.id ?? null
  const roundLabel = roundLabelFor(data.roundNumber, data.roundLabel)
  const slug = await resolveSlug(
    tx,
    matches,
    matchSlugBase({
      seriesSlug: serie.slug,
      year: competition.year,
      roundNumber: data.roundNumber,
      roundLabel,
      homeShortName: home.shortName,
      awayShortName: away.shortName,
    }),
    currentId,
  )
  const { date, time, ...rest } = data
  return {
    ...rest,
    seasonId: competition.seasonId,
    kickoffAt: santiagoWallTime(date, time),
    roundLabel,
    clubSide: clubSideOf(data.homeTeamId, data.awayTeamId, ownTeamId),
    slug,
    label: `${home.shortName} vs ${away.shortName}`,
  }
}

export async function crearPartido(input: unknown): Result {
  return mutate({
    action: 'match.create',
    permission: 'matches:write',
    entityType: 'match',
    schema: matchSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const { label, ...values } = await scheduleValues(tx, data)
      const [row] = await tx.insert(matches).values(values).returning({ id: matches.id })
      if (!row) throw new Error('El partido no se creó.')
      return {
        id: row.id,
        summary: `Programó el partido ${label}`,
        meta: { kickoffAt: values.kickoffAt.toISOString(), seriesId: values.seriesId },
        tags: matchTags({ id: row.id, ...values }),
      }
    },
  })
}

export async function actualizarPartido(id: string, input: unknown): Result {
  return mutate({
    action: 'match.update',
    permission: 'matches:write',
    entityType: 'match',
    schema: matchSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const matchId = assertId(id, NOT_FOUND)
      const [current] = await tx
        .select({
          slug: matches.slug,
          competitionId: matches.competitionId,
          seriesId: matches.seriesId,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
          hasEvents: sql<boolean>`exists (select 1 from ${matchEvents} where ${matchEvents.matchId} = ${matches.id})`,
          hasLineup: sql<boolean>`exists (select 1 from ${matchLineups} where ${matchLineups.matchId} = ${matches.id})`,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .for('update')
      if (!current) throw new Rejection(NOT_FOUND)
      // Con resultado cargado, cambiar los equipos o la serie dejaría goles y nómina sin sentido.
      const changedSides =
        current.homeTeamId !== data.homeTeamId ||
        current.awayTeamId !== data.awayTeamId ||
        current.seriesId !== data.seriesId
      if (changedSides && (current.hasEvents || current.hasLineup)) {
        throw new Rejection(
          'Este partido ya tiene nómina o eventos cargados: no se pueden cambiar los equipos ni la serie.',
          'homeTeamId',
        )
      }
      const { label, ...values } = await scheduleValues(tx, data, matchId)
      await tx.update(matches).set(values).where(eq(matches.id, matchId))
      await recordSlugChange(tx, 'match', matchId, current.slug, values.slug)
      return {
        id: matchId,
        summary: `Editó el partido ${label}`,
        meta: { kickoffAt: values.kickoffAt.toISOString() },
        // También la tabla de la competencia y serie anteriores, por si cambiaron.
        tags: [...matchTags({ id: matchId, ...values }), ...matchTags({ id: matchId, ...current })],
      }
    },
  })
}

/** Crea en un paso los partidos de varias series contra el mismo rival (especificación 7.4). */
export async function programarJornada(input: unknown): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'match.matchday.create',
    permission: 'matches:write',
    entityType: 'match',
    schema: matchdaySchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const [own] = await tx.select({ id: teams.id }).from(teams).where(eq(teams.isOwnClub, true))
      if (!own) throw new Rejection('Falta registrar el club propio en Rivales.')
      if (own.id === data.rivalId) throw new Rejection('El rival no puede ser el propio club.', 'rivalId')
      const isHome = data.condition === 'local'
      const created: { id: string; competitionId: string; seriesId: string }[] = []
      const labels: string[] = []
      for (const row of data.rows.filter((item) => item.include)) {
        const { label, ...values } = await scheduleValues(tx, {
          competitionId: data.competitionId,
          seriesId: row.seriesId,
          homeTeamId: isHome ? own.id : data.rivalId,
          awayTeamId: isHome ? data.rivalId : own.id,
          date: data.date,
          time: row.time,
          venueId: data.venueId,
          roundNumber: row.roundNumber,
          roundLabel: null,
          notes: null,
        })
        const [match] = await tx.insert(matches).values(values).returning({ id: matches.id })
        if (!match) throw new Error('Un partido de la jornada no se creó.')
        created.push({ id: match.id, competitionId: values.competitionId, seriesId: values.seriesId })
        labels.push(label)
      }
      const first = created[0]
      if (!first) throw new Rejection('Marca al menos una serie que juegue ese día.', 'rows')
      return {
        id: first.id,
        summary: `Programó una jornada de ${created.length} partidos (${labels[0]})`,
        meta: { matchIds: created.map((match) => match.id), date: data.date },
        tags: created.flatMap(matchTags),
      }
    },
  })
}

/** Postergar, suspender, cancelar o reprogramar. El historial queda en la auditoría (7.4). */
export async function cambiarEstadoPartido(id: string, input: unknown): Result {
  return mutate({
    action: 'match.status.update',
    permission: 'matches:write',
    entityType: 'match',
    schema: matchStatusSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const matchId = assertId(id, NOT_FOUND)
      const [current] = await tx
        .select({
          status: matches.status,
          kickoffAt: matches.kickoffAt,
          competitionId: matches.competitionId,
          seriesId: matches.seriesId,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .for('update')
      if (!current) throw new Rejection(NOT_FOUND)
      if (current.status === 'finalizado') {
        throw new Rejection('Este partido ya está finalizado. Si hubo un error, corrige el resultado.')
      }
      const kickoffAt = data.date && data.time ? santiagoWallTime(data.date, data.time) : current.kickoffAt
      await tx
        .update(matches)
        .set({
          status: data.status,
          kickoffAt,
          notes: data.notes,
          period: 'previa',
          periodStartedAt: null,
          shareVersion: sql`${matches.shareVersion} + 1`,
        })
        .where(eq(matches.id, matchId))
      return {
        id: matchId,
        summary: `Cambió el partido a «${data.status}»`,
        meta: {
          from: { status: current.status, kickoffAt: current.kickoffAt.toISOString() },
          to: { status: data.status, kickoffAt: kickoffAt.toISOString() },
          notes: data.notes,
        },
        tags: matchTags({ id: matchId, ...current }),
      }
    },
  })
}

export async function eliminarPartido(id: string): Result {
  return mutate({
    action: 'match.delete',
    permission: 'matches:write',
    entityType: 'match',
    schema: nothing,
    input: null,
    tags: [],
    write: async (tx) => {
      const matchId = assertId(id, NOT_FOUND)
      const [current] = await tx
        .select({
          slug: matches.slug,
          status: matches.status,
          competitionId: matches.competitionId,
          seriesId: matches.seriesId,
          hasEvents: sql<boolean>`exists (select 1 from ${matchEvents} where ${matchEvents.matchId} = ${matches.id})`,
        })
        .from(matches)
        .where(eq(matches.id, matchId))
        .for('update')
      if (!current) throw new Rejection(NOT_FOUND)
      if (current.status === 'finalizado' || current.hasEvents) {
        throw new Rejection(
          'Este partido ya tiene resultado cargado y no se elimina: sus goles cuentan en las estadísticas. Si no se jugó, cámbialo a cancelado.',
        )
      }
      await tx.delete(matches).where(eq(matches.id, matchId))
      return {
        id: matchId,
        summary: `Eliminó el partido ${current.slug}`,
        tags: matchTags({ id: matchId, ...current }),
      }
    },
  })
}

type LockedMatch = {
  id: string
  competitionId: string
  seriesId: string
  seasonId: string
  homeTeamId: string
  awayTeamId: string
  clubSide: 'local' | 'visita' | 'ninguno'
  scoreLocked: boolean
  status: (typeof matches.$inferSelect)['status']
  period: (typeof matches.$inferSelect)['period']
  halfLengthMinutes: number
}

/** Bloquea la fila del partido: las cargas simultáneas desde dos celulares se ordenan, no se pisan. */
async function lockMatch(tx: Tx, id: string): Promise<LockedMatch> {
  const matchId = assertId(id, NOT_FOUND)
  const [match] = await tx
    .select({
      id: matches.id,
      competitionId: matches.competitionId,
      seriesId: matches.seriesId,
      seasonId: matches.seasonId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      clubSide: matches.clubSide,
      scoreLocked: matches.scoreLocked,
      status: matches.status,
      period: matches.period,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .for('update')
  if (!match) throw new Rejection(NOT_FOUND)
  const [serie] = await tx
    .select({ halfLengthMinutes: series.halfLengthMinutes })
    .from(series)
    .where(eq(series.id, match.seriesId))
  return { ...match, halfLengthMinutes: serie?.halfLengthMinutes ?? 45 }
}

function ownTeamOf(match: LockedMatch): string {
  if (match.clubSide === 'ninguno') {
    throw new Rejection('En un partido entre rivales solo se carga el marcador final.')
  }
  return match.clubSide === 'local' ? match.homeTeamId : match.awayTeamId
}

/**
 * Marcador derivado (especificación 8.6): se recalcula desde los eventos en la misma transacción de cada
 * alta o baja. Con `score_locked` (W.O., por secretaría o partido entre rivales) el marcador es manual.
 */
async function recalculateScore(tx: Tx, match: LockedMatch): Promise<void> {
  if (!match.scoreLocked) {
    const events = await tx
      .select({ type: matchEvents.type, teamId: matchEvents.teamId, period: matchEvents.period })
      .from(matchEvents)
      .where(eq(matchEvents.matchId, match.id))
    const score = deriveScore(events, match)
    await tx
      .update(matches)
      .set({ homeScore: score.home, awayScore: score.away, shareVersion: sql`${matches.shareVersion} + 1` })
      .where(eq(matches.id, match.id))
    return
  }
  await tx
    .update(matches)
    .set({ shareVersion: sql`${matches.shareVersion} + 1` })
    .where(eq(matches.id, match.id))
}

/** Solo juegan quienes pertenecen al club: el jugador debe existir (la nómina no exige inscripción vigente). */
async function assertPlayersExist(tx: Tx, ids: string[], field: string): Promise<void> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const found = await tx.select({ id: players.id }).from(players).where(inArray(players.id, unique))
  if (found.length !== unique.length) {
    throw new Rejection('Uno de los jugadores ya no existe. Recarga la página.', field)
  }
}

/** Reemplaza la nómina completa del partido (titulares, suplentes, números y quiénes jugaron). */
export async function guardarNomina(id: string, input: unknown): Result {
  return mutate({
    action: 'match.lineup.save',
    permission: 'matches:write',
    entityType: 'match',
    schema: lineupSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const match = await lockMatch(tx, id)
      ownTeamOf(match)
      await assertPlayersExist(
        tx,
        data.players.map((player) => player.playerId),
        'players',
      )
      // Quien tiene un gol, una tarjeta o un cambio en este partido no puede salir de la nómina.
      const withEvents = await tx
        .select({ playerId: matchEvents.playerId, relatedPlayerId: matchEvents.relatedPlayerId })
        .from(matchEvents)
        .where(eq(matchEvents.matchId, match.id))
      const kept = new Set(data.players.map((player) => player.playerId))
      const involved = withEvents.flatMap((event) => [event.playerId, event.relatedPlayerId])
      if (involved.some((playerId) => playerId !== null && !kept.has(playerId))) {
        throw new Rejection(
          'Un jugador con goles, tarjetas o cambios en este partido quedó fuera de la nómina. Vuelve a marcarlo o elimina antes sus eventos.',
          'players',
        )
      }
      await tx.delete(matchLineups).where(eq(matchLineups.matchId, match.id))
      if (data.players.length > 0) {
        await tx.insert(matchLineups).values(data.players.map((player) => ({ ...player, matchId: match.id })))
      }
      return {
        id: match.id,
        summary: `Guardó la nómina (${data.players.length} jugadores)`,
        meta: { players: data.players.length, played: data.players.filter((player) => player.played).length },
        tags: matchTags(match),
      }
    },
  })
}

/** «Usar nómina del partido anterior» (7.3): copia la del último partido de la serie, sin las bajas. */
export async function copiarNominaAnterior(id: string): Result {
  return mutate({
    action: 'match.lineup.copy',
    permission: 'matches:write',
    entityType: 'match',
    schema: nothing,
    input: null,
    tags: [],
    write: async (tx) => {
      const match = await lockMatch(tx, id)
      ownTeamOf(match)
      const [existing] = await tx
        .select({ id: matchLineups.id })
        .from(matchLineups)
        .where(eq(matchLineups.matchId, match.id))
        .limit(1)
      if (existing) throw new Rejection('Este partido ya tiene nómina. Edítala directamente.')

      const [current] = await tx
        .select({ kickoffAt: matches.kickoffAt })
        .from(matches)
        .where(eq(matches.id, match.id))
      const [previous] = await tx
        .select({ id: matches.id })
        .from(matches)
        .where(
          and(
            eq(matches.seriesId, match.seriesId),
            ne(matches.clubSide, 'ninguno'),
            lt(matches.kickoffAt, current?.kickoffAt ?? new Date()),
            sql`exists (select 1 from ${matchLineups} where ${matchLineups.matchId} = ${matches.id})`,
          ),
        )
        .orderBy(desc(matches.kickoffAt))
        .limit(1)
      if (!previous) throw new Rejection('No hay un partido anterior de esta serie con nómina cargada.')

      const rows = await tx
        .select({
          playerId: matchLineups.playerId,
          role: matchLineups.role,
          shirtNumber: matchLineups.shirtNumber,
          played: matchLineups.played,
        })
        .from(matchLineups)
        .innerJoin(players, eq(players.id, matchLineups.playerId))
        .innerJoin(
          squadRegistrations,
          and(
            eq(squadRegistrations.playerId, matchLineups.playerId),
            eq(squadRegistrations.seasonId, match.seasonId),
            eq(squadRegistrations.seriesId, match.seriesId),
          ),
        )
        .where(
          and(
            eq(matchLineups.matchId, previous.id),
            eq(players.isActive, true),
            ne(squadRegistrations.status, 'baja'),
          ),
        )
      if (rows.length === 0) throw new Rejection('Nadie de la nómina anterior sigue inscrito en esta serie.')
      await tx.insert(matchLineups).values(rows.map((row) => ({ ...row, matchId: match.id })))
      return {
        id: match.id,
        summary: `Copió la nómina del partido anterior (${rows.length} jugadores)`,
        meta: { fromMatchId: previous.id, players: rows.length },
        tags: matchTags(match),
      }
    },
  })
}

type EventData = z.output<typeof matchEventSchema>

/**
 * Columnas de un evento a partir del formulario o de la consola: equipo según el lado del club, jugadores
 * solo del club y período (el del partido si está en juego; si no, el que corresponde al minuto).
 */
async function eventColumns(tx: Tx, match: LockedMatch, data: EventData) {
  const ownTeamId = ownTeamOf(match)
  const rivalTeamId = ownTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId
  if (match.status === 'cancelado') throw new Rejection('Un partido cancelado no admite eventos.')

  const isComment = data.type === 'comentario'
  const isClub = data.team === 'club'
  const playerId = isClub && !isComment ? data.playerId : null
  const relatedPlayerId = isClub && data.type === 'cambio' ? data.relatedPlayerId : null
  const involved = [playerId, relatedPlayerId].filter((value): value is string => value !== null)
  await assertPlayersExist(tx, involved, 'playerId')
  return {
    involved,
    relatedPlayerId,
    values: {
      type: data.type,
      period: eventPeriod(match.period, match.status, () =>
        periodForMinute(data.minute, match.halfLengthMinutes),
      ),
      minute: data.minute,
      stoppageMinute: data.minute === null ? null : data.stoppageMinute,
      teamId: isComment ? null : isClub ? ownTeamId : rivalTeamId,
      playerId,
      relatedPlayerId,
      freeTextName: isClub || isComment ? null : data.freeTextName,
      comment: isComment ? data.comment : null,
    },
  }
}

/** Quien participa en un evento jugó: entra a la nómina si faltaba (las estadísticas cuentan PJ). */
async function markPlayed(tx: Tx, matchId: string, involved: string[], substituteId: string | null) {
  for (const involvedId of involved) {
    await tx
      .insert(matchLineups)
      .values({
        matchId,
        playerId: involvedId,
        role: involvedId === substituteId ? 'suplente' : 'titular',
        played: true,
      })
      .onConflictDoUpdate({
        target: [matchLineups.matchId, matchLineups.playerId],
        set: { played: true },
      })
  }
}

/** Registra un gol, una tarjeta, un cambio o un comentario, y recalcula el marcador. */
export async function agregarEvento(id: string, input: unknown): Result {
  return mutate({
    action: 'match.event.create',
    permission: 'matches:write',
    entityType: 'match_event',
    schema: matchEventSchema,
    input,
    tags: [],
    write: async (tx, data, user) => {
      const match = await lockMatch(tx, id)
      const { involved, relatedPlayerId, values } = await eventColumns(tx, match, data)

      const [created] = await tx
        .insert(matchEvents)
        .values({
          matchId: match.id,
          ...values,
          ...(data.clientEventId ? { clientEventId: data.clientEventId } : {}),
          createdBy: user.id,
        })
        // Idempotente: si el mismo toque llega dos veces, la segunda no crea nada.
        .onConflictDoNothing({ target: matchEvents.clientEventId })
        .returning({ id: matchEvents.id })
      if (!created) {
        const [duplicate] = await tx
          .select({ id: matchEvents.id })
          .from(matchEvents)
          .where(eq(matchEvents.clientEventId, data.clientEventId ?? ''))
        return { id: duplicate?.id ?? match.id, summary: 'Evento repetido ignorado', tags: matchTags(match) }
      }

      await markPlayed(tx, match.id, involved, relatedPlayerId)
      await recalculateScore(tx, match)
      return {
        id: created.id,
        summary: `Registró un evento (${data.type})`,
        meta: { matchId: match.id, type: data.type, team: data.team, minute: data.minute },
        tags: matchTags(match),
      }
    },
  })
}

export async function eliminarEvento(eventId: string): Result {
  return mutate({
    action: 'match.event.delete',
    permission: 'matches:write',
    entityType: 'match_event',
    schema: nothing,
    input: null,
    tags: [],
    write: async (tx) => {
      const id = assertId(eventId, 'No encontramos ese evento.')
      const [event] = await tx
        .select({ matchId: matchEvents.matchId, type: matchEvents.type })
        .from(matchEvents)
        .where(eq(matchEvents.id, id))
      if (!event) throw new Rejection('No encontramos ese evento. Puede que ya lo hayan eliminado.')
      const match = await lockMatch(tx, event.matchId)
      await tx.delete(matchEvents).where(eq(matchEvents.id, id))
      await recalculateScore(tx, match)
      return {
        id,
        summary: `Eliminó un evento (${event.type})`,
        meta: { matchId: match.id, type: event.type },
        tags: matchTags(match),
      }
    },
  })
}

/**
 * Cierra el partido: lo deja finalizado con su forma de resolución. El marcador sale de los eventos,
 * salvo en W.O., «por secretaría» o un partido entre rivales, donde se escribe a mano (8.6).
 */
export async function finalizarPartido(id: string, input: unknown): Result {
  return mutate({
    action: 'match.result.save',
    permission: 'matches:write',
    entityType: 'match',
    schema: matchResultSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const match = await lockMatch(tx, id)
      if (match.status === 'cancelado') {
        throw new Rejection('Este partido está cancelado. Vuelve a programarlo antes de cargar el resultado.')
      }
      const manual =
        match.clubSide === 'ninguno' || data.resolution === 'walkover' || data.resolution === 'secretaria'
      if (manual) {
        if (data.homeScore === null) throw new Rejection('Escribe los goles del local.', 'homeScore')
        if (data.awayScore === null) throw new Rejection('Escribe los goles de la visita.', 'awayScore')
      }
      const penalties = data.resolution === 'penales'
      await tx
        .update(matches)
        .set({
          status: 'finalizado',
          period: 'terminado',
          periodStartedAt: null,
          resolution: data.resolution,
          scoreLocked: manual,
          ...(manual ? { homeScore: data.homeScore ?? 0, awayScore: data.awayScore ?? 0 } : {}),
          homePenalties: penalties ? data.homePenalties : null,
          awayPenalties: penalties ? data.awayPenalties : null,
          finishedAt: sql`coalesce(${matches.finishedAt}, now())`,
        })
        .where(eq(matches.id, match.id))
      // Si dejó de ser manual, el marcador vuelve a salir de los eventos.
      await recalculateScore(tx, { ...match, scoreLocked: manual })
      const [final] = await tx
        .select({ homeScore: matches.homeScore, awayScore: matches.awayScore })
        .from(matches)
        .where(eq(matches.id, match.id))
      return {
        id: match.id,
        summary: `Finalizó el partido ${final?.homeScore}–${final?.awayScore}`,
        meta: { resolution: data.resolution, manual, ...final },
        tags: matchTags(match),
      }
    },
  })
}

/** Edita un evento ya registrado (minuto, jugador, tipo o equipo) y recalcula el marcador. */
export async function editarEvento(eventId: string, input: unknown): Result {
  return mutate({
    action: 'match.event.update',
    permission: 'matches:write',
    entityType: 'match_event',
    schema: matchEventSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const id = assertId(eventId, 'No encontramos ese evento.')
      const [event] = await tx
        .select({ matchId: matchEvents.matchId, period: matchEvents.period })
        .from(matchEvents)
        .where(eq(matchEvents.id, id))
      if (!event) throw new Rejection('No encontramos ese evento. Puede que lo hayan eliminado.')
      const match = await lockMatch(tx, event.matchId)
      const { involved, relatedPlayerId, values } = await eventColumns(tx, match, data)
      // Al corregirlo no se mueve de período (un gol del 1.er tiempo editado en el 2.º sigue en el 1.º),
      // salvo que el minuto nuevo lo cambie.
      const period =
        event.period === 'penales' ? event.period : periodForMinute(data.minute, match.halfLengthMinutes)
      await tx
        .update(matchEvents)
        .set({ ...values, period: data.minute === null ? event.period : period })
        .where(eq(matchEvents.id, id))
      await markPlayed(tx, match.id, involved, relatedPlayerId)
      await recalculateScore(tx, match)
      return {
        id,
        summary: `Editó un evento (${data.type})`,
        meta: { matchId: match.id, type: data.type, team: data.team, minute: data.minute },
        tags: matchTags(match),
      }
    },
  })
}

/**
 * «Deshacer último» de la consola (7.3): borra el evento más reciente, solo si es el que la consola tenía
 * como último. Un segundo toque (o un reintento de la cola) con un evento que ya no existe no hace nada.
 */
export async function deshacerUltimoEvento(id: string, input: unknown): Result {
  return mutate({
    action: 'match.event.undo',
    permission: 'matches:write',
    entityType: 'match_event',
    schema: undoEventSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const match = await lockMatch(tx, id)
      const [expected] = await tx
        .select({ id: matchEvents.id, type: matchEvents.type })
        .from(matchEvents)
        .where(and(eq(matchEvents.id, data.lastEventId), eq(matchEvents.matchId, match.id)))
      if (!expected) return { id: match.id, summary: 'Deshacer repetido ignorado', tags: matchTags(match) }
      const [last] = await tx
        .select({ id: matchEvents.id })
        .from(matchEvents)
        .where(eq(matchEvents.matchId, match.id))
        .orderBy(desc(matchEvents.createdAt), desc(matchEvents.id))
        .limit(1)
      if (last?.id !== expected.id) {
        throw new Rejection(
          'Llegó otro evento mientras tanto. Revisa la cronología y elimina el que corresponda.',
        )
      }
      await tx.delete(matchEvents).where(eq(matchEvents.id, expected.id))
      await recalculateScore(tx, match)
      return {
        id: expected.id,
        summary: `Deshizo el último evento (${expected.type})`,
        meta: { matchId: match.id, type: expected.type },
        tags: matchTags(match),
      }
    },
  })
}

/**
 * Inicia o termina un tiempo desde la consola (7.3). El primer paso deja el partido en vivo. Es
 * idempotente: repetir un paso ya aplicado no hace nada (doble toque o cola sin conexión).
 */
export async function cambiarPeriodo(id: string, input: unknown): Result {
  return mutate({
    action: 'match.period.update',
    permission: 'matches:live',
    entityType: 'match',
    schema: periodTransitionSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const match = await lockMatch(tx, id)
      ownTeamOf(match)
      const result = resolveTransition(match, data.transition)
      if (result.kind === 'invalid') throw new Rejection(result.message)
      if (result.kind === 'already') {
        return { id: match.id, summary: 'Paso repetido ignorado', tags: matchTags(match) }
      }
      await tx
        .update(matches)
        .set({
          status: 'en_vivo',
          period: result.period,
          periodStartedAt: result.clockRuns ? sql`now()` : null,
          shareVersion: sql`${matches.shareVersion} + 1`,
        })
        .where(eq(matches.id, match.id))
      return {
        id: match.id,
        summary: `Partido en vivo: ${data.transition.replaceAll('_', ' ')}`,
        meta: { from: match.period, to: result.period },
        tags: matchTags(match),
      }
    },
  })
}

/** Suspende un partido en juego (lluvia, incidentes): queda con su marcador y el motivo se publica. */
export async function suspenderPartido(id: string, input: unknown): Result {
  return mutate({
    action: 'match.suspend',
    permission: 'matches:live',
    entityType: 'match',
    schema: suspendMatchSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const match = await lockMatch(tx, id)
      if (match.status === 'suspendido') {
        return { id: match.id, summary: 'Suspensión repetida ignorada', tags: matchTags(match) }
      }
      if (match.status !== 'en_vivo') throw new Rejection('Solo se suspende un partido que se está jugando.')
      await tx
        .update(matches)
        .set({
          status: 'suspendido',
          periodStartedAt: null,
          notes: data.notes,
          shareVersion: sql`${matches.shareVersion} + 1`,
        })
        .where(eq(matches.id, match.id))
      return {
        id: match.id,
        summary: 'Suspendió el partido',
        meta: { period: match.period, notes: data.notes },
        tags: matchTags(match),
      }
    },
  })
}
