import { revalidateTag } from 'next/cache'
import { listMedia } from '@/features/media/queries'
import { uploadMediaSchema } from '@/features/media/schemas'
import { storeUploadedImage, UploadError } from '@/features/media/store'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { tags } from '@/lib/cache-tags'
import { env } from '@/lib/env'
import { requestLogger } from '@/lib/logger'

const noStore = { 'Cache-Control': 'no-store' }

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: noStore })
}

function authFailure(error: unknown): Response | null {
  if (!(error instanceof AuthError)) return null
  return json({ ok: false, message: error.message }, error.reason === 'sin_sesion' ? 401 : 403)
}

/** Miniaturas para el selector de imágenes del panel: `?q=&pagina=`. */
export async function GET(request: Request) {
  try {
    await requirePermission('media:write')
  } catch (error) {
    return authFailure(error) ?? json({ ok: false, message: 'No se pudo cargar la biblioteca.' }, 500)
  }
  const url = new URL(request.url)
  const page = Number.parseInt(url.searchParams.get('pagina') ?? '1', 10)
  const result = await listMedia({
    q: url.searchParams.get('q') ?? undefined,
    page: Number.isFinite(page) ? page : 1,
  })
  return json({ ok: true, data: result }, 200)
}

/**
 * Subida de una imagen (especificación 2.7): un archivo por petición. Esta ruta queda fuera del
 * `matcher` del proxy a propósito (trampa 6: el proxy trunca cuerpos grandes sin avisar).
 */
export async function POST(request: Request) {
  const log = requestLogger(request.headers)
  let user: Awaited<ReturnType<typeof requirePermission>>
  try {
    user = await requirePermission('media:write')
  } catch (error) {
    return authFailure(error) ?? json({ ok: false, message: 'No se pudo subir la imagen.' }, 500)
  }

  // La cookie es SameSite=Lax; además se exige que la petición venga del propio sitio.
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(env.SITE_URL ?? origin).origin) {
    return json({ ok: false, message: 'La subida debe hacerse desde el panel.' }, 403)
  }

  // Corte temprano por tamaño declarado; el tamaño real se vuelve a revisar al leer el archivo.
  const maxBytes = (env.MAX_UPLOAD_MB ?? 12) * 1024 * 1024
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes + 64 * 1024) {
    return json({ ok: false, message: `La imagen pesa más de ${env.MAX_UPLOAD_MB ?? 12} MB.` }, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ ok: false, message: 'No pudimos leer el archivo. Vuelve a intentarlo.' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File)) return json({ ok: false, message: 'Elige una imagen para subir.' }, 400)

  const parsed = uploadMediaSchema.safeParse({
    altText: form.get('altText'),
    credit: form.get('credit'),
    kind: form.get('kind') ?? undefined,
  })
  if (!parsed.success) {
    return json(
      { ok: false, message: parsed.error.issues[0]?.message ?? 'Revisa los datos de la imagen.' },
      400,
    )
  }

  try {
    const media = await storeUploadedImage({
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: file.name || null,
      altText: parsed.data.altText,
      credit: parsed.data.credit,
      kind: parsed.data.kind,
      userId: user.id,
    })
    revalidateTag(tags.media(), 'max')
    return json({ ok: true, data: media }, 201)
  } catch (error) {
    if (error instanceof UploadError) return json({ ok: false, message: error.message }, error.status)
    log.error({ err: error }, 'falló la subida de una imagen')
    return json({ ok: false, message: 'No pudimos guardar la imagen. Inténtalo de nuevo.' }, 500)
  }
}
