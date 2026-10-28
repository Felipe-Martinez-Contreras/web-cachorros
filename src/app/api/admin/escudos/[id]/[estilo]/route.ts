import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, teams } from '@/db/schema'
import { crestCardStyle } from '@/db/schema/enums'
import { QueueAbortedError } from '@/features/media/lib/upload-rules'
import type { CrestCardStyle } from '@/features/share/crest-card'
import { getCrestPreview } from '@/features/share/crest-preview'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { requestLogger } from '@/lib/logger'

type Params = { params: Promise<{ id: string; estilo: string }> }

const noStore = { 'Cache-Control': 'private, no-store' }

const isStyle = (value: string): value is CrestCardStyle =>
  (crestCardStyle.enumValues as readonly string[]).includes(value)

/**
 * `GET /api/admin/escudos/[id]/[estilo]`: el escudo de un equipo tal como sale en las tarjetas matchday con
 * ese estilo (`color`, `blanco` o `grises`), sobre el fondo oscuro. Solo para el panel (Rivales → Escudos en
 * las tarjetas). Se dibuja una sola vez por versión del escudo y estilo (`getCrestPreview`, en la cola de
 * sharp); la consulta termina antes de entrar a la cola. Si el navegador se va antes, no se dibuja.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    await requirePermission('sport:write')
  } catch (error) {
    const status = error instanceof AuthError && error.reason === 'sin_sesion' ? 401 : 403
    return new Response(null, { status, headers: noStore })
  }
  const { id, estilo } = await params
  if (!isUuid(id) || !isStyle(estilo)) return new Response(null, { status: 404, headers: noStore })
  try {
    const [team] = await db
      .select({ mediaId: mediaAssets.id, variants: mediaAssets.variants })
      .from(teams)
      .innerJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
      .where(eq(teams.id, id.toLowerCase()))
      .limit(1)
    const preview = team?.variants
      ? await getCrestPreview({
          mediaId: team.mediaId,
          variants: team.variants,
          style: estilo,
          signal: request.signal,
        })
      : null
    if (!preview) return new Response(null, { status: 404, headers: noStore })
    return new Response(new Uint8Array(preview.bytes), {
      headers: {
        // La dirección lleva el id del archivo del escudo: cambia al reemplazarlo.
        'Cache-Control': 'private, max-age=3600',
        'Content-Type': 'image/png',
        'X-Cache': preview.fromCache ? 'hit' : 'miss',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    // El navegador se fue antes de su turno en la cola: no se dibujó (y nadie lee la respuesta).
    if (error instanceof QueueAbortedError) return new Response(null, { status: 499, headers: noStore })
    requestLogger(request.headers).error({ err: error }, 'no se pudo dibujar la vista previa de un escudo')
    return new Response(null, { status: 503, headers: noStore })
  }
}
