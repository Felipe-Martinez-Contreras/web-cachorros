import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * Autorización de las tareas programadas (`Authorization: Bearer $CRON_SECRET`, especificación 12.8).
 * Compara en tiempo constante (el hash iguala los largos). Devuelve la respuesta de rechazo, o `null`.
 */
export function cronRejection(request: Request): Response | null {
  const secret = env.CRON_SECRET
  if (!secret) {
    return Response.json({ ok: false, message: 'Falta configurar CRON_SECRET.' }, { status: 503 })
  }
  const header = request.headers.get('authorization') ?? ''
  if (!timingSafeEqual(digest(header), digest(`Bearer ${secret}`))) {
    return Response.json({ ok: false, message: 'No autorizado.' }, { status: 401 })
  }
  return null
}
