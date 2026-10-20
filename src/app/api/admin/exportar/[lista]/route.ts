import { db } from '@/db/client'
import { getCsvExport } from '@/features/inbox/exports'
import { audit } from '@/lib/audit'
import { AuthError, requirePermission } from '@/lib/auth/session'
import { systemClock } from '@/lib/clock'
import { toIsoDate } from '@/lib/format'
import { requestLogger } from '@/lib/logger'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * Descarga CSV de una bandeja o del padrón. Cada descarga queda en la auditoría con quién la hizo y
 * cuántas filas llevaba (nunca los datos). Es un GET con la cookie de sesión: no cambia nada salvo la
 * auditoría, y la cookie es SameSite=Lax.
 */
export async function GET(request: Request, { params }: { params: Promise<{ lista: string }> }) {
  const { lista } = await params
  const csvExport = getCsvExport(lista)
  if (!csvExport) return new Response('No existe esa exportación.', { status: 404, headers: noStore })

  let user: Awaited<ReturnType<typeof requirePermission>>
  try {
    user = await requirePermission(csvExport.permission)
  } catch (error) {
    if (error instanceof AuthError) {
      return new Response(error.message, {
        status: error.reason === 'sin_sesion' ? 401 : 403,
        headers: noStore,
      })
    }
    throw error
  }

  try {
    const { csv, rows } = await csvExport.build()
    await db.transaction((tx) =>
      audit(tx, user, `${csvExport.entityType}.export`, {
        entityType: csvExport.entityType,
        summary: `Exportó ${rows} ${rows === 1 ? 'fila' : 'filas'} a CSV (${csvExport.filename})`,
        meta: { rows },
      }),
    )
    const filename = `${csvExport.filename}-${toIsoDate(systemClock.now())}.csv`
    return new Response(csv, {
      headers: {
        ...noStore,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    requestLogger(request.headers).error({ err: error, lista }, 'exportación CSV: falló')
    return new Response('No se pudo generar el archivo. Intenta de nuevo.', { status: 500, headers: noStore })
  }
}
