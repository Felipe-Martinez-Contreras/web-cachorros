import type { RichTextDoc } from '@/db/schema/_columns'
import type { eventStatus, eventType } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type EventCardDTO = {
  id: string
  slug: string
  title: string
  type: (typeof eventType.enumValues)[number]
  status: (typeof eventStatus.enumValues)[number]
  /** Instante ISO 8601 de inicio. */
  startsAt: string
  locationText: string | null
  priceText: string | null
  poster: ImageDTO | null
}

export type EventsPageDTO = {
  upcoming: EventCardDTO[]
  past: EventCardDTO[]
  page: number
  totalPages: number
}

export type EventDetailDTO = EventCardDTO & {
  endsAt: string | null
  description: RichTextDoc | null
  descriptionImages: Record<string, ImageDTO>
  ctaUrl: string | null
  venue: { name: string; address: string | null; commune: string | null } | null
  mapUrl: string | null
  /** El afiche en su variante más grande, para verlo ampliado. */
  posterFull: string | null
  updatedAt: string
}
