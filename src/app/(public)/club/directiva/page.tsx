import { Mail } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { ClubImage } from '@/components/site/club-image'
import { PageHero } from '@/components/site/page-shell'
import { EmptyState } from '@/components/ui/feedback'
import { getCurrentBoard } from '@/features/club/queries'
import { pageMetadata } from '@/features/seo/metadata'
import { formatShortDate, fromIsoDate } from '@/lib/format'
import { isContentMarker } from '@/lib/markers'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Directiva',
    description: 'La directiva vigente del Club Deportivo Los Cachorros: cargos, período y contacto.',
    path: '/club/directiva',
  })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function term(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  if (start && end) return `${formatShortDate(fromIsoDate(start))} al ${formatShortDate(fromIsoDate(end))}`
  return start
    ? `Desde el ${formatShortDate(fromIsoDate(start))}`
    : `Hasta el ${formatShortDate(fromIsoDate(end ?? ''))}`
}

export default async function BoardPage() {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const board = await getCurrentBoard()

  return (
    <>
      <PageHero crumbs={[{ href: '/', label: 'Inicio' }, { label: 'Directiva' }]} title="Directiva">
        <p className="max-w-2xl text-(--muted)">
          Quienes dirigen el club. Las actas, balances y rendiciones están en{' '}
          <Link href="/club/transparencia" className="text-accent underline">
            Transparencia
          </Link>
          .
        </p>
      </PageHero>

      <div className="container-site py-8 md:py-12">
        {board.length === 0 ? (
          <EmptyState title="La directiva se publicará pronto">
            Mientras tanto, escríbenos desde Contacto.
          </EmptyState>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {board.map((member) => {
              const period = term(member.termStart, member.termEnd)
              return (
                <li
                  key={member.id}
                  className="flex gap-4 rounded-lg border border-(--border) bg-(--surface) p-4"
                >
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-ink text-xl font-bold text-paper">
                    {member.photo ? (
                      <ClubImage
                        image={member.photo}
                        alt=""
                        sizes="80px"
                        className="size-full object-cover"
                      />
                    ) : (
                      <span aria-hidden="true">{initials(member.fullName)}</span>
                    )}
                  </div>
                  <div className="grid min-w-0 content-start gap-1">
                    <p className="text-eyebrow text-accent-strong">{member.roleTitle}</p>
                    <h2 className="text-lg leading-snug font-bold">{member.fullName}</h2>
                    {period && <p className="text-meta text-(--muted)">{period}</p>}
                    {member.publicEmail && !isContentMarker(member.publicEmail) && (
                      <a
                        href={`mailto:${member.publicEmail}`}
                        className="inline-flex min-h-11 items-center gap-1.5 break-all text-(--link) underline"
                      >
                        <Mail aria-hidden="true" className="size-4 shrink-0" />
                        {member.publicEmail}
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
