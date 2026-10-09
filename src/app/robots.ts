import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { siteBaseUrl } from '@/features/seo/metadata'
import { env } from '@/lib/env'

/**
 * `robots.txt` generado en runtime (especificación 11). Solo producción se deja rastrear; staging y
 * desarrollo bloquean todo (además de `<meta name="robots" content="noindex">` en cada página). El panel y
 * la API nunca se rastrean.
 *
 * La cabecera `X-Robots-Tag` en todas las respuestas no se puede fijar en `next.config` (se resuelve en el
 * build) ni en `proxy.ts` sin ampliar su matcher (ADR 0008): va en el proxy inverso.
 * [VERIFICAR: cabecera X-Robots-Tag noindex en staging desde el Caddyfile, Fase 5]
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
