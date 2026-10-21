import 'server-only'
import { eq, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { db, type Tx } from '@/db/client'
import { contactMessages, members, membershipRequests, sponsorshipInquiries } from '@/db/schema'
import type { PersonIdentifier } from './lib/identifier'

type Columns = { email: PgColumn; phone: PgColumn; rut?: PgColumn }

/** La condición de cada tabla según cómo se busca a la persona; `null` si esa tabla no guarda ese dato. */
function matching(columns: Columns, who: PersonIdentifier): SQL | null {
  if (who.kind === 'email') return eq(columns.email, who.value)
  if (who.kind === 'phone') return eq(columns.phone, who.value)
  return columns.rut ? eq(columns.rut, who.value) : null
}

/** Dónde puede haber datos de una persona (especificación 9.6). */
export const PERSONAL_DATA_SOURCES = {
  membershipRequests: {
    label: 'Solicitudes de socio',
    table: membershipRequests,
    columns: {
      email: membershipRequests.email,
      phone: membershipRequests.phoneE164,
      rut: membershipRequests.rut,
    },
  },
  members: {
    label: 'Padrón de socios',
    table: members,
    columns: { email: members.email, phone: members.phoneE164, rut: members.rut },
  },
  sponsorshipInquiries: {
    label: 'Solicitudes de auspicio',
    table: sponsorshipInquiries,
    columns: { email: sponsorshipInquiries.email, phone: sponsorshipInquiries.phoneE164 },
  },
  contactMessages: {
    label: 'Mensajes de contacto',
    table: contactMessages,
    columns: { email: contactMessages.email, phone: contactMessages.phoneE164 },
  },
} as const

export type PersonalDataSource = keyof typeof PERSONAL_DATA_SOURCES

export const personalDataCondition = (source: PersonalDataSource, who: PersonIdentifier) =>
  matching(PERSONAL_DATA_SOURCES[source].columns, who)

/** Todas las filas de la persona, completas: es lo que se entrega al exportar (derecho de acceso). */
export async function findPersonalData(who: PersonIdentifier, tx: Tx | typeof db = db) {
  const out = {} as Record<PersonalDataSource, Record<string, unknown>[]>
  for (const source of Object.keys(PERSONAL_DATA_SOURCES) as PersonalDataSource[]) {
    const condition = personalDataCondition(source, who)
    out[source] = condition
      ? ((await tx.select().from(PERSONAL_DATA_SOURCES[source].table).where(condition)) as Record<
          string,
          unknown
        >[])
      : []
  }
  return out
}

export type PersonalDataSummary = {
  kind: PersonIdentifier['kind']
  total: number
  sources: { source: PersonalDataSource; label: string; count: number }[]
}

export function summarize(
  who: PersonIdentifier,
  found: Record<PersonalDataSource, unknown[]>,
): PersonalDataSummary {
  const sources = (Object.keys(PERSONAL_DATA_SOURCES) as PersonalDataSource[]).map((source) => ({
    source,
    label: PERSONAL_DATA_SOURCES[source].label,
    count: found[source].length,
  }))
  return { kind: who.kind, total: sources.reduce((sum, entry) => sum + entry.count, 0), sources }
}
