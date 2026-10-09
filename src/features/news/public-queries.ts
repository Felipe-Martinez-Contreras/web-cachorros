import 'server-only'
import { and, asc, count, desc, eq, exists, inArray, ne, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { matches, mediaAssets, news, newsCategories, newsSeries, series, slugRedirects } from '@/db/schema'
import { selectMatches, toMatchDTO } from '@/features/matches/queries'
import { tags } from '@/lib/cache-tags'
import { type ImageDTO, toImageDTO } from '@/lib/images/dto'
import { excerptOf, richTextMediaIds } from '@/lib/rich-text/document'
import type { NewsDetailDTO, NewsFeedItemDTO, NewsFiltersDTO, NewsPageDTO } from './dto'
import { NEWS_PAGE_SIZE } from './lib/public-params'
import { isNewsVisible, selectNewsCards, toNewsCardDTOs } from './queries'

// Lecturas públicas de Noticias: cacheadas por tags (especificación 3.4). La vida corta de la caché hace
// que una noticia programada aparezca sola cuando llega su hora.

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

/** Categorías y series por las que se puede filtrar el listado. */
export async function getNewsFilters(): Promise<NewsFiltersDTO> {
  'use cache'
  cacheTag(tags.news(), tags.matches())
  cacheLife('hours')

  const [categories, seriesRows] = await Promise.all([
    db
      .select({ slug: newsCategories.slug, name: newsCategories.name })
      .from(newsCategories)
      .orderBy(asc(newsCategories.sortOrder), asc(newsCategories.name)),
    db
      .select({ slug: series.slug, name: series.name })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(asc(series.sortOrder), asc(series.name)),
  ])
  return { categories, series: seriesRows }
}

/** Una página del listado, de la más reciente a la más antigua, con los filtros combinados. */
export async function getNewsPage(
  categorySlug: string | null,
  seriesSlug: string | null,
  requestedPage: number,
): Promise<NewsPageDTO> {
  'use cache'
  cacheTag(tags.news())
  cacheLife('minutes')

  const where = and(
    isNewsVisible,
    categorySlug ? eq(newsCategories.slug, categorySlug) : undefined,
    seriesSlug
      ? exists(
          db
            .select({ newsId: newsSeries.newsId })
            .from(newsSeries)
            .innerJoin(series, eq(series.id, newsSeries.seriesId))
            .where(and(eq(newsSeries.newsId, news.id), eq(series.slug, seriesSlug))),
        )
      : undefined,
  )
  const [totals] = await db
    .select({ total: count() })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .where(where)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE))
  const page = Math.min(requestedPage, totalPages)

  const rows = await selectNewsCards()
    .where(where)
    .orderBy(desc(news.publishedAt), desc(news.id))
    .limit(NEWS_PAGE_SIZE)
    .offset((page - 1) * NEWS_PAGE_SIZE)
  return { items: toNewsCardDTOs(rows), page, totalPages, total }
}

