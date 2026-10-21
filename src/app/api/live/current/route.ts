import type { LiveCurrentResponse } from '@/features/matches/dto'
import { etagMatches, LIVE_CACHE_CONTROL, liveEtag } from '@/features/matches/lib/live-poll'
import { getLiveCurrent } from '@/features/matches/live-queries'
import { requestLogger } from '@/lib/logger'

/**
 * `GET /api/live/current` (especificación 2.6): partidos del club en vivo o por comenzar. Si nada cambió
 * desde la última consulta (`If-None-Match`), responde 304 sin cuerpo.
 */
export async function GET(request: Request) {
  try {
    const matches = await getLiveCurrent()
    const etag = liveEtag(matches)
    const headers = { 'Cache-Control': LIVE_CACHE_CONTROL, ETag: etag }
    if (etagMatches(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers })
    }
    const body: LiveCurrentResponse = { serverNow: new Date().toISOString(), matches }
    return Response.json(body, { headers })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'en vivo: no se pudo leer el estado actual')
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
