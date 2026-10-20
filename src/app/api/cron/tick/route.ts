import { revalidateTag } from 'next/cache'
import { retryPendingNotifications } from '@/features/inbox/notify'
import { publishDueNews } from '@/features/news/publish-due'
import { tags } from '@/lib/cache-tags'
import { cronRejection } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

/**
 * Tarea `tick` (especificación 12.8): cada 5 minutos el contenedor `ops` llama a esta ruta con
 * `Authorization: Bearer $CRON_SECRET`. Publica las noticias programadas que llegaron a su hora y reintenta
 * los avisos por correo de los formularios que fallaron.
 */
export async function GET(request: Request) {
  const rejection = cronRejection(request)
  if (rejection) return rejection
  try {
    const published = await publishDueNews()
    if (published.length > 0) {
      revalidateTag(tags.news(), 'max')
      for (const row of published) revalidateTag(tags.newsItem(row.id), 'max')
      logger.info({ count: published.length }, 'tick: noticias programadas publicadas')
    }
    const notifications = await retryPendingNotifications()
    if (notifications.sent + notifications.failed > 0) {
      logger.info(notifications, 'tick: avisos de formularios reintentados')
    }
    return Response.json(
      { ok: true, publishedNews: published.length, notifications },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.error({ err: error }, 'tick: falló la tarea')
    return Response.json({ ok: false, message: 'La tarea falló.' }, { status: 500 })
  }
}
