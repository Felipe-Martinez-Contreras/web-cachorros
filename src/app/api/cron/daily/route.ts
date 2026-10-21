import { runRetention } from '@/features/inbox/retention'
import { cronRejection } from '@/lib/cron-auth'
import { logger } from '@/lib/logger'

/**
 * Tarea `daily` (especificación 12.8): una vez al día el contenedor `ops` llama a esta ruta con
 * `Authorization: Bearer $CRON_SECRET`. Aplica la retención de datos personales y limpia la auditoría (9.6).
 */
export async function GET(request: Request) {
  const rejection = cronRejection(request)
  if (rejection) return rejection
  try {
    const retention = await runRetention()
    logger.info(retention, 'daily: retención aplicada')
    return Response.json({ ok: true, retention }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error({ err: error }, 'daily: falló la tarea')
    return Response.json({ ok: false, message: 'La tarea falló.' }, { status: 500 })
  }
}
