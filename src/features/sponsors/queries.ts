import 'server-only'
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets, sponsors } from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import type { SponsorDTO } from './dto'
import { SPONSOR_LINKS, sponsorTargets } from './lib/links'

// La vigencia se compara con la fecha de hoy en Chile: un auspicio vencido se oculta solo (6.10).
export const sponsorToday = sql`(now() at time zone 'America/Santiago')::date`

/** Activo y dentro de su vigencia: la misma regla para la vitrina y para el contador de clics. */
export const isSponsorVisible = () =>
  and(
    eq(sponsors.isActive, true),
    or(isNull(sponsors.startsOn), lte(sponsors.startsOn, sponsorToday)),
    or(isNull(sponsors.endsOn), gte(sponsors.endsOn, sponsorToday)),
  )

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
      description: sponsors.description,
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
    .where(isSponsorVisible())
    .orderBy(asc(sponsors.tier), asc(sponsors.sortOrder), asc(sponsors.name))

  return rows.map((row) => {
    const targets = sponsorTargets(row)
    const links = SPONSOR_LINKS.filter((link) => targets[link])
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tier: row.tier,
      description: row.description,
      logo: toImageDTO(row.logo),
      links,
      hasLink: links.length > 0,
    }
  })
}
