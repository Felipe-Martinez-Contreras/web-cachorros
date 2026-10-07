import { connection } from 'next/server'
import { sql } from '@/db/client'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const DB_TIMEOUT_MS = 2000

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
  return Response.json(
    { status: dbOk ? 'ok' : 'error', db: dbOk ? 'ok' : 'error', version: env.APP_VERSION ?? 'dev' },
    { status: dbOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
