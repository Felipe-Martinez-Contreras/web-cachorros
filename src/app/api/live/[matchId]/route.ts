import type { LiveMatchResponse } from '@/features/matches/dto'
import { etagMatches, LIVE_CACHE_CONTROL, liveEtag } from '@/features/matches/lib/live-poll'
import { getLiveMatch } from '@/features/matches/live-queries'
import { isUuid } from '@/lib/form-schemas'
import { requestLogger } from '@/lib/logger'

/**
 * `GET /api/live/[matchId]` (especificación 2.6): marcador, período y cronología de un partido del club.
 * Responde 304 si no cambió desde la última consulta.
 */
export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  if (!isUuid(matchId)) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  try {
    const live = await getLiveMatch(matchId)
    if (!live) return new Response(null, { status: 404, headers: { 'Cache-Control': LIVE_CACHE_CONTROL } })
    const etag = liveEtag([live.match])
    const headers = { 'Cache-Control': LIVE_CACHE_CONTROL, ETag: etag }
    if (etagMatches(request.headers.get('if-none-match'), etag)) {
      return new Response(null, { status: 304, headers })
    }
    const body: LiveMatchResponse = { serverNow: new Date().toISOString(), ...live }
    return Response.json(body, { headers })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'en vivo: no se pudo leer el partido')
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
