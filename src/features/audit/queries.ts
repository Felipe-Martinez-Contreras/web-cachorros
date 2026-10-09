import 'server-only'
import { and, asc, count, desc, eq, gte, isNull, lt } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLog, user } from '@/db/schema'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { toIsoDate } from '@/lib/format'

// «Actividad» del panel (especificación 7.6): solo lectura, sin caché.

export const AUDIT_PAGE_SIZE = 50

/** Valor del filtro de persona para lo que hizo el sistema (tareas programadas, consola). */
export const SYSTEM_ACTOR = 'sistema'

export type AuditFilters = {
  userId?: string | null
  entityType?: string | null
  /** Días de calendario en Santiago (`AAAA-MM-DD`), ambos incluidos. */
  from?: string | null
  to?: string | null
  page?: number
}

function nextDay(isoDate: string): Date {
  const start = santiagoWallTime(isoDate, '00:00')
  // 26 horas después y de vuelta a la medianoche: correcto también en los cambios de horario.
  return santiagoWallTime(toIsoDate(new Date(start.getTime() + 26 * 3600_000)), '00:00')
}

export async function listAuditLog(filters: AuditFilters) {
  const where = and(
    filters.userId === SYSTEM_ACTOR
      ? isNull(auditLog.userId)
      : filters.userId
        ? eq(auditLog.userId, filters.userId)
        : undefined,
    filters.entityType ? eq(auditLog.entityType, filters.entityType) : undefined,
    filters.from ? gte(auditLog.createdAt, santiagoWallTime(filters.from, '00:00')) : undefined,
    filters.to ? lt(auditLog.createdAt, nextDay(filters.to)) : undefined,
  )
  const [totals] = await db.select({ total: count() }).from(auditLog).where(where)
  const total = totals?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE))
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages)

  const items = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
      userName: user.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.userId))
    .where(where)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE)
    .offset((page - 1) * AUDIT_PAGE_SIZE)
  return { items, page, totalPages, total }
}

/** Personas y tipos que aparecen en la auditoría, para los filtros. */
export async function auditFilterOptions() {
  const [people, types] = await Promise.all([
    db.select({ value: user.id, label: user.name }).from(user).orderBy(asc(user.name)),
    db.selectDistinct({ entityType: auditLog.entityType }).from(auditLog).orderBy(asc(auditLog.entityType)),
  ])
  return {
    people,
    entityTypes: types.flatMap((row) => (row.entityType ? [row.entityType] : [])),
  }
}
