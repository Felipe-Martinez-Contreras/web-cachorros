import { CalendarDays, MapPin } from 'lucide-react'
import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatLongDateTime } from '@/lib/format'
import { eventTypeLabels } from '@/lib/labels'
import type { EventCardDTO } from '../dto'

type EventCardProps = { event: EventCardDTO; headingLevel?: 'h2' | 'h3'; className?: string }

/** Tarjeta de evento con su afiche (4:5). */
export function EventCard({ event, headingLevel: Heading = 'h3', className }: EventCardProps) {
  return (
    <article className={cn('group relative grid content-start gap-3', className)}>
      <div className="aspect-[4/5] overflow-hidden rounded-lg bg-(--surface)">
        {event.poster && (
          <ClubImage
            image={event.poster}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div>
        <Badge variant="soft">{eventTypeLabels[event.type]}</Badge>
      </div>
      <Heading className="text-xl leading-snug font-bold">
        <Link
          href={`/eventos/${event.slug}`}
          className="after:absolute after:inset-0 hover:underline hover:underline-offset-4"
        >
          {event.title}
        </Link>
      </Heading>
      <ul className="grid gap-1 text-meta text-(--muted)">
        <li className="flex items-start gap-1.5">
          <CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <time dateTime={event.startsAt} className="first-letter:uppercase">
            {formatLongDateTime(event.startsAt)}
          </time>
        </li>
        {event.locationText && (
          <li className="flex items-start gap-1.5">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {event.locationText}
          </li>
        )}
      </ul>
    </article>
  )
}
