import 'server-only'
import { eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matchEvents, players } from '@/db/schema'
import { toPublicPlayerRef } from '@/features/players/public'
import type { MatchEventDTO } from './dto'
import { compareEvents } from './lib/match-clock'

const eventPlayer = alias(players, 'event_player')
const relatedPlayer = alias(players, 'related_player')

/** Eventos de un partido con los jugadores nombrados (para armar los nombres públicos). */
export function selectEventRows(matchId: string) {
  return db
    .select({
      id: matchEvents.id,
      type: matchEvents.type,
      period: matchEvents.period,
      minute: matchEvents.minute,
      stoppageMinute: matchEvents.stoppageMinute,
      teamId: matchEvents.teamId,
      freeTextName: matchEvents.freeTextName,
      comment: matchEvents.comment,
      createdAt: matchEvents.createdAt,
      player: {
        id: eventPlayer.id,
        firstName: eventPlayer.firstName,
        lastName: eventPlayer.lastName,
        slug: eventPlayer.slug,
      },
      related: {
        id: relatedPlayer.id,
        firstName: relatedPlayer.firstName,
        lastName: relatedPlayer.lastName,
        slug: relatedPlayer.slug,
      },
    })
    .from(matchEvents)
    .leftJoin(eventPlayer, eq(eventPlayer.id, matchEvents.playerId))
    .leftJoin(relatedPlayer, eq(relatedPlayer.id, matchEvents.relatedPlayerId))
    .where(eq(matchEvents.matchId, matchId))
}

export type EventRow = Awaited<ReturnType<typeof selectEventRows>>[number]

/** Ids de los jugadores nombrados en los eventos (para `loadMinorIds`). */
export function namedPlayerIds(rows: EventRow[]): string[] {
  return rows.flatMap((event) => [event.player?.id, event.related?.id]).filter((id) => id != null)
}

/**
 * Eventos públicos en orden cronológico. Los nombres pasan por `toPublicPlayerRef`: un menor de edad sale
 * como nombre e inicial (6.3).
 */
export function toEventDTOs(
  rows: EventRow[],
  sides: { homeTeamId: string; awayTeamId: string },
  minors: ReadonlySet<string>,
): MatchEventDTO[] {
  const nameOf = (player: EventRow['player']) => (player?.id ? toPublicPlayerRef(player, minors).name : null)
  return [...rows].sort(compareEvents).map((event) => ({
    id: event.id,
    type: event.type,
    period: event.period,
    minute: event.minute,
    stoppageMinute: event.stoppageMinute,
    side: event.teamId === sides.homeTeamId ? 'home' : event.teamId === sides.awayTeamId ? 'away' : null,
    playerName: nameOf(event.player) ?? event.freeTextName,
    relatedPlayerName: nameOf(event.related),
    comment: event.comment,
  }))
}
