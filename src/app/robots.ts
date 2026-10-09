import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { siteBaseUrl } from '@/features/seo/metadata'
import { env } from '@/lib/env'

/**
 * `robots.txt` generado en runtime (especificación 11). Solo producción se deja rastrear; staging y
 * desarrollo bloquean todo. El panel y la API nunca se rastrean.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  if (env.SITE_ENV !== 'production') return { rules: [{ userAgent: '*', disallow: '/' }] }
  const base = siteBaseUrl()
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
