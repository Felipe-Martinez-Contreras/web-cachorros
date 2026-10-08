import 'server-only'
import { and, desc, eq, lte, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets, news, newsCategories } from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import type { NewsCardDTO } from './dto'

/** Solo se ve lo `publicada` cuya fecha de publicación ya pasó (especificación 6.1). */
const isVisible = and(eq(news.status, 'publicada'), lte(news.publishedAt, sql`now()`))

/**
 * Noticias de la portada: primero los comunicados fijados y la destacada, luego las más recientes.
 * La primera de la lista se muestra en grande.
 */
export async function getHomeNews(limit = 7): Promise<NewsCardDTO[]> {
  'use cache'
  cacheTag(tags.news())
  // Corta: una noticia programada debe aparecer sola cuando llega su hora.
  cacheLife('minutes')

  const rows = await db
    .select({
      id: news.id,
      slug: news.slug,
      title: news.title,
      excerpt: news.excerpt,
      type: news.type,
      categoryName: newsCategories.name,
      publishedAt: news.publishedAt,
      cover: {
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        lqip: mediaAssets.lqip,
        credit: mediaAssets.credit,
        focalX: mediaAssets.focalX,
        focalY: mediaAssets.focalY,
      },
    })
    .from(news)
    .leftJoin(newsCategories, eq(newsCategories.id, news.categoryId))
    .leftJoin(mediaAssets, eq(mediaAssets.id, news.coverMediaId))
    .where(isVisible)
    .orderBy(desc(news.isPinned), desc(news.isFeatured), desc(news.publishedAt))
    .limit(limit)

  return rows.flatMap((row) =>
    row.publishedAt
      ? [
          {
            id: row.id,
            slug: row.slug,
            title: row.title,
            excerpt: row.excerpt,
            type: row.type,
            categoryName: row.categoryName,
            publishedAt: row.publishedAt.toISOString(),
            cover: toImageDTO(row.cover),
          },
        ]
      : [],
  )
}
