import { summarizeCspReports } from '@/lib/csp'
import { env } from '@/lib/env'
import { clientIp, hashIp } from '@/lib/forms/client-ip'
import { RateLimiter } from '@/lib/forms/rate-limit'
import { requestLogger } from '@/lib/logger'

/** Un navegador con una página rota puede mandar muchos: 30 reportes por minuto por IP bastan. */
const limiter = new RateLimiter({ capacity: 30, windowMs: 60_000 })
const MAX_BYTES = 16 * 1024

const accepted = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })

/**
 * `POST /api/csp-report` (especificación 9.3): recibe las violaciones de la CSP y las
 * registra con pino, resumidas (directiva, origen de lo bloqueado y ruta de la página) y sin la IP.
 * Siempre responde 204: el navegador no hace nada con la respuesta.
 */
export async function POST(request: Request) {
  const ip = clientIp(request.headers, env.SITE_ENV ?? 'production')
  if (!limiter.take(ip).allowed) return accepted()
  const raw = await request.text()
  if (raw.length === 0 || raw.length > MAX_BYTES) return accepted()
  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return accepted()
  }
  const violations = summarizeCspReports(payload)
  if (!violations) return accepted()
  const log = requestLogger(request.headers)
  const ipHash = hashIp(ip, env.IP_HASH_SALT ?? '').slice(0, 16)
  for (const violation of violations) log.warn({ csp: violation, ipHash }, 'violación de CSP')
  return accepted()
}
