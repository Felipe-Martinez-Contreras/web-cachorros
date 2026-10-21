'use server'

import { eq, max, sql } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { members, membershipPlans, membershipRequests } from '@/db/schema'
import { APPROVED_STATUSES, inboxUpdateSchema, MEMBERSHIP_STATUSES } from '@/features/inbox/schemas'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { systemClock } from '@/lib/clock'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { toIsoDate } from '@/lib/format'
import { z } from '@/lib/zod'
import { memberSchema, newMemberSchema, planSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

const nothing = z.unknown()

// ── Planes ─────────────────────────────────────────────────────────────────────────────────────────

export async function crearPlan(input: unknown): Result {
  return mutate({
    action: 'membership_plan.create',
    permission: 'members:write',
    entityType: 'membership_plan',
    schema: planSchema,
    input,
    tags: [tags.membership()],
    write: async (tx, data) => {
      const [row] = await tx.insert(membershipPlans).values(data).returning({ id: membershipPlans.id })
      if (!row) throw new Error('El plan no se creó.')
      return { id: row.id, summary: `Creó el plan de socio ${data.name}`, meta: data }
    },
  })
}

export async function actualizarPlan(id: string, input: unknown): Result {
  return mutate({
    action: 'membership_plan.update',
    permission: 'members:write',
    entityType: 'membership_plan',
    schema: planSchema,
    input,
    tags: [tags.membership()],
    write: async (tx, data) => {
      const planId = assertId(id, 'No encontramos ese plan.')
      const [row] = await tx
        .update(membershipPlans)
        .set(data)
        .where(eq(membershipPlans.id, planId))
        .returning({ id: membershipPlans.id })
      if (!row) throw new Rejection('No encontramos ese plan. Puede que lo hayan eliminado.')
      return { id: planId, summary: `Editó el plan de socio ${data.name}`, meta: data }
    },
  })
}

export async function eliminarPlan(id: string): Result {
  return mutate({
    action: 'membership_plan.delete',
    permission: 'members:write',
    entityType: 'membership_plan',
    schema: nothing,
    input: null,
    tags: [tags.membership()],
    write: async (tx) => {
      const planId = assertId(id, 'No encontramos ese plan.')
      // Si hay socios o solicitudes con este plan, la BD lo impide (ON DELETE RESTRICT).
      const [row] = await tx
        .delete(membershipPlans)
        .where(eq(membershipPlans.id, planId))
        .returning({ name: membershipPlans.name })
      if (!row) throw new Rejection('No encontramos ese plan. Puede que ya lo hayan eliminado.')
      return { id: planId, summary: `Eliminó el plan de socio ${row.name}` }
    },
  })
}

// ── Padrón ─────────────────────────────────────────────────────────────────────────────────────────

const memberConstraints = {
  members_member_number_uq: { message: 'Ese número de socio ya está ocupado.', field: 'memberNumber' },
}

/**
 * Número de socio correlativo. El bloqueo de la transacción ordena las altas simultáneas: la segunda espera
 * a que la primera termine y toma el número siguiente. El índice único es la segunda barrera.
 */
async function nextMemberNumber(tx: Tx): Promise<number> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('members.member_number'))`)
  const [row] = await tx.select({ last: max(members.memberNumber) }).from(members)
  return (row?.last ?? 0) + 1
}

// La auditoría registra el número de socio, nunca el nombre, el RUT ni el contacto (especificación 7.6).
const memberMeta = (data: { planId: string | null; status: string }, memberNumber: number) => ({
  memberNumber,
  planId: data.planId,
  status: data.status,
})

export async function crearSocio(input: unknown): Result {
  return mutate({
    action: 'member.create',
    permission: 'members:write',
    entityType: 'member',
    schema: newMemberSchema,
    input,
    tags: [],
    constraints: memberConstraints,
    write: async (tx, { memberNumber, phone, ...data }) => {
      const number = memberNumber ?? (await nextMemberNumber(tx))
      const [row] = await tx
        .insert(members)
        .values({ ...data, phoneE164: phone, memberNumber: number })
        .returning({ id: members.id })
      if (!row) throw new Error('El socio no se creó.')
      return { id: row.id, summary: `Dio de alta al socio N.º ${number}`, meta: memberMeta(data, number) }
    },
  })
}

export async function actualizarSocio(id: string, input: unknown): Result {
  return mutate({
    action: 'member.update',
    permission: 'members:write',
    entityType: 'member',
    schema: memberSchema,
    input,
    tags: [],
    write: async (tx, { phone, ...data }) => {
      const memberId = assertId(id, 'No encontramos ese socio.')
      // El número no se edita: identifica al socio en actas, cuotas y el carnet futuro.
      const [row] = await tx
        .update(members)
        .set({ ...data, phoneE164: phone })
        .where(eq(members.id, memberId))
        .returning({ memberNumber: members.memberNumber })
      if (!row) throw new Rejection('No encontramos ese socio. Puede que lo hayan eliminado.')
      return {
        id: memberId,
        summary: `Editó al socio N.º ${row.memberNumber}`,
        meta: memberMeta(data, row.memberNumber),
      }
    },
  })
}

// ── Solicitudes ────────────────────────────────────────────────────────────────────────────────────

export async function actualizarSolicitudSocio(id: string, input: unknown): Result {
  return mutate({
    action: 'membership_request.update',
    permission: 'members:write',
    entityType: 'membership_request',
    schema: inboxUpdateSchema(MEMBERSHIP_STATUSES),
    input,
    tags: [],
    write: async (tx, data, user) => {
      const requestId = assertId(id, 'No encontramos esa solicitud.')
      const [current] = await tx
        .select({ memberId: membershipRequests.memberId })
        .from(membershipRequests)
        .where(eq(membershipRequests.id, requestId))
        .for('update')
      if (!current) throw new Rejection('No encontramos esa solicitud. Puede que la hayan eliminado.')
      const approved = current.memberId !== null
      if (approved && !(APPROVED_STATUSES as readonly string[]).includes(data.status)) {
        throw new Rejection('Esta solicitud ya está aprobada: solo se puede archivar.', 'status')
      }
      if (!approved && data.status === 'aprobada') {
        throw new Rejection(
          'Para aprobarla usa «Aprobar y dar de alta»: así el socio entra al padrón.',
          'status',
        )
      }
      await tx
        .update(membershipRequests)
        .set({ ...data, handledBy: user.id })
        .where(eq(membershipRequests.id, requestId))
      return {
        id: requestId,
        summary: 'Actualizó una solicitud de socio',
        meta: { status: data.status },
      }
    },
  })
}

/**
 * Aprueba una solicitud y da de alta al socio en el padrón con el número correlativo siguiente, en una
 * sola transacción. La fila de la solicitud queda bloqueada: dos aprobaciones a la vez no crean dos socios.
 */
export async function aprobarSolicitudSocio(id: string): Result {
  return mutate({
    action: 'membership_request.approve',
    permission: 'members:write',
    entityType: 'membership_request',
    schema: nothing,
    input: null,
    tags: [],
    write: async (tx, _data, user) => {
      const requestId = assertId(id, 'No encontramos esa solicitud.')
      const [request] = await tx
        .select({
          fullName: membershipRequests.fullName,
          rut: membershipRequests.rut,
          email: membershipRequests.email,
          phoneE164: membershipRequests.phoneE164,
          planId: membershipRequests.planId,
          memberId: membershipRequests.memberId,
        })
        .from(membershipRequests)
        .where(eq(membershipRequests.id, requestId))
        .for('update')
      if (!request) throw new Rejection('No encontramos esa solicitud. Puede que la hayan eliminado.')
      if (request.memberId) throw new Rejection('Esta solicitud ya fue aprobada.')

      const number = await nextMemberNumber(tx)
      const [member] = await tx
        .insert(members)
        .values({
          memberNumber: number,
          fullName: request.fullName,
          rut: request.rut,
          email: request.email,
          phoneE164: request.phoneE164,
          planId: request.planId,
          joinedOn: toIsoDate(systemClock.now()),
        })
        .returning({ id: members.id })
      if (!member) throw new Error('El socio no se creó.')
      await tx
        .update(membershipRequests)
        .set({ status: 'aprobada', memberId: member.id, handledBy: user.id })
        .where(eq(membershipRequests.id, requestId))
      return {
        id: requestId,
        summary: `Aprobó una solicitud y dio de alta al socio N.º ${number}`,
        meta: { memberNumber: number, memberId: member.id, planId: request.planId },
      }
    },
  })
}
