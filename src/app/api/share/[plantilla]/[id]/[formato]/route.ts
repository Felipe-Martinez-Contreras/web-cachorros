import { QueueAbortedError } from '@/features/media/lib/upload-rules'
import { getShareImage } from '@/features/share/images'
import {
  isValidVersion,
  parseShareRequest,
  SHARE_FORMATS,
  shareFilename,
  shareUrl,
} from '@/features/share/lib/cards'
import { shareVersionOf } from '@/features/share/queries'
import { requestLogger } from '@/lib/logger'

type Params = { params: Promise<{ plantilla: string; id: string; formato: string }> }

/**
 * `GET /api/share/[plantilla]/[id]/[formato]?v=<versión>` (especificación 2.8): tarjeta para redes u
 * Open Graph. Con la versión vigente se sirve como inmutable (Cloudflare la cachea); sin ella o con una
 * antigua, redirige a la vigente. `?descargar=1` la entrega como archivo.
 */
export async function GET(request: Request, { params }: Params) {
  const { plantilla, id, formato } = await params
  const card = parseShareRequest(plantilla, id, formato)
  if (!card) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  const url = new URL(request.url)
  const download = url.searchParams.get('descargar') === '1'
  try {
    const current = await shareVersionOf(card)
    if (!current)
      return new Response(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=60' },
      })

    const requested = url.searchParams.get('v')
    if (!isValidVersion(requested) || requested !== current.version) {
      const target =
        shareUrl(card.template, card.id, card.format, current.version) + (download ? '&descargar=1' : '')
      return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } })
    }

    const image = await getShareImage(card, current.version, request.signal)
    if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const { ext } = SHARE_FORMATS[card.format]
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        'Content-Type': ext === 'jpg' ? 'image/jpeg' : 'image/png',
        'Content-Length': String(image.bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${shareFilename(card, current.slug)}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    // Quien la pidió se fue antes de su turno en la cola: no se dibujó (y nadie lee la respuesta).
    if (error instanceof QueueAbortedError) return new Response(null, { status: 499 })
    requestLogger(request.headers).error(
      { err: error, template: card.template },
      'no se pudo generar una tarjeta',
    )
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
