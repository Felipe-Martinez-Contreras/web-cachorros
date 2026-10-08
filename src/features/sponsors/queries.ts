import 'server-only'
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets, sponsors } from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { safeExternalUrl } from '@/lib/links'
import type { SponsorDTO } from './dto'

// La vigencia se compara con la fecha de hoy en Chile: un auspicio vencido se oculta solo (6.10).
const today = sql`(now() at time zone 'America/Santiago')::date`

/** Auspiciadores activos y vigentes, por nivel y orden. */
export async function getActiveSponsors(): Promise<SponsorDTO[]> {
  'use cache'
  cacheTag(tags.sponsors())
  cacheLife('hours')

  const rows = await db
    .select({
      id: sponsors.id,
      slug: sponsors.slug,
      name: sponsors.name,
      tier: sponsors.tier,
      websiteUrl: sponsors.websiteUrl,
      instagramUrl: sponsors.instagramUrl,
      whatsappE164: sponsors.whatsappE164,
      logo: {
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        lqip: mediaAssets.lqip,
        credit: mediaAssets.credit,
        focalX: mediaAssets.focalX,
        focalY: mediaAssets.focalY,
      },
    })
    .from(sponsors)
    .leftJoin(mediaAssets, eq(mediaAssets.id, sponsors.logoMediaId))
    .where(
      and(
        eq(sponsors.isActive, true),
        or(isNull(sponsors.startsOn), lte(sponsors.startsOn, today)),
        or(isNull(sponsors.endsOn), gte(sponsors.endsOn, today)),
      ),
    )
    .orderBy(asc(sponsors.tier), asc(sponsors.sortOrder), asc(sponsors.name))

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    tier: row.tier,
    logo: toImageDTO(row.logo),
    hasLink: Boolean(
      safeExternalUrl(row.websiteUrl) ?? safeExternalUrl(row.instagramUrl) ?? row.whatsappE164,
    ),
  }))
}
