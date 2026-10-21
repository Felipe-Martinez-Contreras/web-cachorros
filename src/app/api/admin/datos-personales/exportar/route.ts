import { db } from '@/db/client'
import { findPersonalData, summarize } from '@/features/privacy/queries'
import { personalDataQuerySchema } from '@/features/privacy/schemas'
import { audit } from '@/lib/audit'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { systemClock } from '@/lib/clock'
import { env } from '@/lib/env'
import { toIsoDate } from '@/lib/format'
import { isSameOrigin } from '@/lib/forms/origin'
import { requestLogger } from '@/lib/logger'

const noStore = { 'Cache-Control': 'no-store' }

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } })

/**
 * Derecho de acceso y portabilidad (especificación 9.6): descarga en JSON todo lo que el club guarda de una
 * persona. Es un POST desde el panel para que el correo, el RUT o el celular no queden en la URL ni en los
 * registros del servidor. Cada descarga se audita con el tipo de dato y el número de registros.
 */
export async function POST(request: Request) {
  let user: Awaited<ReturnType<typeof requirePermission>>
  try {
    user = await requirePermission('privacy:manage')
  } catch (error) {
    if (error instanceof AuthError) return text(error.message, error.reason === 'sin_sesion' ? 401 : 403)
    throw error
  }
  if (!isSameOrigin(request.headers, env.SITE_URL)) {
    return text('La exportación debe hacerse desde el panel.', 403)
  }

  const form = await request.formData().catch(() => null)
  const parsed = personalDataQuerySchema.safeParse({ q: form?.get('q') })
  if (!parsed.success) return text('Escribe un correo, un RUT o un celular válido.', 400)
  const who = parsed.data.q

  try {
    const found = await findPersonalData(who)
    const summary = summarize(who, found)
    await db.transaction((tx) =>
      audit(tx, user, 'personal_data.export', {
        entityType: 'personal_data',
        summary: `Exportó los datos de una persona (${summary.total} registros)`,
        meta: { kind: who.kind, rows: summary.total },
      }),
    )
    const body = JSON.stringify(
      { exportadoEl: new Date().toISOString(), buscadoPor: who.kind, registros: found },
      null,
      2,
    )
    return new Response(body, {
      headers: {
        ...noStore,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="datos-personales-${toIsoDate(systemClock.now())}.json"`,
      },
    })
  } catch (error) {
    requestLogger(request.headers).error({ err: error }, 'exportación de datos personales: falló')
    return text('No se pudo generar el archivo. Intenta de nuevo.', 500)
  }
}
