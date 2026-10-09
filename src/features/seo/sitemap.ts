import 'server-only'
import { asc, desc, eq, max } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { matches, news, players, series } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { isNewsVisible } from '@/features/news/queries'
import { loadMinorIds } from '@/features/players/public'
import { tags } from '@/lib/cache-tags'

export type SitemapEntry = { path: string; lastModified: string | null }

// Secciones ya construidas. Las que siguen en «Próximamente» no se listan (tampoco se indexan).
const STATIC_PATHS = [
  '/',
  '/noticias',
  '/partidos',
  '/partidos/posiciones',
  '/partidos/goleadores',
  '/historia',
  '/historia/titulos',
  '/historia/salon-de-la-fama',
  '/historia/camisetas',
]

const SITEMAP_LIMIT = 5000

/**
 * Páginas del sitio para `sitemap.xml` (especificación 11), con las mismas reglas de visibilidad que cada
 * página: noticias publicadas, partidos del club, series activas y jugadores activos **adultos** (los
 * menores salen por `loadMinorIds`, el único punto de paso de jugadores hacia el sitio; 6.3).
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  'use cache'
  cacheTag(tags.news(), tags.matches(), tags.players(), tags.history())
  cacheLife('hours')

  const [newsRows, matchRows, seriesRows, playerRows, [latest]] = await Promise.all([
    db
      .select({ slug: news.slug, updatedAt: news.updatedAt })
      .from(news)
      .where(isNewsVisible)
      .orderBy(desc(news.publishedAt))
      .limit(SITEMAP_LIMIT),
    db
      .select({ slug: matches.slug, updatedAt: matches.updatedAt })
      .from(matches)
      .where(isClubMatch)
      .orderBy(desc(matches.kickoffAt))
      .limit(SITEMAP_LIMIT),
    db
      .select({ slug: series.slug })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(asc(series.sortOrder)),
    db
      .select({ id: players.id, slug: players.slug, updatedAt: players.updatedAt })
      .from(players)
      .where(eq(players.isActive, true))
      .orderBy(asc(players.slug))
      .limit(SITEMAP_LIMIT),
    db
      .select({ newsAt: max(news.updatedAt) })
      .from(news)
      .where(isNewsVisible),
  ])
  const minors = await loadMinorIds(playerRows.map((player) => player.id))
  const iso = (date: Date | null | undefined) => date?.toISOString() ?? null

  return [
    ...STATIC_PATHS.map((path) => ({
      path,
      lastModified: path === '/' || path === '/noticias' ? iso(latest?.newsAt) : null,
    })),
    ...seriesRows.map((row) => ({ path: `/plantel/${row.slug}`, lastModified: null })),
    ...newsRows.map((row) => ({ path: `/noticias/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...matchRows.map((row) => ({ path: `/partidos/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...playerRows
      .filter((player) => !minors.has(player.id))
      .map((row) => ({ path: `/jugadores/${row.slug}`, lastModified: iso(row.updatedAt) })),
  ]
}
