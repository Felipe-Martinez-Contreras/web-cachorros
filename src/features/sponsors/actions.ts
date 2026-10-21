'use server'

import { eq } from 'drizzle-orm'
import { sponsors, sponsorshipInquiries } from '@/db/schema'
import { inboxUpdateSchema, SPONSORSHIP_STATUSES } from '@/features/inbox/schemas'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { sponsorSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>
type SponsorData = z.output<typeof sponsorSchema>

const nothing = z.unknown()

const sponsorValues = ({ whatsapp, ...data }: SponsorData) => ({ ...data, whatsappE164: whatsapp })

export async function crearAuspiciador(input: unknown): Result {
  return mutate({
    action: 'sponsor.create',
    permission: 'sponsors:write',
    entityType: 'sponsor',
    schema: sponsorSchema,
    input,
    tags: [tags.sponsors()],
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.logoMediaId, 'logoMediaId')
      const slug = await resolveSlug(tx, sponsors, data.name)
      const [row] = await tx
        .insert(sponsors)
        .values({ ...sponsorValues(data), slug })
        .returning({ id: sponsors.id })
      if (!row) throw new Error('El auspiciador no se creó.')
      return { id: row.id, summary: `Creó el auspiciador ${data.name}`, meta: { tier: data.tier, slug } }
    },
  })
}

export async function actualizarAuspiciador(id: string, input: unknown): Result {
  return mutate({
    action: 'sponsor.update',
    permission: 'sponsors:write',
    entityType: 'sponsor',
    schema: sponsorSchema,
    input,
    tags: [tags.sponsors()],
    write: async (tx, data) => {
      const sponsorId = assertId(id, 'No encontramos ese auspiciador.')
      await assertPublishableMedia(tx, data.logoMediaId, 'logoMediaId')
      // El slug no cambia al renombrar: es el enlace que cuenta los clics y puede estar ya compartido.
      const [row] = await tx
        .update(sponsors)
        .set(sponsorValues(data))
        .where(eq(sponsors.id, sponsorId))
        .returning({ id: sponsors.id })
      if (!row) throw new Rejection('No encontramos ese auspiciador. Puede que lo hayan eliminado.')
      return { id: sponsorId, summary: `Editó el auspiciador ${data.name}`, meta: { tier: data.tier } }
    },
  })
}

export async function eliminarAuspiciador(id: string): Result {
  return mutate({
    action: 'sponsor.delete',
    permission: 'sponsors:write',
    entityType: 'sponsor',
    schema: nothing,
    input: null,
    tags: [tags.sponsors()],
    write: async (tx) => {
      const sponsorId = assertId(id, 'No encontramos ese auspiciador.')
      // Sus clics se borran con él (ON DELETE CASCADE): para conservar el historial, desactívalo.
      const [row] = await tx
        .delete(sponsors)
        .where(eq(sponsors.id, sponsorId))
        .returning({ name: sponsors.name })
      if (!row) throw new Rejection('No encontramos ese auspiciador. Puede que ya lo hayan eliminado.')
      return { id: sponsorId, summary: `Eliminó el auspiciador ${row.name}` }
    },
  })
}

export async function actualizarSolicitudAuspicio(id: string, input: unknown): Result {
  return mutate({
    action: 'sponsorship_inquiry.update',
    permission: 'sponsors:write',
    entityType: 'sponsorship_inquiry',
    schema: inboxUpdateSchema(SPONSORSHIP_STATUSES),
    input,
    tags: [],
    write: async (tx, data) => {
      const inquiryId = assertId(id, 'No encontramos esa solicitud.')
      const [row] = await tx
        .update(sponsorshipInquiries)
        .set(data)
        .where(eq(sponsorshipInquiries.id, inquiryId))
        .returning({ id: sponsorshipInquiries.id })
      if (!row) throw new Rejection('No encontramos esa solicitud. Puede que la hayan eliminado.')
      return { id: inquiryId, summary: 'Actualizó una solicitud de auspicio', meta: { status: data.status } }
    },
  })
}
