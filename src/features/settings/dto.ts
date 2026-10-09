import type { SocialLinkDTO } from '@/features/social/dto'
import type { ImageDTO } from '@/lib/images/dto'

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
