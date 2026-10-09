import 'server-only'
import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, playerStatAdjustments, players, seasons, series, squadRegistrations } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { toIsoDate } from '@/lib/format'
import { isMinor } from './lib/is-minor'

// Lecturas del panel: sin caché, siempre el estado actual. Aquí sí se ve la fecha de nacimiento.

export const PLAYERS_PAGE_SIZE = 30

export type PlayerListItem = {
  id: string
  firstName: string
  lastName: string
  nickname: string | null
  primaryPosition: (typeof players.$inferSelect)['primaryPosition']
  isActive: boolean
  isMinor: boolean
  /** Inscripciones en la temporada consultada: «Honor #9». */
  registrations: { seriesName: string; shirtNumber: number | null; status: string }[]
}

export async function listPlayersAdmin(options: {
  q?: string
  seasonId?: string | null
  seriesId?: string | null
  page?: number
}): Promise<{ items: PlayerListItem[]; page: number; totalPages: number; total: number }> {
  const term = options.q?.trim()
  const search = term
    ? or(
        ilike(sql`${players.firstName} || ' ' || ${players.lastName}`, `%${term}%`),
        ilike(players.nickname, `%${term}%`),
      )
    : undefined
  // Con una serie elegida, solo quienes están inscritos en ella esa temporada.
  const inSeries =
    options.seriesId && options.seasonId
      ? exists(
          db
            .select({ one: sql`1` })
            .from(squadRegistrations)
            .where(
              and(
                eq(squadRegistrations.playerId, players.id),
                eq(squadRegistrations.seasonId, options.seasonId),
                eq(squadRegistrations.seriesId, options.seriesId),
              ),
            ),
        )
      : undefined
  const where = and(search, inSeries)

  const [totals] = await db.select({ total: count() }).from(players).where(where)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PLAYERS_PAGE_SIZE))
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages)

  const rows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      nickname: players.nickname,
      birthDate: players.birthDate,
      primaryPosition: players.primaryPosition,
      isActive: players.isActive,
    })
    .from(players)
    .where(where)
    .orderBy(desc(players.isActive), asc(players.lastName), asc(players.firstName))
    .limit(PLAYERS_PAGE_SIZE)
    .offset((page - 1) * PLAYERS_PAGE_SIZE)

  // Una sola consulta para las inscripciones de toda la página (sin N+1).
  const registrations =
    rows.length > 0
      ? await db
          .select({
            playerId: squadRegistrations.playerId,
            seasonId: squadRegistrations.seasonId,
            seriesName: series.shortName,
            containsMinors: series.containsMinors,
            shirtNumber: squadRegistrations.shirtNumber,
            status: squadRegistrations.status,
          })
          .from(squadRegistrations)
          .innerJoin(series, eq(series.id, squadRegistrations.seriesId))
          .where(
            inArray(
              squadRegistrations.playerId,
              rows.map((row) => row.id),
            ),
          )
          .orderBy(asc(series.sortOrder))
      : []

  const today = toIsoDate(new Date())
  return {
    items: rows.map((row) => {
      const own = registrations.filter((registration) => registration.playerId === row.id)
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        nickname: row.nickname,
        primaryPosition: row.primaryPosition,
        isActive: row.isActive,
        isMinor: isMinor(row, own, today),
        registrations: own
          .filter((registration) => !options.seasonId || registration.seasonId === options.seasonId)
          .map(({ seriesName, shirtNumber, status }) => ({ seriesName, shirtNumber, status })),
      }
    }),
    page,
    totalPages,
    total,
  }
}

export type PlayerAdminDetail = NonNullable<Awaited<ReturnType<typeof getPlayerAdmin>>>

export async function getPlayerAdmin(id: string) {
  const [player] = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      nickname: players.nickname,
      slug: players.slug,
      birthDate: players.birthDate,
      primaryPosition: players.primaryPosition,
      positionDetail: players.positionDetail,
      isActive: players.isActive,
      imageConsentAt: players.imageConsentAt,
      photoId: mediaAssets.id,
      photoVariants: mediaAssets.variants,
      photoAlt: mediaAssets.altText,
      photoMinors: mediaAssets.containsMinors,
    })
    .from(players)
    .leftJoin(mediaAssets, eq(mediaAssets.id, players.photoMediaId))
    .where(eq(players.id, id))
    .limit(1)
  if (!player) return null

  const [registrations, adjustments] = await Promise.all([
    db
      .select({
        id: squadRegistrations.id,
        seasonId: squadRegistrations.seasonId,
        seasonName: seasons.name,
        seriesId: squadRegistrations.seriesId,
        seriesName: series.name,
        containsMinors: series.containsMinors,
        shirtNumber: squadRegistrations.shirtNumber,
        isCaptain: squadRegistrations.isCaptain,
        status: squadRegistrations.status,
      })
      .from(squadRegistrations)
      .innerJoin(seasons, eq(seasons.id, squadRegistrations.seasonId))
      .innerJoin(series, eq(series.id, squadRegistrations.seriesId))
      .where(eq(squadRegistrations.playerId, id))
      .orderBy(desc(seasons.year), asc(series.sortOrder)),
    db
      .select({
        id: playerStatAdjustments.id,
        seasonName: seasons.name,
        seriesName: series.name,
        appearances: playerStatAdjustments.appearances,
        goals: playerStatAdjustments.goals,
        yellowCards: playerStatAdjustments.yellowCards,
        redCards: playerStatAdjustments.redCards,
        note: playerStatAdjustments.note,
      })
      .from(playerStatAdjustments)
      .innerJoin(seasons, eq(seasons.id, playerStatAdjustments.seasonId))
      .innerJoin(series, eq(series.id, playerStatAdjustments.seriesId))
      .where(eq(playerStatAdjustments.playerId, id))
      .orderBy(desc(seasons.year), asc(series.sortOrder)),
  ])

  const photo: MediaThumbDTO | null = player.photoId
    ? toMediaThumbDTO({
        id: player.photoId,
        variants: player.photoVariants,
        altText: player.photoAlt,
        containsMinors: player.photoMinors ?? false,
      })
    : null

  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    nickname: player.nickname,
    slug: player.slug,
    birthDate: player.birthDate,
    primaryPosition: player.primaryPosition,
    positionDetail: player.positionDetail,
    isActive: player.isActive,
    imageConsentAt: player.imageConsentAt,
    photo,
    isMinor: isMinor(player, registrations, toIsoDate(new Date())),
    registrations,
    adjustments,
  }
}
