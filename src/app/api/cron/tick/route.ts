import { createHash, timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'
import { publishDueNews } from '@/features/news/publish-due'
import { tags } from '@/lib/cache-tags'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const digest = (value: string) => createHash('sha256').update(value).digest()

/** Compara en tiempo constante; el hash iguala los largos. */
function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

/**
 * Tarea `tick` (especificación 12.8): cada 5 minutos el contenedor `ops` llama a esta ruta con
 * `Authorization: Bearer $CRON_SECRET`. Publica las noticias programadas que llegaron a su hora.
 */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET
  if (!secret) {
    return Response.json({ ok: false, message: 'Falta configurar CRON_SECRET.' }, { status: 503 })
  }
  if (!isAuthorized(request, secret)) {
    return Response.json({ ok: false, message: 'No autorizado.' }, { status: 401 })
  }
  try {
    const published = await publishDueNews()
    if (published.length > 0) {
      revalidateTag(tags.news(), 'max')
      for (const row of published) revalidateTag(tags.newsItem(row.id), 'max')
      logger.info({ count: published.length }, 'tick: noticias programadas publicadas')
    }
    return Response.json(
      { ok: true, publishedNews: published.length },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.error({ err: error }, 'tick: falló la tarea')
    return Response.json({ ok: false, message: 'La tarea falló.' }, { status: 500 })
  }
}
