import type { eventType } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type EventCardDTO = {
  id: string
  slug: string
  title: string
  type: (typeof eventType.enumValues)[number]
  /** Instante ISO 8601 de inicio. */
  startsAt: string
  locationText: string | null
  priceText: string | null
  poster: ImageDTO | null
}
