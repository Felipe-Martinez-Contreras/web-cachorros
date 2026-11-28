import 'server-only'
import { asc, desc, eq, max } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { isHiddenPath } from '@/config/secciones'
import { db } from '@/db/client'
import { albums, events, matches, news, players, products, series } from '@/db/schema'
import { getHallOfFame, getHistoricKits } from '@/features/history/queries'
import { isClubMatch } from '@/features/matches/queries'
import { isNewsVisible } from '@/features/news/queries'
import { loadMinorIds } from '@/features/players/public'
import { tags } from '@/lib/cache-tags'

export type SitemapEntry = { path: string; lastModified: string | null }

// Secciones ya construidas. Las que siguen en «Próximamente» no se listan (tampoco se indexan), ni las
// ocultas (`src/config/secciones.ts`). /videos y /apoya-al-club ahora redirigen (a /galeria y /socios).
const ALL_STATIC_PATHS = [
  '/',
  '/noticias',
  '/partidos',
  '/partidos/posiciones',
  '/partidos/goleadores',
  '/historia',
  '/historia/titulos',
  '/socios',
  '/auspiciadores',
  '/tienda',
  '/eventos',
  '/club/directiva',
  '/club/transparencia',
  '/club/la-cancha',
  '/formativas',
  '/galeria',
  '/galeria?vista=videos',
  '/contacto',
  '/privacidad',
]

const STATIC_PATHS = ALL_STATIC_PATHS.filter((path) => !isHiddenPath(path))

const SITEMAP_LIMIT = 5000

/**
 * Páginas del sitio para `sitemap.xml` (especificación 11), con las mismas reglas de visibilidad que cada
 * página: noticias publicadas, partidos del club, series activas y jugadores activos **adultos** (los
 * menores salen por `loadMinorIds`, el único punto de paso de jugadores hacia el sitio; 6.3).
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  'use cache'
  cacheTag(
    tags.news(),
    tags.matches(),
    tags.players(),
    tags.history(),
    tags.store(),
    tags.events(),
    tags.gallery(),
  )
  cacheLife('hours')

  const [newsRows, matchRows, seriesRows, playerRows, [latest], productRows, eventRows, albumRows] =
    await Promise.all([
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
      db
        .select({ slug: products.slug, updatedAt: products.updatedAt })
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(asc(products.sortOrder), asc(products.slug))
        .limit(SITEMAP_LIMIT),
      db
        .select({ slug: events.slug, updatedAt: events.updatedAt })
        .from(events)
        .where(eq(events.isPublished, true))
        .orderBy(desc(events.startsAt))
        .limit(SITEMAP_LIMIT),
      db
        .select({ slug: albums.slug, updatedAt: albums.updatedAt })
        .from(albums)
        .where(eq(albums.isPublished, true))
        .orderBy(desc(albums.takenOn))
        .limit(SITEMAP_LIMIT),
    ])
  const [minors, idols, kits] = await Promise.all([
    loadMinorIds(playerRows.map((player) => player.id)),
    getHallOfFame(),
    getHistoricKits(),
  ])
  // Las páginas de Historia fuera del menú, solo con contenido (la misma regla que sus enlaces en /historia).
  const historyPaths = [
    ...(idols.length > 0 ? ['/historia/salon-de-la-fama'] : []),
    ...(kits.length > 0 ? ['/historia/camisetas'] : []),
  ]
  const iso = (date: Date | null | undefined) => date?.toISOString() ?? null

  return [
    ...[...STATIC_PATHS, ...historyPaths].map((path) => ({
      path,
      lastModified: path === '/' || path === '/noticias' ? iso(latest?.newsAt) : null,
    })),
    ...seriesRows.map((row) => ({ path: `/plantel/${row.slug}`, lastModified: null })),
    ...newsRows.map((row) => ({ path: `/noticias/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...matchRows.map((row) => ({ path: `/partidos/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...playerRows
      .filter((player) => !minors.has(player.id))
      .map((row) => ({ path: `/jugadores/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...(isHiddenPath('/tienda') ? [] : productRows).map((row) => ({
      path: `/tienda/${row.slug}`,
      lastModified: iso(row.updatedAt),
    })),
    ...eventRows.map((row) => ({ path: `/eventos/${row.slug}`, lastModified: iso(row.updatedAt) })),
    ...albumRows.map((row) => ({ path: `/galeria/${row.slug}`, lastModified: iso(row.updatedAt) })),
  ]
}
