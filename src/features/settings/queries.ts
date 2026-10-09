import 'server-only'
import { eq, inArray } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { mediaAssets, siteSettings, teams } from '@/db/schema'
import type { SocialLinkDTO, SocialPlatform } from '@/features/social/dto'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { safeExternalUrl } from '@/lib/links'
import type { SiteDTO } from './dto'

const imageSelect = {
  id: mediaAssets.id,
  variants: mediaAssets.variants,
  width: mediaAssets.width,
  height: mediaAssets.height,
  altText: mediaAssets.altText,
  lqip: mediaAssets.lqip,
  credit: mediaAssets.credit,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
}

const SOCIAL_ORDER: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'youtube', 'x']

/** Datos públicos del club (layout y portada). Se invalida con el tag `settings`. */
export async function getSite(): Promise<SiteDTO | null> {
  'use cache'
  cacheTag(tags.settings(), tags.media())
  cacheLife('hours')

  const [row] = await db
    .select({
      clubName: siteSettings.clubName,
      shortName: siteSettings.shortName,
      foundedOn: siteSettings.foundedOn,
      whatsappE164: siteSettings.whatsappE164,
      phoneE164: siteSettings.phoneE164,
      publicEmail: siteSettings.publicEmail,
      address: siteSettings.address,
      commune: siteSettings.commune,
      region: siteSettings.region,
      socialLinks: siteSettings.socialLinks,
      hero: siteSettings.hero,
      seoDefaults: siteSettings.seoDefaults,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  if (!row) return null

  const [crest] = await db
    .select(imageSelect)
    .from(teams)
    .innerJoin(mediaAssets, eq(mediaAssets.id, teams.crestMediaId))
    .where(eq(teams.isOwnClub, true))
    .limit(1)

  const mediaIds = [row.hero?.mediaId, row.hero?.mobileMediaId, row.seoDefaults?.ogMediaId].filter(
    (id): id is string => Boolean(id),
  )
  const media =
    mediaIds.length > 0
      ? await db.select(imageSelect).from(mediaAssets).where(inArray(mediaAssets.id, mediaIds))
      : []
  const heroImage = (id?: string) => toImageDTO(media.find((item) => item.id === id))

  const socialLinks: SocialLinkDTO[] = SOCIAL_ORDER.flatMap((platform) => {
    const url = safeExternalUrl(row.socialLinks?.[platform])
    return url ? [{ platform, url }] : []
  })

  return {
    clubName: row.clubName,
    shortName: row.shortName,
    foundedYear: Number(row.foundedOn.slice(0, 4)),
    foundedOn: row.foundedOn,
    crest: toImageDTO(crest),
    whatsapp: row.whatsappE164,
    phone: row.phoneE164,
    email: row.publicEmail,
    address: row.address,
    commune: row.commune,
    region: row.region,
    socialLinks,
    hero: {
      title: row.hero?.title ?? null,
      subtitle: row.hero?.subtitle ?? null,
      ctaLabel: row.hero?.ctaLabel ?? null,
      ctaHref: row.hero?.ctaHref ?? null,
      image: heroImage(row.hero?.mediaId),
      mobileImage: heroImage(row.hero?.mobileMediaId),
    },
    seoDescription: row.seoDefaults?.description ?? null,
    seoImage: heroImage(row.seoDefaults?.ogMediaId),
  }
}
