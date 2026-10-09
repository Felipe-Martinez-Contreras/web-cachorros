import 'server-only'
import { and, asc, count, desc, eq, ilike, inArray, ne } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import {
  albums,
  matches,
  mediaAssets,
  news,
  newsCategories,
  newsSeries,
  type newsStatus,
  series,
  teams,
} from '@/db/schema'
import { selectMatches, toMatchDTO } from '@/features/matches/queries'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { formatShortDate } from '@/lib/format'
import { type ImageDTO, toImageDTO } from '@/lib/images/dto'
import { richTextMediaIds } from '@/lib/rich-text/document'
import type { NewsArticleData } from './components/news-article'

// Lecturas del panel: sin caché, siempre el estado actual.

type Status = (typeof newsStatus.enumValues)[number]

export const NEWS_ADMIN_PAGE_SIZE = 20

const thumbSelect = {
  id: mediaAssets.id,
  variants: mediaAssets.variants,
  altText: mediaAssets.altText,
  containsMinors: mediaAssets.containsMinors,
}

/** Con `leftJoin`, Drizzle entrega `null` cuando la noticia no tiene esa imagen. */
function toThumb(row: Parameters<typeof toMediaThumbDTO>[0] | null): MediaThumbDTO | null {
  return row ? toMediaThumbDTO(row) : null
}

export async function listNewsAdmin(options: {
  q?: string
  status?: Status | null
  categoryId?: string | null
  page?: number
}) {
  const term = options.q?.trim()
  const where = and(
    term ? ilike(news.title, `%${term}%`) : undefined,
    options.status ? eq(news.status, options.status) : undefined,
    options.categoryId ? eq(news.categoryId, options.categoryId) : undefined,
  )
  const [totals] = await db.select({ total: count() }).from(news).where(where)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / NEWS_ADMIN_PAGE_SIZE))
  const page = Math.min(Math.max(1, options.page ?? 1), totalPages)

  const rows = await db
    .select({
      id: news.id,
      title: news.title,
      type: news.type,
      status: news.status,
      publishedAt: news.publishedAt,
      updatedAt: news.updatedAt,
      isFeatured: news.isFeatured,
      isPinned: news.isPinned,
      categoryName: newsCategories.name,
      cover: thumbSelect,
    })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .leftJoin(mediaAssets, eq(mediaAssets.id, news.coverMediaId))
    .where(where)
    // Lo último que se tocó primero: el borrador en curso queda arriba.
    .orderBy(desc(news.updatedAt))
    .limit(NEWS_ADMIN_PAGE_SIZE)
    .offset((page - 1) * NEWS_ADMIN_PAGE_SIZE)
  return {
    items: rows.map(({ cover, ...row }) => ({ ...row, cover: toThumb(cover) })),
    page,
    totalPages,
    total,
  }
}

export type NewsAdminDetail = NonNullable<Awaited<ReturnType<typeof getNewsAdmin>>>

export async function getNewsAdmin(id: string) {
  const ogMedia = alias(mediaAssets, 'og_media')
  const [row] = await db
    .select({
      id: news.id,
      title: news.title,
      slug: news.slug,
      type: news.type,
      excerpt: news.excerpt,
      body: news.body,
      categoryId: news.categoryId,
      status: news.status,
      publishedAt: news.publishedAt,
      isFeatured: news.isFeatured,
      isPinned: news.isPinned,
      matchId: news.matchId,
      albumId: news.albumId,
      seoTitle: news.seoTitle,
      seoDescription: news.seoDescription,
      cover: thumbSelect,
      og: {
        id: ogMedia.id,
        variants: ogMedia.variants,
        altText: ogMedia.altText,
        containsMinors: ogMedia.containsMinors,
      },
    })
    .from(news)
    .leftJoin(mediaAssets, eq(mediaAssets.id, news.coverMediaId))
    .leftJoin(ogMedia, eq(ogMedia.id, news.ogMediaId))
    .where(eq(news.id, id))
  if (!row) return null
  const seriesRows = await db
    .select({ seriesId: newsSeries.seriesId })
    .from(newsSeries)
    .where(eq(newsSeries.newsId, id))
  const { cover, og, ...rest } = row
  return {
    ...rest,
    cover: toThumb(cover),
    og: toThumb(og),
    seriesIds: seriesRows.map((item) => item.seriesId),
  }
}

const imageSelect = {
  id: mediaAssets.id,
  variants: mediaAssets.variants,
  width: mediaAssets.width,
  height: mediaAssets.height,
  altText: mediaAssets.altText,
  lqip: mediaAssets.lqip,
  credit: mediaAssets.credit,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
}

