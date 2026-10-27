import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { and, asc, eq, gte, inArray, lt, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matches, mediaAssets, news, newsCategories, series, siteSettings, teams } from '@/db/schema'
import type { MediaVariants } from '@/db/schema/media'
import { formatMinute } from '@/features/matches/lib/match-clock'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { namedPlayerIds, selectEventRows, toEventDTOs } from '@/features/matches/public-events'
import { isClubMatch, type MatchRow, selectMatches } from '@/features/matches/queries'
import { uploadsDir } from '@/features/media/files'
import { isNewsVisible } from '@/features/news/queries'
import { loadMinorIds } from '@/features/players/public'
import { crestScale } from '@/lib/images/crest'
import { logger } from '@/lib/logger'
import { type CrestCardStyle, cardCrestImage } from './crest-card'
import type { CardCrest, CardMatch, ShareCardData } from './dto'
import {
  addDays,
  jornadaCardVersion,
  lastClubGoal,
  matchCardVersion,
  type ShareRequest,
  scorerLines,
  shortHash,
  templateFitsStatus,
  weekendOf,
  withDesignRevision,
} from './lib/cards'
import { jornadaStart, parseJornadaKey, selectJornadaMatches, weekendCardFor } from './lib/jornada'
import { loadMatchday, loadTopLine, matchdayRevision, topLineRevision } from './matchday'

export type ShareVersion = { version: string; slug: string }

/**
 * Versión vigente de una tarjeta (una consulta indexada) y el slug para nombrar la descarga; `null` si no
 * existe o no es pública. Con esto se decide si la caché en disco sirve, sin cargar los datos completos.
 */
export async function shareVersionOf(request: ShareRequest): Promise<ShareVersion | null> {
  switch (request.template) {
    case 'resultado':
    case 'proximo':
    case 'gol': {
      const [row] = await db
        .select({ version: matches.shareVersion, status: matches.status, slug: matches.slug })
        .from(matches)
        .where(and(eq(matches.id, request.id), isClubMatch))
        .limit(1)
      if (!row || !templateFitsStatus(request.template, row.status)) return null
      const matchday =
        request.template === 'proximo'
          ? shortHash([await matchdayRevision(request.photos), await crestStylesOf([request.id])])
          : ''
      return { version: matchCardVersion(request.template, row.version, matchday), slug: row.slug }
    }
    case 'programacion':
    case 'resultados': {
      const rows = await weekendRows(request.id, request.template)
      if (rows.length === 0) return null
      // La programación lleva la línea superior y los escudos del matchday: si cambian, cambia la versión.
      const extra =
        request.template === 'programacion'
          ? [await topLineRevision(), await crestStylesOf(rows.map((row) => row.id))]
          : []
      const hash = shortHash([...rows.map((row) => `${row.id}.${row.version}`), ...extra])
      return { version: withDesignRevision(request.template, hash), slug: request.id }
    }
    case 'jornada': {
      const rows = await jornadaMatches(request.id, request.series)
      if (rows.length === 0) return null
      const matchday = shortHash([
        await matchdayRevision(request.photos),
        await crestStylesOf(rows.map((row) => row.id)),
      ])
      return { version: jornadaCardVersion(rows, matchday), slug: request.id.slice(0, 10) }
    }
    case 'noticia': {
      const [row] = await db
        .select({ updatedAt: news.updatedAt, slug: news.slug })
        .from(news)
        .where(and(eq(news.id, request.id), isNewsVisible))
        .limit(1)
      return row ? { version: shortHash([row.updatedAt.getTime()]), slug: row.slug } : null
    }
  }
}

const homeTeams = alias(teams, 'home_team')
const awayTeams = alias(teams, 'away_team')

/**
 * Estilo del escudo en las tarjetas (Panel → Rivales) de los equipos de esos partidos: entra en la versión
 * de las plantillas matchday, que no cambia con `share_version` al editar un equipo.
 */
