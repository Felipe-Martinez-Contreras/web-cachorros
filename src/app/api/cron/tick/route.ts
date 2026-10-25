import { revalidateTag } from 'next/cache'
import { retryPendingNotifications } from '@/features/inbox/notify'
import { publishDueNews } from '@/features/news/publish-due'
import { runSocialPublishing } from '@/features/social-publishing/tick'
import { tags } from '@/lib/cache-tags'
import { cronRejection } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

/**
 * Tarea `tick` (especificación 12.8): cada 5 minutos el contenedor `ops` llama a esta ruta con
 * `Authorization: Bearer $CRON_SECRET`. Publica las noticias programadas que llegaron a su hora, reintenta
 * los avisos por correo de los formularios que fallaron y publica en Facebook lo que corresponda (ADR 0009).
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
    // Facebook va aparte: si falla, no tumba lo demás de la tarea.
    const social = await runSocialPublishing().catch((error: unknown) => {
      logger.error({ err: error }, 'tick: falló la publicación en redes')
      return null
    })
    if (social && social.queued + social.published + social.failed > 0) {
      logger.info(social, 'tick: publicaciones en redes')
    }
    return Response.json(
      { ok: true, publishedNews: published.length, notifications, social },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    logger.error({ err: error }, 'tick: falló la tarea')
    return Response.json({ ok: false, message: 'La tarea falló.' }, { status: 500 })
  }
}
