import { getShareImage } from '@/features/share/images'
import {
  parseShareRequest,
  SHARE_FORMATS,
  type ShareRequest,
  shareFilename,
} from '@/features/share/lib/cards'
import { parseSeries } from '@/features/share/lib/jornada'
import { shareVersionOf } from '@/features/share/queries'
import { parsePhotos } from '@/features/social-publishing/lib/photos'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { requestLogger } from '@/lib/logger'

type Params = { params: Promise<{ clave: string; formato: string }> }

const noStore = { 'Cache-Control': 'private, no-store' }

/**
 * `GET /api/admin/tarjetas/jornada/[clave]/[formato]?series=id1,id2&fotos=id1,,id3[&descargar=1]`: tarjeta
 * de una jornada con las series y las fotos elegidas en el panel. Solo con sesión: lo elegido no va por la
 * ruta pública. Las fotos marcadas «contiene menores» no se dibujan (las descarta el matchday).
 */
export async function GET(request: Request, { params }: Params) {
  try {
    await requirePermission('matches:write')
  } catch (error) {
    const status = error instanceof AuthError && error.reason === 'sin_sesion' ? 401 : 403
    return new Response(null, { status, headers: noStore })
  }
  const { clave, formato } = await params
  const base = parseShareRequest('jornada', clave, formato)
  const search = new URL(request.url).searchParams
  const seriesParam = search.get('series')
  const photosParam = search.get('fotos')
  const series = parseSeries(seriesParam)
  const photos = parsePhotos(photosParam)
  // Un parámetro que no corresponde no se ignora: la tarjeta no sería la que se eligió.
  if (!base || (seriesParam && !series) || (photosParam && !photos)) {
    return new Response(null, { status: 404, headers: noStore })
  }
  const card: ShareRequest = { ...base, ...(series ? { series } : {}), ...(photos ? { photos } : {}) }
  try {
    const current = await shareVersionOf(card)
    const image = current ? await getShareImage(card, current.version) : null
    if (!current || !image) return new Response(null, { status: 404, headers: noStore })
    const { ext } = SHARE_FORMATS[card.format]
    const download = search.get('descargar') === '1'
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        ...noStore,
        'Content-Type': ext === 'jpg' ? 'image/jpeg' : 'image/png',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${shareFilename(card, current.slug)}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'no se pudo generar la tarjeta de una jornada')
    return new Response(null, { status: 503, headers: noStore })
  }
}