async function crestStylesOf(matchIds: readonly string[]): Promise<string> {
  if (matchIds.length === 0) return ''
  const rows = await db
    .select({ id: matches.id, home: homeTeams.cardCrestStyle, away: awayTeams.cardCrestStyle })
    .from(matches)
    .innerJoin(homeTeams, eq(homeTeams.id, matches.homeTeamId))
    .innerJoin(awayTeams, eq(awayTeams.id, matches.awayTeamId))
    .where(inArray(matches.id, [...matchIds]))
    .orderBy(asc(matches.id))
  return rows.map((row) => `${row.home}.${row.away}`).join(',')
}

/** Partidos del club de un fin de semana (sábado y domingo en Santiago), con su versión. */
async function weekendRows(saturday: string, template: 'programacion' | 'resultados') {
  const from = santiagoWallTime(saturday, '00:00')
  // Hasta el lunes a las 00:00: sábado y domingo completos.
  const to = santiagoWallTime(addDays(saturday, 2), '00:00')
  return db
    .select({ id: matches.id, version: matches.shareVersion })
    .from(matches)
    .where(
      and(
        isClubMatch,
        gte(matches.kickoffAt, from),
        lt(matches.kickoffAt, to),
        template === 'resultados' ? eq(matches.status, 'finalizado') : ne(matches.status, 'cancelado'),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(MAX_WEEKEND_MATCHES)
}

/**
 * Partidos programados del club de una jornada en la tarjeta, en orden de juego y con su versión: con
 * `seriesIds`, solo los de esas series; sin ellas, los que caben.
 */
export async function jornadaMatches(key: string, seriesIds?: readonly string[] | null) {
  return selectJornadaMatches(await jornadaAllMatches(key), seriesIds)
}

/** Todos los partidos programados del club de una jornada (día en Santiago y rival), en orden de juego. */
export async function jornadaAllMatches(key: string) {
  const parsed = parseJornadaKey(key)
  if (!parsed) return []
  const rows = await db
    .select({
      id: matches.id,
      version: matches.shareVersion,
      kickoffAt: matches.kickoffAt,
      seriesId: matches.seriesId,
      seriesName: series.name,
      seriesOrder: series.sortOrder,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .where(
      and(
        isClubMatch,
        eq(matches.status, 'programado'),
        gte(matches.kickoffAt, santiagoWallTime(parsed.date, '00:00')),
        lt(matches.kickoffAt, santiagoWallTime(addDays(parsed.date, 1), '00:00')),
        or(
          and(eq(matches.clubSide, 'local'), eq(matches.awayTeamId, parsed.rivalId)),
          and(eq(matches.clubSide, 'visita'), eq(matches.homeTeamId, parsed.rivalId)),
        ),
      ),
    )
    .orderBy(asc(matches.kickoffAt), asc(series.sortOrder))
    .limit(30)
  return rows.map((row) => ({ ...row, rivalId: parsed.rivalId }))
}

/**
 * Qué tarjeta lleva la publicación automática de un fin de semana (`weekendCardFor`): «Próximo partido» si
 * hay uno solo, «Jornada» si todos son una sola jornada o la grilla «Programación». `null` sin partidos.
 */
export async function weekendCardOf(saturday: string) {
  const rows = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      clubSide: matches.clubSide,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      seriesId: matches.seriesId,
      seriesOrder: series.sortOrder,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .where(
      and(
        isClubMatch,
        ne(matches.status, 'cancelado'),
        gte(matches.kickoffAt, santiagoWallTime(saturday, '00:00')),
        lt(matches.kickoffAt, santiagoWallTime(addDays(saturday, 2), '00:00')),
      ),
    )
    .orderBy(asc(matches.kickoffAt))
    .limit(MAX_WEEKEND_MATCHES)
  const decision = weekendCardFor(
    rows.map((row) => ({ ...row, rivalId: row.clubSide === 'local' ? row.awayTeamId : row.homeTeamId })),
  )
  return decision ? { ...decision, matchIds: rows.map((row) => row.id) } : null
}

/** Lo que cabe en una tarjeta de fin de semana. */
export const MAX_WEEKEND_MATCHES = 8

/** Datos completos de una tarjeta, ya públicos y con los escudos como *data URI*. */
export async function loadShareCard(request: ShareRequest): Promise<ShareCardData | null> {
  // Las plantillas matchday dibujan los escudos sin disco: se tratan aparte (`crest-card.ts`).
  const bare = MATCHDAY_TEMPLATES.has(request.template)
  const club = await clubIdentity(bare)
  const toCard = (row: MatchRow) => toCardMatch(row, bare)
  switch (request.template) {
    case 'resultado':
    case 'proximo':
    case 'gol': {
      const [row] = await selectMatches()
        .where(and(eq(matches.id, request.id), isClubMatch))
        .limit(1)
      if (!row) return null
      const [sides] = await db
        .select({ homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId })
        .from(matches)
        .where(eq(matches.id, row.id))
      if (!sides) return null
      const eventRows = await selectEventRows(row.id)
      const events = toEventDTOs(eventRows, sides, await loadMinorIds(namedPlayerIds(eventRows)))
      const clubSide = row.clubSide === 'visita' ? 'away' : 'home'
      const goal = request.template === 'gol' ? lastClubGoal(events, clubSide) : null
      if (request.template === 'gol' && !goal) return null
      return {
        kind: 'match',
        template: request.template,
        clubName: club.name,
        match: await toCard(row),
        scorers: { home: scorerLines(events, 'home'), away: scorerLines(events, 'away') },
        matchday: request.template === 'proximo' ? await loadMatchday(request.photos) : null,
        goal: goal
          ? {
              scorer: goal.type === 'autogol' ? 'Autogol' : (goal.playerName ?? ''),
              minute: formatMinute(goal.minute, goal.stoppageMinute),
            }
          : null,
      }
    }
    case 'programacion':
    case 'resultados': {
      const ids = (await weekendRows(request.id, request.template)).map((row) => row.id)
      if (ids.length === 0) return null
      const rows = await selectMatches().where(inArray(matches.id, ids)).orderBy(asc(matches.kickoffAt))
      return {
        kind: 'weekend',
        template: request.template,
        clubName: club.name,
        clubCrest: club.crest,
        saturday: weekendOf(request.id),
        matches: await Promise.all(rows.map(toCard)),
        topLine: request.template === 'programacion' ? ((await loadTopLine())?.line ?? null) : null,
      }
    }
    case 'jornada': {
      const ids = (await jornadaMatches(request.id, request.series)).map((row) => row.id)
      if (ids.length === 0) return null
      const rows = await selectMatches().where(inArray(matches.id, ids))
      // En el orden de juego de la jornada.
      const ordered = ids.flatMap((id) => rows.filter((row) => row.id === id))
      const [first] = ordered
      const start = jornadaStart(ordered)
      if (!first || !start) return null
      const competitions = new Set(ordered.map((row) => row.competitionName))
      const [matchday, card] = await Promise.all([loadMatchday(request.photos), toCard(first)])
      return {
        kind: 'jornada',
        template: 'jornada',
        clubName: club.name,
        match: {
          ...card,
          kickoffAt: start,
          competitionName: competitions.size === 1 ? first.competitionName : '',
        },
        series: ordered.map((row) => row.seriesName),
        matchday,
      }
    }
    case 'noticia': {
      const [row] = await db
        .select({
          title: news.title,
          publishedAt: news.publishedAt,
          categoryName: newsCategories.name,
          ogMediaId: news.ogMediaId,
          coverMediaId: news.coverMediaId,
        })
        .from(news)
        .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
        .where(and(eq(news.id, request.id), isNewsVisible))
        .limit(1)
      if (!row?.publishedAt) return null
      const mediaId = row.ogMediaId ?? row.coverMediaId
      const [media] = mediaId
        ? await db
            .select({ variants: mediaAssets.variants, containsMinors: mediaAssets.containsMinors })
            .from(mediaAssets)
            .where(eq(mediaAssets.id, mediaId))
        : []
      return {
        kind: 'news',
        template: 'noticia',
        clubName: club.name,
        clubCrest: club.crest,
        title: row.title,
        categoryName: row.categoryName,
        publishedAt: row.publishedAt.toISOString(),
        // Una foto con menores nunca sale del sitio (6.3).
        photo: media && !media.containsMinors ? await newsPhoto(media.variants) : null,
      }
    }
  }
}

const MATCHDAY_TEMPLATES = new Set<ShareRequest['template']>(['proximo', 'jornada', 'programacion'])

async function toCardMatch(row: MatchRow, bare: boolean): Promise<CardMatch> {
  const [homeCrest, awayCrest] = await Promise.all([
    cardCrest(row.homeCrest, bare ? row.home.cardCrestStyle : null),
    cardCrest(row.awayCrest, bare ? row.away.cardCrestStyle : null),
  ])
  return {
    clubSide: row.clubSide === 'visita' ? 'visita' : 'local',
    home: { name: row.home.shortName, crest: homeCrest },
    away: { name: row.away.shortName, crest: awayCrest },
    seriesName: row.seriesName,
    competitionName: row.competitionName,
    roundLabel: row.roundLabel,
    kickoffAt: row.kickoffAt.toISOString(),
    venueName: row.venueName,
    status: row.status,
    resolution: row.resolution,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    homePenalties: row.homePenalties,
    awayPenalties: row.awayPenalties,
  }
}

async function clubIdentity(bare: boolean): Promise<{ name: string; crest: CardCrest | null }> {
  const [[settings], [crest]] = await Promise.all([
    db
      .select({ name: siteSettings.shortName, clubName: siteSettings.clubName })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
    db
      .select({
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        style: teams.cardCrestStyle,
      })
      .from(teams)
      .innerJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
      .where(eq(teams.isOwnClub, true))
      .limit(1),
  ])
  return {
    name: settings?.clubName ?? 'Club Deportivo Los Cachorros',
    crest: await cardCrest(crest, bare ? (crest?.style ?? 'color') : null),
  }
}

type CrestMedia = { variants: MediaVariants | null; width: number | null; height: number | null }

/**
 * Escudo como *data URI* PNG desde su variante de 512 px (2.7), con su escala óptica en el disco. Con
 * `bareStyle` (plantillas matchday) suma la versión sin disco, tratada con ese estilo (`crest-card.ts`). Sin
 * archivo, la tarjeta usa un disco con la inicial.
 */
async function cardCrest(
  media: CrestMedia | null | undefined,
  bareStyle: CrestCardStyle | null,
): Promise<CardCrest | null> {
  const variants = media?.variants
  const file = variants?.png512 ?? (variants?.master.endsWith('.png') ? variants.master : null)
  if (!media || !file) return null
  const bytes = await readMediaFile(file)
  if (!bytes) return null
  const bare = bareStyle
    ? await cardCrestImage(bytes, { style: bareStyle }).catch((error: unknown) => {
        logger.warn({ err: error, file }, 'no se pudo tratar un escudo para la tarjeta')
        return null
      })
    : null
  return {
    src: `data:image/png;base64,${bytes.toString('base64')}`,
    scale: crestScale(media.width, media.height, variants?.logo).disc,
    bare,
  }
}

/** Foto de la noticia reducida a JPEG de 1200 px (Satori no lee WebP y así pesa poco en memoria). */
async function newsPhoto(variants: MediaVariants | null): Promise<string | null> {
  if (!variants) return null
  const bytes = await readMediaFile(variants.master)
  if (!bytes) return null
  const { default: sharp } = await import('sharp')
  const jpeg = await sharp(bytes, { limitInputPixels: 50_000_000 })
    .resize({ width: 1200, height: 900, fit: 'cover', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

export async function readMediaFile(relativePath: string): Promise<Buffer | null> {
  const root = uploadsDir()
  const file = path.resolve(/* turbopackIgnore: true */ root, relativePath)
  // Las rutas vienen de la BD, pero igual se verifica que no salgan de la carpeta de subidas.
  if (!file.startsWith(root + path.sep)) return null
  try {
    return await readFile(file)
  } catch (error) {
    logger.warn({ err: error, file: relativePath }, 'no se encontró una imagen para una tarjeta')
    return null
  }
}
