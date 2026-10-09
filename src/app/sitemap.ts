import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { siteBaseUrl } from '@/features/seo/metadata'
import { getSitemapEntries } from '@/features/seo/sitemap'

/** `sitemap.xml` generado en runtime (especificación 3.7 y 11): direcciones absolutas desde `SITE_URL`. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const base = siteBaseUrl()
  const entries = await getSitemapEntries()
  return entries.map((entry) => ({
    url: `${base}${entry.path === '/' ? '' : entry.path}`,
    ...(entry.lastModified ? { lastModified: entry.lastModified } : null),
  }))
}
