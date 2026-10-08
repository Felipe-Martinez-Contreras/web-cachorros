import type { sponsorTier } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type SponsorDTO = {
  id: string
  slug: string
  name: string
  tier: (typeof sponsorTier.enumValues)[number]
  logo: ImageDTO | null
  /** Tiene algún enlace propio: se llega por `/r/auspiciador/[slug]`, que cuenta los clics (Fase 3). */
  hasLink: boolean
}
