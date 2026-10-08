import type { siteSettings } from '@/db/schema'
import type { SocialLinkDTO } from '@/features/social/dto'
import type { ImageDTO } from '@/lib/images/dto'

/** Lo que el panel edita de la identidad del club. */
export type ClubIdentityDTO = {
  clubName: string
  shortName: string
  foundedOn: string
}

type SettingsRow = Pick<typeof siteSettings.$inferSelect, 'clubName' | 'shortName' | 'foundedOn'>

export function toClubIdentityDTO(row: SettingsRow): ClubIdentityDTO {
  return { clubName: row.clubName, shortName: row.shortName, foundedOn: row.foundedOn }
}

/** Datos públicos del club para el layout y la portada. Nunca incluye datos bancarios ni destinatarios. */
export type SiteDTO = {
  clubName: string
  shortName: string
  foundedYear: number
  crest: ImageDTO | null
  whatsapp: string | null
  phone: string | null
  email: string | null
  address: string | null
  commune: string | null
  region: string | null
  socialLinks: SocialLinkDTO[]
  hero: {
    title: string | null
    subtitle: string | null
    ctaLabel: string | null
    ctaHref: string | null
    image: ImageDTO | null
    mobileImage: ImageDTO | null
  }
  seoDescription: string | null
}
