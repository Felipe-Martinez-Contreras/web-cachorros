import { CalendarPlus, ImagePlus, type LucideIcon, PenLine } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { listClubMatchesBetween, type MatchAdminListItem } from '@/features/matches/admin-queries'
import { groupHomeMatches, homeMatchWindow } from '@/features/matches/lib/home-window'
import { listPendingNews } from '@/features/news/admin-queries'
import { getLastBackup } from '@/features/system/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { env } from '@/lib/env'
import { formatLongDateTime, formatMatchDate } from '@/lib/format'
import { matchStatusLabels, newsStatusLabels } from '@/lib/labels'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Inicio' }

const cardClass = 'rounded-lg border border-neutral-200 bg-paper p-4'

function MatchList({
  title,
  id,
  matches,
  highlight = false,
}: {
  title: string
  id: string
  matches: MatchAdminListItem[]
  /** Lo que ya debió cargarse: el botón va destacado. */
  highlight?: boolean
}) {
  if (matches.length === 0) return null
  return (
    <section aria-labelledby={id} className={cardClass}>
      <h2 id={id} className="mb-3 text-lg font-bold">
        {title}
      </h2>
      <ul className="grid gap-3">
        {matches.map((match) => {
          const played = match.status === 'finalizado'
          return (
            <li
              key={match.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 first:border-t-0 first:pt-0"
            >
              <div className="grid min-w-0 flex-1 basis-56 gap-1">
                <p className="font-semibold">
                  {played
                    ? `${match.homeName} ${match.homeScore} – ${match.awayScore} ${match.awayName}`
                    : `${match.homeName} vs ${match.awayName}`}
                </p>
                <p className="text-sm text-neutral-600">
                  {match.seriesName} · {formatMatchDate(match.kickoffAt)}
                  {match.venueName && ` · ${match.venueName}`}
                </p>
                {match.status !== 'programado' && (
                  <p>
                    <Badge variant={played ? 'success' : 'soft'}>{matchStatusLabels[match.status]}</Badge>
                  </p>
                )}
              </div>
              {match.status !== 'cancelado' && (
                <Link
                  href={`/admin/partidos/${match.id}/resultado`}
                  className={buttonVariants({ variant: highlight ? 'dark' : 'outline', size: 'lg' })}
                >
                  {played ? 'Corregir resultado' : 'Cargar resultado'}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function QuickLink({ href, icon: Icon, children }: { href: string; icon: LucideIcon; children: string }) {
  return (
    <li>
      <Link href={href} className={buttonVariants({ variant: 'dark', size: 'lg', className: 'w-full' })}>
        <Icon aria-hidden="true" />
        {children}
      </Link>
    </li>
  )
}

/** Inicio del panel (especificación 7.2): lo que hay que hacer hoy, a un toque. */
export default async function AdminHomePage() {
  const user = await requirePanelUser()
  const now = new Date()
  const window = homeMatchWindow(now)
  const [matches, pendingNews, backup] = await Promise.all([
    can(user, 'matches:write') ? listClubMatchesBetween(window.from, window.to) : [],
    can(user, 'news:write') ? listPendingNews() : [],
    getLastBackup(),
  ])
  const groups = groupHomeMatches(matches, now)
  const nothingToPlay = groups.pending.length + groups.today.length + groups.upcoming.length === 0

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold">Inicio</h1>

      <nav aria-label="Accesos rápidos">
        <ul className="grid gap-2 sm:grid-cols-3">
          {can(user, 'news:write') && (
            <QuickLink href="/admin/noticias/nueva" icon={PenLine}>
              Nueva noticia
            </QuickLink>
          )}
          {can(user, 'matches:write') && (
            <QuickLink href="/admin/partidos/jornada" icon={CalendarPlus}>
              Programar jornada
            </QuickLink>
          )}
          {can(user, 'media:write') && (
            <QuickLink href="/admin/medios" icon={ImagePlus}>
              Subir fotos
            </QuickLink>
          )}
        </ul>
      </nav>

      {can(user, 'matches:write') && (
        <>
          <MatchList id="pendientes" title="Falta cargar el resultado" matches={groups.pending} highlight />
          <MatchList id="hoy" title="Partidos de hoy" matches={groups.today} highlight />
          <MatchList id="semana" title="Lo que viene hasta el domingo" matches={groups.upcoming} />
          {nothingToPlay && (
            <section aria-labelledby="sin-partidos" className={cardClass}>
              <h2 id="sin-partidos" className="mb-1 text-lg font-bold">
                Sin partidos esta semana
              </h2>
              <p className="text-neutral-600">
                Cuando la asociación entregue la programación, usa «Programar jornada» para crear los partidos
                de todas las series en un paso.
              </p>
            </section>
          )}
        </>
      )}

      {pendingNews.length > 0 && (
        <section aria-labelledby="noticias-pendientes" className={cardClass}>
          <h2 id="noticias-pendientes" className="mb-3 text-lg font-bold">
            Noticias sin publicar
          </h2>
          <ul className="grid gap-1">
            {pendingNews.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/admin/noticias/${item.id}`}
                  className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 underline-offset-4 hover:underline"
                >
                  <span className="font-medium">{item.title}</span>
                  <Badge variant={item.status === 'programada' ? 'soft' : 'neutral'}>
                    {newsStatusLabels[item.status]}
                  </Badge>
                  {item.status === 'programada' && item.publishedAt && (
                    <span className="text-sm text-neutral-600">
                      sale el {formatLongDateTime(item.publishedAt)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="system-heading" className={cardClass}>
        <h2 id="system-heading" className="mb-2 text-lg font-bold">
          Estado del sistema
        </h2>
        <dl className="grid gap-1 text-neutral-600">
          <div className="flex flex-wrap gap-x-2">
            <dt>Versión instalada:</dt>
            <dd className="font-medium text-ink">{env.APP_VERSION}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt>Último respaldo:</dt>
            <dd className="font-medium text-ink">
              {backup
                ? `${formatLongDateTime(backup.finishedAt ?? backup.startedAt)}${backup.status === 'error' ? ' (falló)' : ''}`
                : 'todavía no hay respaldos registrados'}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
