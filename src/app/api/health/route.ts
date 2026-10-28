import { connection } from 'next/server'
import { sql } from '@/db/client'
import { env } from '@/lib/env'
import { createHealthWatchdog } from '@/lib/health-watchdog'
import { logger } from '@/lib/logger'

const DB_TIMEOUT_MS = 2000

/** Sin valor, el vigilante actúa a los 3 minutos fuera de desarrollo (en desarrollo, nunca). */
const restartAfterS = env.HEALTH_RESTART_AFTER_S ?? (env.SITE_ENV === 'development' ? 0 : 180)
const watchdog = createHealthWatchdog({ restartAfterMs: restartAfterS * 1000 })
let exiting = false

async function pingDb(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), DB_TIMEOUT_MS)
      }),
    ])
    return true
  } catch (error) {
    logger.error({ err: error }, 'health: la base de datos no responde')
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Estado del servicio para monitores y despliegues. Sin secretos ni detalles internos. */
export async function GET() {
  await connection() // siempre en runtime: nunca se evalúa durante el build
  const dbOk = await pingDb()
  if (watchdog.record(dbOk) && !exiting) {
    exiting = true
    logger.fatal(
      { failingForS: Math.round(watchdog.failingFor() / 1000) },
      'health: la base de datos no responde hace demasiado; la app termina para que Docker la reinicie',
    )
    // Un instante para que salga el log y esta respuesta.
    setTimeout(() => process.exit(1), 500).unref()
  }
  return Response.json(
    { status: dbOk ? 'ok' : 'error', db: dbOk ? 'ok' : 'error', version: env.APP_VERSION ?? 'dev' },
    { status: dbOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
