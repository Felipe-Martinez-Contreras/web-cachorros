import type { sponsorTier } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'
import type { SponsorLink } from './lib/links'

export type SponsorDTO = {
  id: string
  slug: string
  name: string
  tier: (typeof sponsorTier.enumValues)[number]
  logo: ImageDTO | null
  description: string | null
  /** Enlaces propios: se llega por `/r/auspiciador/[slug]?a=…`, que cuenta los clics del día. */
  links: SponsorLink[]
  hasLink: boolean
}
