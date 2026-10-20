import 'server-only'
import { and, asc, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { members, membershipPlans, membershipRequests } from '@/db/schema'
import type { feePeriod, inboxStatus, memberStatus } from '@/db/schema/enums'
import { tags } from '@/lib/cache-tags'

export type FeePeriod = (typeof feePeriod.enumValues)[number]
export type InboxStatus = (typeof inboxStatus.enumValues)[number]
export type MemberStatus = (typeof memberStatus.enumValues)[number]

export type MembershipPlanDTO = {
  id: string
  name: string
  feeClp: number
  feePeriod: FeePeriod
  benefits: string[]
}

/** Planes vigentes para la página Hazte socio y su formulario. Se invalida con el tag `membership`. */
export async function getMembershipPlans(): Promise<MembershipPlanDTO[]> {
  'use cache'
  cacheTag(tags.membership())
  cacheLife('hours')

  const rows = await db
    .select({
      id: membershipPlans.id,
      name: membershipPlans.name,
      feeClp: membershipPlans.feeClp,
      feePeriod: membershipPlans.feePeriod,
      benefits: membershipPlans.benefits,
    })
    .from(membershipPlans)
    .where(eq(membershipPlans.isActive, true))
    .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name))
  return rows.map((row) => ({ ...row, benefits: row.benefits ?? [] }))
}

// Lecturas del panel: sin caché, siempre el estado actual.

export function listPlansAdmin() {
  return db
    .select({
      id: membershipPlans.id,
      name: membershipPlans.name,
      feeClp: membershipPlans.feeClp,
      feePeriod: membershipPlans.feePeriod,
      benefits: membershipPlans.benefits,
      isActive: membershipPlans.isActive,
      sortOrder: membershipPlans.sortOrder,
    })
    .from(membershipPlans)
    .orderBy(asc(membershipPlans.sortOrder), asc(membershipPlans.name))
}
export type PlanAdminRow = Awaited<ReturnType<typeof listPlansAdmin>>[number]

export async function getPlanAdmin(id: string): Promise<PlanAdminRow | null> {
  const rows = await listPlansAdmin()
  return rows.find((row) => row.id === id) ?? null
}

/** Todos los planes (también los inactivos) para los `<select>` del panel. */
export async function planOptions() {
  const rows = await listPlansAdmin()
  return rows.map((row) => ({ value: row.id, label: row.isActive ? row.name : `${row.name} (inactivo)` }))
}

export async function listMembershipRequestsAdmin(filters: { status?: InboxStatus | null }) {
  return db
    .select({
      id: membershipRequests.id,
      fullName: membershipRequests.fullName,
      commune: membershipRequests.commune,
      status: membershipRequests.status,
      createdAt: membershipRequests.createdAt,
      notifiedAt: membershipRequests.notifiedAt,
      planName: membershipPlans.name,
    })
    .from(membershipRequests)
    .leftJoin(membershipPlans, eq(membershipPlans.id, membershipRequests.planId))
    .where(filters.status ? eq(membershipRequests.status, filters.status) : undefined)
    .orderBy(desc(membershipRequests.createdAt))
    .limit(200)
}

export async function getMembershipRequestAdmin(id: string) {
  const [row] = await db
    .select({
      id: membershipRequests.id,
      fullName: membershipRequests.fullName,
      rut: membershipRequests.rut,
      email: membershipRequests.email,
      phone: membershipRequests.phoneE164,
      commune: membershipRequests.commune,
      message: membershipRequests.message,
      marketingConsent: membershipRequests.marketingConsent,
      privacyConsentAt: membershipRequests.privacyConsentAt,
      privacyPolicyVersion: membershipRequests.privacyPolicyVersion,
      status: membershipRequests.status,
      internalNotes: membershipRequests.internalNotes,
      notifiedAt: membershipRequests.notifiedAt,
      createdAt: membershipRequests.createdAt,
      planName: membershipPlans.name,
      memberId: membershipRequests.memberId,
      memberNumber: members.memberNumber,
    })
    .from(membershipRequests)
    .leftJoin(membershipPlans, eq(membershipPlans.id, membershipRequests.planId))
    .leftJoin(members, eq(members.id, membershipRequests.memberId))
    .where(eq(membershipRequests.id, id))
    .limit(1)
  return row ?? null
}

export async function listMembersAdmin(filters: { q?: string; status?: MemberStatus | null }) {
  const term = filters.q?.trim()
  const conditions: SQL[] = []
  if (filters.status) conditions.push(eq(members.status, filters.status))
  if (term) {
    const like = `%${term}%`
    const byText = or(ilike(members.fullName, like), ilike(members.rut, like), ilike(members.email, like))
    if (byText) conditions.push(byText)
  }
  return db
    .select({
      id: members.id,
      memberNumber: members.memberNumber,
      fullName: members.fullName,
      rut: members.rut,
      email: members.email,
      phone: members.phoneE164,
      status: members.status,
      joinedOn: members.joinedOn,
      planName: membershipPlans.name,
    })
    .from(members)
    .leftJoin(membershipPlans, eq(membershipPlans.id, members.planId))
    .where(and(...conditions))
    .orderBy(asc(members.memberNumber))
}
export type MemberAdminRow = Awaited<ReturnType<typeof listMembersAdmin>>[number]

export async function getMemberAdmin(id: string) {
  const [row] = await db
    .select({
      id: members.id,
      memberNumber: members.memberNumber,
      fullName: members.fullName,
      rut: members.rut,
      email: members.email,
      phone: members.phoneE164,
      planId: members.planId,
      status: members.status,
      joinedOn: members.joinedOn,
    })
    .from(members)
    .where(eq(members.id, id))
    .limit(1)
  return row ?? null
}
