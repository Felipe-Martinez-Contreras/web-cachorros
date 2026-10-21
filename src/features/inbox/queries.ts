import 'server-only'
import { and, desc, eq, type SQL } from 'drizzle-orm'
import { db } from '@/db/client'
import { contactMessages } from '@/db/schema'
import type { contactTopic, inboxStatus } from '@/db/schema/enums'

// Lecturas del panel: sin caché, siempre el estado actual.

type InboxStatus = (typeof inboxStatus.enumValues)[number]
type ContactTopic = (typeof contactTopic.enumValues)[number]

export async function listContactMessagesAdmin(filters: {
  status?: InboxStatus | null
  topic?: ContactTopic | null
}) {
  const conditions: SQL[] = []
  if (filters.status) conditions.push(eq(contactMessages.status, filters.status))
  if (filters.topic) conditions.push(eq(contactMessages.topic, filters.topic))
  return db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      topic: contactMessages.topic,
      status: contactMessages.status,
      message: contactMessages.message,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .where(and(...conditions))
    .orderBy(desc(contactMessages.createdAt))
    .limit(200)
}

export async function getContactMessageAdmin(id: string) {
  const [row] = await db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      phone: contactMessages.phoneE164,
      topic: contactMessages.topic,
      message: contactMessages.message,
      status: contactMessages.status,
      internalNotes: contactMessages.internalNotes,
      notifiedAt: contactMessages.notifiedAt,
      privacyConsentAt: contactMessages.privacyConsentAt,
      privacyPolicyVersion: contactMessages.privacyPolicyVersion,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .where(eq(contactMessages.id, id))
    .limit(1)
  return row ?? null
}
