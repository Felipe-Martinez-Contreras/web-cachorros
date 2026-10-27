import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, teams } from '@/db/schema'
import { crestCardStyle } from '@/db/schema/enums'
import { type CrestCardStyle, crestPreviewTile } from '@/features/share/crest-card'
import { readMediaFile } from '@/features/share/queries'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { runHeavy } from '@/lib/heavy-queue'
import { requestLogger } from '@/lib/logger'

type Params = { params: Promise<{ id: string; estilo: string }> }

const noStore = { 'Cache-Control': 'private, no-store' }

const isStyle = (value: string): value is CrestCardStyle =>
  (crestCardStyle.enumValues as readonly string[]).includes(value)

/**
 * `GET /api/admin/escudos/[id]/[estilo]`: el escudo de un equipo tal como sale en las tarjetas matchday con
 * ese estilo (`color`, `blanco` o `grises`), sobre el fondo oscuro. Solo para el panel (Rivales → Escudos en
 * las tarjetas). Se trata en la cola de sharp; el navegador lo guarda unos minutos (la dirección lleva el id
 * del archivo del escudo, así que cambia al reemplazarlo).
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
      .select({ variants: mediaAssets.variants })
      .from(teams)
      .innerJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
      .where(eq(teams.id, id.toLowerCase()))
      .limit(1)
    const variants = team?.variants
    const file = variants?.png512 ?? (variants?.master.endsWith('.png') ? variants.master : null)
    const bytes = file ? await readMediaFile(file) : null
    const tile = bytes ? await runHeavy(() => crestPreviewTile(bytes, estilo)) : null
    if (!tile) return new Response(null, { status: 404, headers: noStore })
    return new Response(new Uint8Array(tile), {
      headers: {
        'Cache-Control': 'private, max-age=600',
        'Content-Type': 'image/png',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'no se pudo dibujar la vista previa de un escudo')
    return new Response(null, { status: 503, headers: noStore })
  }
}
