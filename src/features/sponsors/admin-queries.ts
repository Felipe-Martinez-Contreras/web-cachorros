import 'server-only'
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, sponsorClicksDaily, sponsors, sponsorshipInquiries } from '@/db/schema'
import type { inboxStatus } from '@/db/schema/enums'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

type InboxStatus = (typeof inboxStatus.enumValues)[number]

export async function listSponsorsAdmin() {
  const rows = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      slug: sponsors.slug,
      tier: sponsors.tier,
      description: sponsors.description,
      websiteUrl: sponsors.websiteUrl,
      instagramUrl: sponsors.instagramUrl,
      whatsappE164: sponsors.whatsappE164,
      startsOn: sponsors.startsOn,
      endsOn: sponsors.endsOn,
      isActive: sponsors.isActive,
      sortOrder: sponsors.sortOrder,
      logoId: mediaAssets.id,
      logoVariants: mediaAssets.variants,
      logoAlt: mediaAssets.altText,
      logoMinors: mediaAssets.containsMinors,
    })
    .from(sponsors)
    .leftJoin(mediaAssets, eq(mediaAssets.id, sponsors.logoMediaId))
    .orderBy(asc(sponsors.tier), asc(sponsors.sortOrder), asc(sponsors.name))
  return rows.map(({ logoId, logoVariants, logoAlt, logoMinors, ...row }) => ({
    ...row,
    logo: logoId
      ? toMediaThumbDTO({
          id: logoId,
          variants: logoVariants,
          altText: logoAlt,
          containsMinors: logoMinors ?? false,
        })
      : (null as MediaThumbDTO | null),
  }))
}
export type SponsorAdminRow = Awaited<ReturnType<typeof listSponsorsAdmin>>[number]

export async function getSponsorAdmin(id: string): Promise<SponsorAdminRow | null> {
  const rows = await listSponsorsAdmin()
  return rows.find((row) => row.id === id) ?? null
}

export function listSponsorshipInquiriesAdmin(filters: { status?: InboxStatus | null }) {
  return db
    .select({
      id: sponsorshipInquiries.id,
      businessName: sponsorshipInquiries.businessName,
      contactName: sponsorshipInquiries.contactName,
      tierInterest: sponsorshipInquiries.tierInterest,
      status: sponsorshipInquiries.status,
      createdAt: sponsorshipInquiries.createdAt,
    })
    .from(sponsorshipInquiries)
    .where(filters.status ? eq(sponsorshipInquiries.status, filters.status) : undefined)
    .orderBy(desc(sponsorshipInquiries.createdAt))
    .limit(200)
}

export async function getSponsorshipInquiryAdmin(id: string) {
  const [row] = await db
    .select({
      id: sponsorshipInquiries.id,
      businessName: sponsorshipInquiries.businessName,
      contactName: sponsorshipInquiries.contactName,
      email: sponsorshipInquiries.email,
      phone: sponsorshipInquiries.phoneE164,
      tierInterest: sponsorshipInquiries.tierInterest,
      message: sponsorshipInquiries.message,
      status: sponsorshipInquiries.status,
      internalNotes: sponsorshipInquiries.internalNotes,
      notifiedAt: sponsorshipInquiries.notifiedAt,
      privacyConsentAt: sponsorshipInquiries.privacyConsentAt,
      privacyPolicyVersion: sponsorshipInquiries.privacyPolicyVersion,
      createdAt: sponsorshipInquiries.createdAt,
    })
    .from(sponsorshipInquiries)
    .where(eq(sponsorshipInquiries.id, id))
    .limit(1)
  return row ?? null
}

export type ClicksReport = {
  month: string
  total: number
  sponsors: { id: string; name: string; total: number; days: { day: string; clicks: number }[] }[]
}

/** Clics de un mes (`AAAA-MM`) por auspiciador y por día, para entregarle su reporte (especificación 6.10). */
export async function getClicksReport(month: string): Promise<ClicksReport> {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const first = `${month}-01`
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const last = `${month}-${String(lastDay).padStart(2, '0')}`
  const rows = await db
    .select({
      id: sponsors.id,
      name: sponsors.name,
      day: sponsorClicksDaily.day,
      clicks: sponsorClicksDaily.clicks,
    })
    .from(sponsorClicksDaily)
    .innerJoin(sponsors, eq(sponsors.id, sponsorClicksDaily.sponsorId))
    .where(and(gte(sponsorClicksDaily.day, first), lte(sponsorClicksDaily.day, last)))
    .orderBy(asc(sponsors.name), asc(sponsorClicksDaily.day))

  const bySponsor = new Map<string, ClicksReport['sponsors'][number]>()
  for (const row of rows) {
    const entry = bySponsor.get(row.id) ?? { id: row.id, name: row.name, total: 0, days: [] }
    entry.total += row.clicks
    entry.days.push({ day: row.day, clicks: row.clicks })
    bySponsor.set(row.id, entry)
  }
  const list = [...bySponsor.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'))
  return { month, total: list.reduce((sum, entry) => sum + entry.total, 0), sponsors: list }
}
