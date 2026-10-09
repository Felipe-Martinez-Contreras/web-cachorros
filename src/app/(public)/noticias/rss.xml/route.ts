import { connection } from 'next/server'
import { getNewsFeed } from '@/features/news/public-queries'
import { getSite } from '@/features/settings/queries'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

/** XML 1.0 no admite caracteres de control, salvo tabulación y saltos de línea. */
function isXmlChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0
  return code >= 0x20 || code === 0x09 || code === 0x0a || code === 0x0d
}

function escapeXml(value: string): string {
  return [...value]
    .filter(isXmlChar)
    .join('')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Feed RSS 2.0 de las noticias (especificación 5.1 y 11). Las direcciones salen de `SITE_URL` en runtime. */
export async function GET() {
  await connection()
  try {
    const [site, items] = await Promise.all([getSite(), getNewsFeed()])
    const base = env.SITE_URL
    const clubName = site?.clubName ?? 'Club Deportivo Los Cachorros'
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      '<channel>',
      `<title>${escapeXml(`Noticias · ${clubName}`)}</title>`,
      `<link>${escapeXml(`${base}/noticias`)}</link>`,
      `<description>${escapeXml(`Últimas noticias del ${clubName}.`)}</description>`,
      '<language>es-CL</language>',
      `<atom:link href="${escapeXml(`${base}/noticias/rss.xml`)}" rel="self" type="application/rss+xml" />`,
      ...(items[0] ? [`<lastBuildDate>${new Date(items[0].publishedAt).toUTCString()}</lastBuildDate>`] : []),
      ...items.map((item) => {
        const url = escapeXml(`${base}/noticias/${item.slug}`)
        return [
          '<item>',
          `<title>${escapeXml(item.title)}</title>`,
          `<link>${url}</link>`,
          `<guid isPermaLink="true">${url}</guid>`,
          `<pubDate>${new Date(item.publishedAt).toUTCString()}</pubDate>`,
          ...(item.categoryName ? [`<category>${escapeXml(item.categoryName)}</category>`] : []),
          `<description>${escapeXml(item.summary)}</description>`,
          '</item>',
        ].join('')
      }),
      '</channel>',
      '</rss>',
    ].join('\n')
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'no se pudo generar el feed RSS')
    return new Response('No se pudo generar el feed. Intenta de nuevo en unos minutos.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}
