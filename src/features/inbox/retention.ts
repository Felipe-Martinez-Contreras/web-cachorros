import 'server-only'
import { subMonths } from 'date-fns'
import { and, inArray, lt, ne } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLog, contactMessages, membershipRequests, sponsorshipInquiries } from '@/db/schema'

/** Plazo de conservación (especificación 9.6; `[DECIDIR]`, default 12 meses). */
export const RETENTION_MONTHS = 12

/** Lo que queda en una fila anonimizada: sin nombre, contacto, RUT, mensaje ni IP. */
export const ANONYMIZED_NAME = 'Datos eliminados'
export const ANONYMIZED_EMAIL = 'anonimizado@cachorros.invalid'

/** Una solicitud cerrada ya no espera respuesta: se puede anonimizar al cumplir el plazo. */
const CLOSED_STATUSES = ['aprobada', 'rechazada', 'archivada'] as const

export type RetentionResult = {
  membershipRequests: number
  sponsorshipInquiries: number
  contactMessages: number
  auditLog: number
}

/**
 * Tarea `daily` (especificación 9.6 y 12.8). Idempotente: una segunda pasada no encuentra nada.
 * - Solicitudes de socio y de auspicio cerradas hace más de 12 meses: se anonimizan (los conteos siguen).
 * - Mensajes de contacto de más de 12 meses: se eliminan.
 * - Auditoría de más de 12 meses: se elimina.
 * Los clics de auspiciadores no tienen datos personales: se conservan.
 */
export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const cutoff = subMonths(now, RETENTION_MONTHS)
  return db.transaction(async (tx) => {
    const requests = await tx
      .update(membershipRequests)
      .set({
        fullName: ANONYMIZED_NAME,
        email: ANONYMIZED_EMAIL,
        rut: null,
        phoneE164: null,
        commune: null,
        message: null,
        internalNotes: null,
        ipHash: null,
      })
      .where(
        and(
          inArray(membershipRequests.status, CLOSED_STATUSES),
          lt(membershipRequests.createdAt, cutoff),
          ne(membershipRequests.email, ANONYMIZED_EMAIL),
        ),
      )
      .returning({ id: membershipRequests.id })

    const inquiries = await tx
      .update(sponsorshipInquiries)
      .set({
        contactName: ANONYMIZED_NAME,
        email: ANONYMIZED_EMAIL,
        phoneE164: null,
        message: null,
        internalNotes: null,
        ipHash: null,
      })
      .where(
        and(
          inArray(sponsorshipInquiries.status, CLOSED_STATUSES),
          lt(sponsorshipInquiries.createdAt, cutoff),
          ne(sponsorshipInquiries.email, ANONYMIZED_EMAIL),
        ),
      )
      .returning({ id: sponsorshipInquiries.id })

    const messages = await tx
      .delete(contactMessages)
      .where(lt(contactMessages.createdAt, cutoff))
      .returning({ id: contactMessages.id })

    const audits = await tx
      .delete(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .returning({ id: auditLog.id })

    return {
      membershipRequests: requests.length,
      sponsorshipInquiries: inquiries.length,
      contactMessages: messages.length,
      auditLog: audits.length,
    }
  })
}
