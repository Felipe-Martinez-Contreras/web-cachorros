import { CalendarDays, CalendarPlus, ExternalLink, MapPin, Ticket, X, ZoomIn } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { Breadcrumbs } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { ShareBar } from '@/components/site/share-bar'
import { loadSite } from '@/components/site/site-frame'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { eventCta } from '@/features/events/lib/public'
import { getEventDetail, resolveEventRedirect } from '@/features/events/queries'
import { JsonLd } from '@/features/seo/components/json-ld'
import { eventJsonLd } from '@/features/seo/lib/json-ld'
import { pageMetadata, siteBaseUrl } from '@/features/seo/metadata'
import { formatLongDateTime, formatTime, toIsoDate } from '@/lib/format'
import { eventTypeLabels } from '@/lib/labels'
import { richTextToPlain } from '@/lib/rich-text/document'

type Props = { params: Promise<{ slug: string }> }

async function loadEvent(slug: string) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const event = await getEventDetail(slug)
  if (event) return event
  // Segunda barrera (el 404 y el 301 reales los responde el proxy, ADR 0008).
  const current = await resolveEventRedirect(slug)
  if (current) permanentRedirect(`/eventos/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadEvent((await params).slug)
  const summary = richTextToPlain(event.description).slice(0, 160)
  return pageMetadata({
    title: event.title,
    description: summary || `${eventTypeLabels[event.type]} del club: ${formatLongDateTime(event.startsAt)}.`,
    path: `/eventos/${event.slug}`,
    image: event.poster,
  })
}

/** «sábado 14 de noviembre, 13:00 a 17:00» o, si termina otro día, con las dos fechas completas. */
function eventWhen(startsAt: string, endsAt: string | null): string {
  const start = formatLongDateTime(startsAt)
  if (!endsAt) return start
  return toIsoDate(startsAt) === toIsoDate(endsAt)
    ? `${start} a ${formatTime(endsAt)}`
    : `${start} al ${formatLongDateTime(endsAt)}`
}

export default async function EventPage({ params }: Props) {
  const event = await loadEvent((await params).slug)
  const site = await loadSite()
  const cta = event.status === 'cancelado' ? null : eventCta(event, site.whatsapp)
  const place = event.venue?.name ?? event.locationText
  const baseUrl = siteBaseUrl()

  return (
    <article className="container-site grid grid-cols-1 gap-8 py-6 md:py-10">
      <JsonLd
        data={eventJsonLd(
          {
            ...event,
            description: richTextToPlain(event.description) || null,
            image: event.posterFull,
          },
          { clubName: site.clubName },
          baseUrl,
        )}
      />
      <Breadcrumbs
        items={[
          { href: '/', label: 'Inicio' },
          { href: '/eventos', label: 'Eventos' },
          { label: event.title },
        ]}
      />

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
        {event.poster && (
          <div className="grid content-start gap-2">
            {/* El afiche se amplía con un popover nativo: funciona sin JavaScript. */}
            <button
              type="button"
              popoverTarget="afiche"
              className="group relative overflow-hidden rounded-lg bg-(--surface)"
              aria-label="Ver el afiche ampliado"
            >
              <ClubImage
                image={event.poster}
                priority
                sizes="(min-width: 768px) 40vw, 100vw"
                className="aspect-[4/5] w-full object-cover"
              />
              <span className="absolute right-2 bottom-2 grid size-11 place-items-center rounded-full bg-ink/80 text-paper">
                <ZoomIn aria-hidden="true" className="size-5" />
              </span>
            </button>
            <div
              id="afiche"
              popover="auto"
              className="m-auto max-h-[92dvh] max-w-[min(92vw,56rem)] overflow-auto rounded-lg bg-ink p-2 backdrop:bg-ink/80"
            >
              <button
                type="button"
                popoverTarget="afiche"
                popoverTargetAction="hide"
                className={buttonVariants({
                  variant: 'light',
                  size: 'icon',
                  className: 'absolute top-3 right-3',
                })}
                aria-label="Cerrar el afiche"
              >
                <X aria-hidden="true" />
              </button>
              <ClubImage image={event.poster} sizes="92vw" className="h-auto max-h-[88dvh] w-auto" />
            </div>
          </div>
        )}

        <div className="grid content-start gap-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="soft">{eventTypeLabels[event.type]}</Badge>
            {event.status === 'cancelado' && <Badge variant="danger">Cancelado</Badge>}
            {event.status === 'realizado' && <Badge variant="neutral">Realizado</Badge>}
          </div>
          <h1 className="text-h1">{event.title}</h1>
          {event.status === 'cancelado' && (
            <Alert variant="danger" title="Este evento se canceló">
              Si tenías una entrada o una reserva, escríbele a la directiva.
            </Alert>
          )}

          <ul className="grid gap-3">
            <li className="flex items-start gap-2">
              <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-strong" />
              <time dateTime={event.startsAt} className="first-letter:uppercase">
                {eventWhen(event.startsAt, event.endsAt)}
              </time>
            </li>
            {place && (
              <li className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-strong" />
                <span>
                  {place}
                  {event.venue?.address && `, ${event.venue.address}`}
                  {event.mapUrl && (
                    <>
                      {' · '}
                      <a
                        href={event.mapUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-(--link) underline"
                      >
                        Ver en el mapa<span className="sr-only"> (se abre en una pestaña nueva)</span>
                      </a>
                    </>
                  )}
                </span>
              </li>
            )}
            {event.priceText && (
              <li className="flex items-start gap-2">
                <Ticket aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent-strong" />
                <span>{event.priceText}</span>
              </li>
            )}
          </ul>

          <div className="flex flex-wrap gap-3">
            {cta && (
              <a href={cta.href} target="_blank" rel="noopener" className={buttonVariants({ size: 'lg' })}>
                {cta.label} <ExternalLink aria-hidden="true" />
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            )}
            {event.status === 'programado' && (
              <a
                href={`/api/ics/evento/${event.id}`}
                className={buttonVariants({ variant: 'dark', size: 'lg' })}
              >
                <CalendarPlus aria-hidden="true" /> Agregar al calendario
              </a>
            )}
          </div>

          <RichText doc={event.description} images={event.descriptionImages} />

          <div className="border-t border-(--border) pt-6">
            <ShareBar url={`${baseUrl}/eventos/${event.slug}`} title={event.title} />
          </div>
        </div>
      </div>
    </article>
  )
}
