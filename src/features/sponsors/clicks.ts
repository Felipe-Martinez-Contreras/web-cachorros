import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { sponsorClicksDaily, sponsors } from '@/db/schema'
import { resolveSponsorTarget } from './lib/links'
import { isSponsorVisible, sponsorToday } from './queries'

/** Destino del enlace de un auspiciador visible; `null` si no existe, venció o no tiene ese enlace. */
export async function findSponsorTarget(
  slug: string,
  requested: string | null,
): Promise<{ id: string; target: string } | null> {
  const [row] = await db
    .select({
      id: sponsors.id,
      websiteUrl: sponsors.websiteUrl,
      instagramUrl: sponsors.instagramUrl,
      whatsappE164: sponsors.whatsappE164,
    })
    .from(sponsors)
    .where(and(eq(sponsors.slug, slug), isSponsorVisible()))
    .limit(1)
  if (!row) return null
  const target = resolveSponsorTarget(row, requested)
  return target ? { id: row.id, target } : null
}

/** Suma un clic al día de hoy (en Chile) en una sola sentencia: sin carreras ni datos personales. */
export async function recordSponsorClick(sponsorId: string): Promise<void> {
  await db
    .insert(sponsorClicksDaily)
    .values({ sponsorId, day: sql`${sponsorToday}`, clicks: 1 })
    .onConflictDoUpdate({
      target: [sponsorClicksDaily.sponsorId, sponsorClicksDaily.day],
      set: { clicks: sql`${sponsorClicksDaily.clicks} + 1` },
    })
}