/** Lo que necesita la vista previa: la noticia tal como está guardada, en cualquier estado. */
export async function getNewsPreview(id: string): Promise<NewsArticleData | null> {
  const [row] = await db
    .select({
      title: news.title,
      type: news.type,
      status: news.status,
      body: news.body,
      publishedAt: news.publishedAt,
      coverMediaId: news.coverMediaId,
      matchId: news.matchId,
      categoryName: newsCategories.name,
    })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .where(eq(news.id, id))
  if (!row) return null

  const bodyMediaIds = richTextMediaIds(row.body)
  const mediaIds = [...new Set([...bodyMediaIds, ...(row.coverMediaId ? [row.coverMediaId] : [])])]
  const [mediaRows, matchRows] = await Promise.all([
    mediaIds.length > 0
      ? db.select(imageSelect).from(mediaAssets).where(inArray(mediaAssets.id, mediaIds))
      : [],
    row.matchId ? selectMatches().where(eq(matches.id, row.matchId)).limit(1) : [],
  ])
  const images = new Map<string, ImageDTO>()
  for (const media of mediaRows) {
    const image = toImageDTO(media)
    if (image) images.set(media.id, image)
  }
  const [matchRow] = matchRows
  return {
    title: row.title,
    type: row.type,
    categoryName: row.categoryName,
    publishedAt: row.status === 'borrador' ? null : (row.publishedAt?.toISOString() ?? null),
    cover: (row.coverMediaId ? images.get(row.coverMediaId) : null) ?? null,
    body: row.body,
    bodyImages: Object.fromEntries(
      bodyMediaIds.flatMap((mediaId) => {
        const image = images.get(mediaId)
        return image ? [[mediaId, image]] : []
      }),
    ),
    match: matchRow ? toMatchDTO(matchRow) : null,
  }
}

const MATCH_OPTIONS = 60

/** Listas de los selectores del formulario de noticias. */
export async function newsFormOptions() {
  const homeTeam = alias(teams, 'home_team')
  const awayTeam = alias(teams, 'away_team')
  const [categories, seriesRows, matchRows, albumRows] = await Promise.all([
    db
      .select({ value: newsCategories.id, label: newsCategories.name })
      .from(newsCategories)
      .orderBy(asc(newsCategories.sortOrder), asc(newsCategories.name)),
    db
      .select({ value: series.id, label: series.name })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(asc(series.sortOrder), asc(series.name)),
    db
      .select({
        id: matches.id,
        kickoffAt: matches.kickoffAt,
        seriesName: series.name,
        homeName: homeTeam.shortName,
        awayName: awayTeam.shortName,
      })
      .from(matches)
      .innerJoin(series, eq(series.id, matches.seriesId))
      .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
      .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
      // Los partidos del club, del más reciente hacia atrás (también los que están por jugarse).
      .where(
        and(
          ne(matches.clubSide, 'ninguno'),
          inArray(matches.status, ['finalizado', 'programado', 'en_vivo']),
        ),
      )
      .orderBy(desc(matches.kickoffAt))
      .limit(MATCH_OPTIONS),
    db.select({ value: albums.id, label: albums.title }).from(albums).orderBy(desc(albums.takenOn)),
  ])
  return {
    categories,
    series: seriesRows,
    matches: matchRows.map((match) => ({
      value: match.id,
      label: `${formatShortDate(match.kickoffAt)} · ${match.seriesName} · ${match.homeName} vs ${match.awayName}`,
    })),
    albums: albumRows,
  }
}

export type NewsFormOptions = Awaited<ReturnType<typeof newsFormOptions>>

export function listNewsCategoriesAdmin() {
  return db
    .select({
      id: newsCategories.id,
      name: newsCategories.name,
      slug: newsCategories.slug,
      sortOrder: newsCategories.sortOrder,
      newsCount: count(news.id),
    })
    .from(newsCategories)
    .leftJoin(news, eq(news.categoryId, newsCategories.id))
    .groupBy(newsCategories.id)
    .orderBy(asc(newsCategories.sortOrder), asc(newsCategories.name))
}

export async function getNewsCategoryAdmin(id: string) {
  const [row] = await db
    .select({ id: newsCategories.id, name: newsCategories.name, sortOrder: newsCategories.sortOrder })
    .from(newsCategories)
    .where(eq(newsCategories.id, id))
  return row ?? null
}

/** Borradores y programadas para Inicio del panel. */
export function listPendingNews(limit = 5) {
  return db
    .select({ id: news.id, title: news.title, status: news.status, publishedAt: news.publishedAt })
    .from(news)
    .where(inArray(news.status, ['borrador', 'programada']))
    .orderBy(desc(news.updatedAt))
    .limit(limit)
}
