import 'server-only'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { contactMessages, members, membershipPlans, membershipRequests } from '@/db/schema'
import { type CsvColumn, toCsv } from '@/lib/csv'
import { formatLongDateTime } from '@/lib/format'
import { contactTopicLabels, inboxStatusLabels, memberStatusLabels } from '@/lib/labels'
import type { Permission } from '@/lib/permissions'

type CsvExport = {
  permission: Permission
  /** Nombre del archivo, sin la fecha ni la extensión. */
  filename: string
  /** Lo que queda en la auditoría: el conteo de filas, nunca los datos. */
  entityType: string
  build: () => Promise<{ csv: string; rows: number }>
}

async function csvOf<T>(rows: Promise<T[]>, columns: CsvColumn<T>[]) {
  const list = await rows
  return { csv: toCsv(list, columns), rows: list.length }
}

/** Exportaciones CSV del panel (especificación 7.4), por su nombre en `/api/admin/exportar/[lista]`. */
const EXPORTS: Record<string, CsvExport> = {
  padron: {
    permission: 'members:write',
    filename: 'padron-de-socios',
    entityType: 'member',
    build: () =>
      csvOf(
        db
          .select({
            memberNumber: members.memberNumber,
            fullName: members.fullName,
            rut: members.rut,
            email: members.email,
            phone: members.phoneE164,
            plan: membershipPlans.name,
            status: members.status,
            joinedOn: members.joinedOn,
          })
          .from(members)
          .leftJoin(membershipPlans, eq(membershipPlans.id, members.planId))
          .orderBy(asc(members.memberNumber)),
        [
          { header: 'N.º', value: (row) => row.memberNumber },
          { header: 'Nombre', value: (row) => row.fullName },
          { header: 'RUT', value: (row) => row.rut },
          { header: 'Correo', value: (row) => row.email },
          { header: 'Celular', value: (row) => row.phone },
          { header: 'Plan', value: (row) => row.plan },
          { header: 'Estado', value: (row) => memberStatusLabels[row.status] },
          { header: 'Ingreso', value: (row) => row.joinedOn },
        ],
      ),
  },
  'solicitudes-socio': {
    permission: 'members:write',
    filename: 'solicitudes-de-socio',
    entityType: 'membership_request',
    build: () =>
      csvOf(
        db
          .select({
            createdAt: membershipRequests.createdAt,
            fullName: membershipRequests.fullName,
            rut: membershipRequests.rut,
            email: membershipRequests.email,
            phone: membershipRequests.phoneE164,
            commune: membershipRequests.commune,
            plan: membershipPlans.name,
            status: membershipRequests.status,
            marketing: membershipRequests.marketingConsent,
          })
          .from(membershipRequests)
          .leftJoin(membershipPlans, eq(membershipPlans.id, membershipRequests.planId))
          .orderBy(desc(membershipRequests.createdAt)),
        [
          { header: 'Recibida', value: (row) => formatLongDateTime(row.createdAt) },
          { header: 'Nombre', value: (row) => row.fullName },
          { header: 'RUT', value: (row) => row.rut },
          { header: 'Correo', value: (row) => row.email },
          { header: 'Celular', value: (row) => row.phone },
          { header: 'Comuna', value: (row) => row.commune },
          { header: 'Plan', value: (row) => row.plan },
          { header: 'Estado', value: (row) => inboxStatusLabels[row.status] },
          { header: 'Acepta comunicaciones', value: (row) => (row.marketing ? 'Sí' : 'No') },
        ],
      ),
  },
  mensajes: {
    permission: 'messages:write',
    filename: 'mensajes-de-contacto',
    entityType: 'contact_message',
    build: () =>
      csvOf(
        db
          .select({
            createdAt: contactMessages.createdAt,
            name: contactMessages.name,
            email: contactMessages.email,
            phone: contactMessages.phoneE164,
            topic: contactMessages.topic,
            status: contactMessages.status,
            message: contactMessages.message,
          })
          .from(contactMessages)
          .orderBy(desc(contactMessages.createdAt)),
        [
          { header: 'Recibido', value: (row) => formatLongDateTime(row.createdAt) },
          { header: 'Nombre', value: (row) => row.name },
          { header: 'Correo', value: (row) => row.email },
          { header: 'Celular', value: (row) => row.phone },
          { header: 'Tema', value: (row) => contactTopicLabels[row.topic] },
          { header: 'Estado', value: (row) => inboxStatusLabels[row.status] },
          { header: 'Mensaje', value: (row) => row.message },
        ],
      ),
  },
}

export function getCsvExport(name: string): CsvExport | null {
  return Object.hasOwn(EXPORTS, name) ? (EXPORTS[name] ?? null) : null
}
