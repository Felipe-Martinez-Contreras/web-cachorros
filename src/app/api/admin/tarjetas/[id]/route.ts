import { getShareImage } from '@/features/share/images'
import type { ShareRequest } from '@/features/share/lib/cards'
import { shareVersionOf } from '@/features/share/queries'
import { parsePhotos } from '@/features/social-publishing/lib/photos'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { requestLogger } from '@/lib/logger'

type Params = { params: Promise<{ id: string }> }

const noStore = { 'Cache-Control': 'private, no-store' }

/**
 * `GET /api/admin/tarjetas/[id]?fotos=id1,,id3`: vista previa de «Próximo partido» (4:5) con las fotos
 * elegidas para una publicación. Solo para el panel: con fotos a elección, la tarjeta no va por la ruta
 * pública. Las fotos marcadas «contiene menores» no se dibujan (las descarta el matchday).
 */
export async function GET(request: Request, { params }: Params) {
  try {
    await requirePermission('social:write')
  } catch (error) {
    const status = error instanceof AuthError && error.reason === 'sin_sesion' ? 401 : 403
    return new Response(null, { status, headers: noStore })
  }
  const { id } = await params
  const photos = parsePhotos(new URL(request.url).searchParams.get('fotos'))
  if (!isUuid(id) || !photos) return new Response(null, { status: 404, headers: noStore })
  const card: ShareRequest = { template: 'proximo', id: id.toLowerCase(), format: 'vertical', photos }
  try {
    const current = await shareVersionOf(card)
    const image = current ? await getShareImage(card, current.version) : null
    if (!image) return new Response(null, { status: 404, headers: noStore })
    return new Response(new Uint8Array(image.bytes), {
      headers: { ...noStore, 'Content-Type': 'image/png', 'X-Content-Type-Options': 'nosniff' },
    })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'no se pudo generar la vista previa de una tarjeta')
    return new Response(null, { status: 503, headers: noStore })
  }
}
