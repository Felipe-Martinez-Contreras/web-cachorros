import 'server-only'
import { and, asc, desc, eq, ne } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  mediaAssets,
  playerSeasonStats,
  players,
  seasons,
  series,
  squadRegistrations,
  staffAssignments,
  staffMembers,
} from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import type { PlayerProfileDTO, SquadDTO } from './dto'
import { loadMinorIds, toPublicPlayerRef } from './public'

const photoSelect = {
  variants: mediaAssets.variants,
  width: mediaAssets.width,
  height: mediaAssets.height,
  altText: mediaAssets.altText,
  lqip: mediaAssets.lqip,
  credit: mediaAssets.credit,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
}

const POSITION = { arquero: 0, defensa: 1, mediocampista: 2, delantero: 3 } as const

/** Plantel y cuerpo técnico de una serie en una temporada; `null` si la serie no existe o está inactiva. */
export async function getSquad(seriesSlug: string, seasonId: string): Promise<SquadDTO | null> {
  'use cache'
  cacheTag(tags.players(), tags.media())
  cacheLife('hours')

  const [[serie], [season]] = await Promise.all([
    db
      .select({ id: series.id, name: series.name, slug: series.slug, description: series.description })
      .from(series)
      .where(and(eq(series.slug, seriesSlug), eq(series.isActive, true)))
      .limit(1),
    db.select({ name: seasons.name }).from(seasons).where(eq(seasons.id, seasonId)).limit(1),
  ])
  if (!serie || !season) return null

  const [rows, staffRows] = await Promise.all([
    db
      .select({
        id: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        slug: players.slug,
        nickname: players.nickname,
        position: players.primaryPosition,
        shirtNumber: squadRegistrations.shirtNumber,
        isCaptain: squadRegistrations.isCaptain,
        photo: photoSelect,
      })
      .from(squadRegistrations)
      .innerJoin(players, eq(players.id, squadRegistrations.playerId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, players.photoMediaId))
      .where(
        and(
          eq(squadRegistrations.seriesId, serie.id),
          eq(squadRegistrations.seasonId, seasonId),
          ne(squadRegistrations.status, 'baja'),
          eq(players.isActive, true),
        ),
      ),
    db
      .select({
        name: staffMembers.fullName,
        role: staffAssignments.role,
        sortOrder: staffAssignments.sortOrder,
        photo: photoSelect,
      })
      .from(staffAssignments)
      .innerJoin(staffMembers, eq(staffMembers.id, staffAssignments.staffId))
      .leftJoin(mediaAssets, eq(mediaAssets.id, staffMembers.photoMediaId))
      .where(and(eq(staffAssignments.seriesId, serie.id), eq(staffAssignments.seasonId, seasonId)))
      .orderBy(asc(staffAssignments.sortOrder), asc(staffAssignments.role), asc(staffMembers.fullName)),
  ])

  const minors = await loadMinorIds(rows.map((row) => row.id))
  return {
    series: { name: serie.name, slug: serie.slug, description: serie.description },
    seasonName: season.name,
    players: rows
      .sort(
        (a, b) =>
          POSITION[a.position] - POSITION[b.position] ||
          (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) ||
          a.lastName.localeCompare(b.lastName, 'es'),
      )
      .map((row) => {
        const minor = minors.has(row.id)
        return {
          ...toPublicPlayerRef(row, minors),
          // De un menor no se publica el apodo ni la foto (política pendiente, especificación 9.6).
          nickname: minor ? null : row.nickname,
          photo: minor ? null : toImageDTO(row.photo),
          shirtNumber: row.shirtNumber,
          position: row.position,
          isCaptain: row.isCaptain,
        }
      }),
    staff: staffRows.map((row) => ({ name: row.name, role: row.role, photo: toImageDTO(row.photo) })),
  }
}

/**
 * Ficha pública de un jugador. No existe (devuelve `null`) para menores de edad ni para jugadores
 * inactivos: quien llama responde con un 404.
 */
export async function getPlayerProfile(slug: string): Promise<PlayerProfileDTO | null> {
  'use cache'
  cacheTag(tags.players(), tags.stats(), tags.media())
  cacheLife('hours')

  const [player] = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      slug: players.slug,
      nickname: players.nickname,
      position: players.primaryPosition,
      positionDetail: players.positionDetail,
      photo: photoSelect,
    })
    .from(players)
    .leftJoin(mediaAssets, eq(mediaAssets.id, players.photoMediaId))
    .where(and(eq(players.slug, slug), eq(players.isActive, true)))
    .limit(1)
  if (!player) return null
  cacheTag(tags.player(player.id))
  const minors = await loadMinorIds([player.id])
  if (minors.has(player.id)) return null

  const [current, stats] = await Promise.all([
    db
      .select({
        seriesName: series.name,
        seriesSlug: series.slug,
        shirtNumber: squadRegistrations.shirtNumber,
        isCaptain: squadRegistrations.isCaptain,
      })
      .from(squadRegistrations)
      .innerJoin(series, eq(series.id, squadRegistrations.seriesId))
      .innerJoin(seasons, eq(seasons.id, squadRegistrations.seasonId))
      .where(
        and(
          eq(squadRegistrations.playerId, player.id),
          eq(seasons.isCurrent, true),
          ne(squadRegistrations.status, 'baja'),
          eq(series.isActive, true),
        ),
      )
      .orderBy(asc(series.sortOrder)),
    db
      .select({
        seasonName: seasons.name,
        seriesName: series.name,
        appearances: playerSeasonStats.appearances,
        goals: playerSeasonStats.goals,
        yellowCards: playerSeasonStats.yellowCards,
        redCards: playerSeasonStats.redCards,
      })
      .from(playerSeasonStats)
      .innerJoin(seasons, eq(seasons.id, playerSeasonStats.seasonId))
      .innerJoin(series, eq(series.id, playerSeasonStats.seriesId))
      .where(eq(playerSeasonStats.playerId, player.id))
      .orderBy(desc(seasons.year), asc(series.sortOrder)),
  ])

  const totals = { appearances: 0, goals: 0, yellowCards: 0, redCards: 0 }
  for (const row of stats) {
    totals.appearances += row.appearances
    totals.goals += row.goals
    totals.yellowCards += row.yellowCards
    totals.redCards += row.redCards
  }
  return {
    name: `${player.firstName} ${player.lastName}`,
    slug: player.slug,
    nickname: player.nickname,
    position: player.position,
    positionDetail: player.positionDetail,
    photo: toImageDTO(player.photo),
    current,
    stats,
    totals,
  }
}