/** Detalle público de una noticia por su slug; `null` si no existe o no está publicada. */
export async function getNewsDetail(slug: string): Promise<NewsDetailDTO | null> {
  'use cache'
  // Incluye el partido relacionado (marcador de la crónica) y las imágenes del cuerpo.
  cacheTag(tags.news(), tags.media(), tags.matches())
  cacheLife('minutes')

  const [cardRow] = await selectNewsCards()
    .where(and(isNewsVisible, eq(news.slug, slug)))
    .limit(1)
  const [card] = cardRow ? toNewsCardDTOs([cardRow]) : []
  if (!card) return null
  cacheTag(tags.newsItem(card.id))

  const [extra] = await db
    .select({
      body: news.body,
      updatedAt: news.updatedAt,
      categoryId: news.categoryId,
      categorySlug: newsCategories.slug,
      matchId: news.matchId,
      seoTitle: news.seoTitle,
      seoDescription: news.seoDescription,
      ogMediaId: news.ogMediaId,
    })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .where(eq(news.id, card.id))
  if (!extra) return null

  const bodyMediaIds = richTextMediaIds(extra.body)
  const mediaIds = [...new Set([...bodyMediaIds, ...(extra.ogMediaId ? [extra.ogMediaId] : [])])]
  const [seriesRows, mediaRows, matchRows, relatedRows] = await Promise.all([
    db
      .select({ slug: series.slug, name: series.name })
      .from(newsSeries)
      .innerJoin(series, eq(series.id, newsSeries.seriesId))
      .where(eq(newsSeries.newsId, card.id))
      .orderBy(asc(series.sortOrder)),
    mediaIds.length > 0
      ? db
          .select(imageSelect)
          .from(mediaAssets)
          // Segunda barrera: una imagen marcada con menores después de insertarla no se muestra.
          .where(and(inArray(mediaAssets.id, mediaIds), eq(mediaAssets.containsMinors, false)))
      : [],
    extra.matchId ? selectMatches().where(eq(matches.id, extra.matchId)).limit(1) : [],
    // Primero las de la misma categoría; si no alcanzan, las más recientes.
    selectNewsCards()
      .where(and(isNewsVisible, ne(news.id, card.id)))
      .orderBy(
        ...(extra.categoryId ? [desc(sql`${news.categoryId} is not distinct from ${extra.categoryId}`)] : []),
        desc(news.publishedAt),
      )
      .limit(3),
  ])
  const images = new Map<string, ImageDTO>()
  for (const row of mediaRows) {
    const image = toImageDTO(row)
    if (image) images.set(row.id, image)
  }
  const bodyImages: Record<string, ImageDTO> = {}
  for (const id of bodyMediaIds) {
    const image = images.get(id)
    if (image) bodyImages[id] = image
  }
  const [matchRow] = matchRows

  return {
    ...card,
    categorySlug: extra.categorySlug,
    updatedAt: extra.updatedAt.toISOString(),
    body: extra.body,
    bodyImages,
    series: seriesRows,
    match: matchRow ? toMatchDTO(matchRow) : null,
    seoTitle: extra.seoTitle,
    seoDescription: extra.seoDescription,
    shareImage: (extra.ogMediaId ? images.get(extra.ogMediaId) : null) ?? card.cover,
    related: toNewsCardDTOs(relatedRows),
  }
}

/** Últimas noticias para el feed RSS. */
export async function getNewsFeed(limit = 20): Promise<NewsFeedItemDTO[]> {
  'use cache'
  cacheTag(tags.news())
  cacheLife('minutes')

  const rows = await db
    .select({
      slug: news.slug,
      title: news.title,
      excerpt: news.excerpt,
      bodyText: news.bodyText,
      categoryName: newsCategories.name,
      publishedAt: news.publishedAt,
    })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .where(isNewsVisible)
    .orderBy(desc(news.publishedAt))
    .limit(limit)
  return rows.flatMap((row) =>
    row.publishedAt
      ? [
          {
            slug: row.slug,
            title: row.title,
            summary: row.excerpt ?? excerptOf(row.bodyText ?? '', 300),
            categoryName: row.categoryName,
            publishedAt: row.publishedAt.toISOString(),
          },
        ]
      : [],
  )
}

/** Si `slug` es la dirección antigua de una noticia visible, devuelve la vigente (segunda barrera del 301). */
export async function resolveNewsRedirect(slug: string): Promise<string | null> {
  'use cache'
  cacheTag(tags.news())
  cacheLife('minutes')

  const [row] = await db
    .select({ slug: news.slug })
    .from(slugRedirects)
    .innerJoin(news, eq(news.id, slugRedirects.entityId))
    .where(and(eq(slugRedirects.entityType, 'news'), eq(slugRedirects.oldSlug, slug), isNewsVisible))
    .limit(1)
  return row?.slug ?? null
}
