import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { and, asc, eq, gte, inArray, lt, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { matches, mediaAssets, news, newsCategories, siteSettings, teams } from '@/db/schema'
import type { MediaVariants } from '@/db/schema/media'
import { formatMinute } from '@/features/matches/lib/match-clock'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { namedPlayerIds, selectEventRows, toEventDTOs } from '@/features/matches/public-events'
import { isClubMatch, type MatchRow, selectMatches } from '@/features/matches/queries'
import { uploadsDir } from '@/features/media/files'
import { isNewsVisible } from '@/features/news/queries'
import { loadMinorIds } from '@/features/players/public'
import { logger } from '@/lib/logger'
import type { CardMatch, ShareCardData } from './dto'
import {
  addDays,
  lastClubGoal,
  type ShareRequest,
  scorerLines,
  shortHash,
  templateFitsStatus,
  weekendOf,
  withDesignRevision,
} from './lib/cards'

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
      return { version: withDesignRevision(request.template, row.version), slug: row.slug }
    }
    case 'programacion':
    case 'resultados': {
      const rows = await weekendRows(request.id, request.template)
      if (rows.length === 0) return null
      const hash = shortHash(rows.map((row) => `${row.id}.${row.version}`))
      return { version: withDesignRevision(request.template, hash), slug: request.id }
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

/** Lo que cabe en una tarjeta de fin de semana. */
export const MAX_WEEKEND_MATCHES = 8

/** Datos completos de una tarjeta, ya públicos y con los escudos como *data URI*. */
export async function loadShareCard(request: ShareRequest): Promise<ShareCardData | null> {
  const club = await clubIdentity()
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
        match: await toCardMatch(row),
        scorers: { home: scorerLines(events, 'home'), away: scorerLines(events, 'away') },
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
        matches: await Promise.all(rows.map(toCardMatch)),
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

async function toCardMatch(row: MatchRow): Promise<CardMatch> {
  const [homeCrest, awayCrest] = await Promise.all([
    crestDataUri(row.homeCrest?.variants ?? null),
    crestDataUri(row.awayCrest?.variants ?? null),
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

async function clubIdentity(): Promise<{ name: string; crest: string | null }> {
  const [[settings], [crest]] = await Promise.all([
    db
      .select({ name: siteSettings.shortName, clubName: siteSettings.clubName })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
    db
      .select({ variants: mediaAssets.variants })
      .from(teams)
      .innerJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
      .where(eq(teams.isOwnClub, true))
      .limit(1),
  ])
  return {
    name: settings?.clubName ?? 'Club Deportivo Los Cachorros',
    crest: await crestDataUri(crest?.variants ?? null),
  }
}

/** Escudo como *data URI* PNG desde su variante de 512 px (2.7). Sin archivo, la tarjeta usa un disco. */
async function crestDataUri(variants: MediaVariants | null): Promise<string | null> {
  const file = variants?.png512 ?? (variants?.master.endsWith('.png') ? variants.master : null)
  if (!file) return null
  const bytes = await readMediaFile(file)
  return bytes ? `data:image/png;base64,${bytes.toString('base64')}` : null
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

async function readMediaFile(relativePath: string): Promise<Buffer | null> {
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
