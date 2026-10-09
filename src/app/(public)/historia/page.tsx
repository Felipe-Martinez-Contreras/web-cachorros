import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { RichText } from '@/components/site/rich-text'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { HistoryNav } from '@/features/history/components/history-nav'
import { decadeOf, decadesOf, resolveDecade } from '@/features/history/lib/dates'
import { getTimeline, type MilestoneDTO } from '@/features/history/queries'
import { getPageBlock } from '@/features/pages/queries'
import { cn } from '@/lib/cn'

export const metadata: Metadata = {
  title: 'Historia',
  description:
    'La historia del Club Deportivo Los Cachorros, fundado el 1 de abril de 1934 en Sagrada Familia.',
}

type Props = { searchParams: Promise<{ decada?: string | string[] }> }

const TIMELINE = 'linea-de-tiempo'

function Milestone({ milestone, anchor }: { milestone: MilestoneDTO; anchor: boolean }) {
  return (
    <li
      // Ancla por año (`/historia#1934`): la lleva el primer hito de cada año.
      id={anchor ? String(milestone.year) : undefined}
      className={cn(
        'relative grid content-start gap-3 pb-10 last:pb-0 md:w-80 md:shrink-0 md:snap-start md:pb-0',
        // El punto sobre la línea: a la izquierda en el celular, arriba en escritorio.
        'before:absolute before:top-2 before:-left-[1.9rem] before:size-3 before:rounded-full before:bg-accent',
        'md:before:-top-[1.9rem] md:before:left-0',
      )}
    >
      <p className="font-tight text-5xl leading-none font-black [font-stretch:62.5%]">
        {milestone.dateLabel === null ? '¿?' : milestone.year}
      </p>
      <p className="flex flex-wrap items-center gap-2 text-meta text-(--muted)">
        {milestone.dateLabel ?? 'Fecha por confirmar'}
        {milestone.isPlaceholder && <Badge variant="soft">Por confirmar</Badge>}
      </p>
      <h3 className="text-h3">{milestone.title}</h3>
      {milestone.image && (
        <figure className="grid gap-1">
          <ClubImage
            image={milestone.image}
            sizes="(min-width: 768px) 320px, 100vw"
            className="aspect-[4/3] w-full rounded-lg object-cover"
          />
          {milestone.image.credit && (
            <figcaption className="text-meta text-(--muted)">Foto: {milestone.image.credit}</figcaption>
          )}
        </figure>
      )}
      {milestone.body && <p className="whitespace-pre-line text-(--muted)">{milestone.body}</p>}
    </li>
  )
}

export default async function HistoryPage({ searchParams }: Props) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const [params, intro, timeline] = await Promise.all([
    searchParams,
    getPageBlock('historia.intro'),
    getTimeline(),
  ])
  const decades = decadesOf(timeline.map((milestone) => milestone.year))
  const decade = resolveDecade(params.decada, decades)
  const milestones = decade === null ? timeline : timeline.filter((item) => decadeOf(item.year) === decade)
  const filterClass =
    'inline-flex min-h-11 items-center rounded-md border border-(--border) px-3 font-semibold'

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Historia' }]} title="Historia">
        <HistoryNav current="/historia" />
      </PageHero>

      {intro && (
        <section
          aria-labelledby="relato"
          className="container-site grid max-w-3xl grid-cols-1 gap-4 py-8 md:py-12"
        >
          <h2 id="relato" className="text-h2 uppercase">
            {intro.title ?? 'Nuestra historia'}
          </h2>
          <RichText doc={intro.body} images={intro.images} />
        </section>
      )}

      <section
        id={TIMELINE}
        aria-labelledby="linea-titulo"
        className="container-site grid grid-cols-1 gap-6 py-8 md:py-12"
      >
        <h2 id="linea-titulo" className="text-h2 uppercase">
          Línea de tiempo
        </h2>

        {timeline.length === 0 ? (
          <EmptyState title="La línea de tiempo se está armando">Vuelve pronto.</EmptyState>
        ) : (
          <>
            {decades.length > 1 && (
              <nav aria-label="Filtrar por década">
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link
                      href={`/historia#${TIMELINE}`}
                      aria-current={decade === null ? 'true' : undefined}
                      className={cn(filterClass, decade === null && 'bg-(--fg) text-(--bg)')}
                    >
                      Todas
                    </Link>
                  </li>
                  {decades.map((item) => (
                    <li key={item}>
                      <Link
                        href={`/historia?decada=${item}#${TIMELINE}`}
                        aria-current={decade === item ? 'true' : undefined}
                        className={cn(filterClass, decade === item && 'bg-(--fg) text-(--bg)')}
                      >
                        {item}–{item + 9}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* Vertical en el celular; en escritorio, una fila que se desplaza hacia los lados. */}
            <section
              aria-label="Hitos del club en orden cronológico"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: región con desplazamiento, alcanzable con teclado
              tabIndex={0}
              className="md:overflow-x-auto md:pb-4"
            >
              <ol className="ml-2 grid grid-cols-1 border-l-2 border-(--border) pl-6 md:ml-0 md:flex md:w-max md:snap-x md:gap-8 md:border-t-2 md:border-l-0 md:pt-6 md:pl-0">
                {milestones.map((milestone, index) => (
                  <Milestone
                    key={milestone.id}
                    milestone={milestone}
                    anchor={milestones[index - 1]?.year !== milestone.year}
                  />
                ))}
              </ol>
            </section>
          </>
        )}
      </section>

      <section aria-labelledby="fotos-antiguas" className="theme-dark">
        <div className="container-site grid justify-items-start gap-3 py-10 md:py-14">
          <h2 id="fotos-antiguas" className="text-h2 uppercase">
            ¿Tienes fotos antiguas del club?
          </h2>
          <p className="max-w-xl text-lg text-(--muted)">
            Compártelas: cada foto, recorte o recuerdo ayuda a completar esta historia.
          </p>
          <Link href="/contacto?tema=historia" className={buttonVariants({ variant: 'primary' })}>
            Compartir mis fotos
          </Link>
        </div>
      </section>
    </>
  )
}
