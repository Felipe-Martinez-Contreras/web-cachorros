import 'server-only'
import { and, asc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { contactMessages, siteSettings } from '@/db/schema'
import type { NotifyRecipients } from '@/db/schema/system'
import { env } from '@/lib/env'
import { contactTopicLabels } from '@/lib/labels'
import { logger } from '@/lib/logger'
import { type MailMessage, sendMail } from '@/lib/mail'

/** Bandejas que avisan por correo al recibir un envío. */
export type InboxKind = 'contacto'

/** Después de esto se deja de reintentar: el envío sigue en la bandeja del panel, sin aviso. */
export const MAX_NOTIFY_ATTEMPTS = 5
/** Solo se reintenta lo reciente: un aviso de hace días ya no sirve. */
const RETRY_WINDOW_MS = 48 * 60 * 60 * 1000

type Mails = { staff: MailMessage; ack: MailMessage }

async function clubContact() {
  const [row] = await db
    .select({
      clubName: siteSettings.clubName,
      publicEmail: siteSettings.publicEmail,
      notifyRecipients: siteSettings.notifyRecipients,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return row ?? null
}

/** Destinatarios configurados para esa bandeja; si no hay, el correo público del club. */
function recipientsFor(
  club: { publicEmail: string | null; notifyRecipients: NotifyRecipients | null },
  key: keyof NotifyRecipients,
): string[] {
  const configured = (club.notifyRecipients?.[key] ?? []).filter((email) => email.includes('@'))
  if (configured.length > 0) return configured
  return club.publicEmail?.includes('@') ? [club.publicEmail] : []
}

const siteLink = (path: string) => new URL(path, env.SITE_URL).toString()

async function contactMails(id: string): Promise<Mails | null> {
  const [row] = await db
    .select({
      name: contactMessages.name,
      email: contactMessages.email,
      phone: contactMessages.phoneE164,
      topic: contactMessages.topic,
      message: contactMessages.message,
    })
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1)
  const club = await clubContact()
  if (!row || !club) return null
  const to = recipientsFor(club, 'contacto')
  if (to.length === 0) throw new Error('No hay destinatarios para la bandeja de contacto.')
  const topic = contactTopicLabels[row.topic]
  return {
    staff: {
      to,
      replyTo: row.email,
      subject: `Nuevo mensaje de contacto: ${topic}`,
      text: [
        `${row.name} escribió desde el sitio.`,
        '',
        `Tema: ${topic}`,
        `Correo: ${row.email}`,
        ...(row.phone ? [`Celular: ${row.phone}`] : []),
        '',
        row.message,
        '',
        `Respóndele contestando este correo o desde el panel: ${siteLink('/admin/mensajes')}`,
      ].join('\n'),
    },
    ack: {
      to: row.email,
      subject: `Recibimos tu mensaje · ${club.clubName}`,
      text: [
        `Hola, ${row.name}:`,
        '',
        `Recibimos tu mensaje sobre «${topic}». Te responderemos lo antes posible.`,
        '',
        'Si no lo enviaste tú, ignora este correo.',
        '',
        club.clubName,
      ].join('\n'),
    },
  }
}

const KINDS = {
  contacto: { table: contactMessages, mails: contactMails },
} as const satisfies Record<InboxKind, unknown>

/**
 * Avisa a la directiva y envía el acuse de recibo (especificación 2.5). Se llama con `after()`: nunca
 * bloquea la respuesta. Si el aviso falla, el envío queda guardado con `notified_at` vacío y la tarea `tick`
 * lo reintenta. El acuse va una sola vez, después del aviso: si falla, solo se registra.
 */
export async function notifySubmission(kind: InboxKind, id: string): Promise<boolean> {
  const { table, mails } = KINDS[kind]
  let built: Mails | null
  try {
    built = await mails(id)
    if (!built) return false
    await sendMail(built.staff)
  } catch (error) {
    const [row] = await db
      .update(table)
      .set({ notifyAttempts: sql`${table.notifyAttempts} + 1` })
      .where(eq(table.id, id))
      .returning({ attempts: table.notifyAttempts })
    const exhausted = (row?.attempts ?? 0) >= MAX_NOTIFY_ATTEMPTS
    logger.warn(
      { err: error, kind, id, attempts: row?.attempts, maxAttempts: MAX_NOTIFY_ATTEMPTS },
      exhausted
        ? 'aviso de formulario: se agotaron los reintentos'
        : 'aviso de formulario: falló, se reintentará',
    )
    return false
  }
  await db
    .update(table)
    .set({ notifiedAt: new Date(), notifyAttempts: sql`${table.notifyAttempts} + 1` })
    .where(eq(table.id, id))
  try {
    await sendMail(built.ack)
  } catch (error) {
    logger.warn({ err: error, kind, id }, 'acuse de recibo: no se pudo enviar')
  }
  return true
}

/** Tarea `tick`: reintenta los avisos pendientes recientes, del más antiguo al más nuevo. */
export async function retryPendingNotifications(now = new Date()): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (const kind of Object.keys(KINDS) as InboxKind[]) {
    const { table } = KINDS[kind]
    const pending = await db
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          isNull(table.notifiedAt),
          lt(table.notifyAttempts, MAX_NOTIFY_ATTEMPTS),
          gt(table.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)),
        ),
      )
      .orderBy(asc(table.createdAt))
      .limit(20)
    for (const { id } of pending) {
      if (await notifySubmission(kind, id)) sent++
      else failed++
    }
  }
  return { sent, failed }
}
