import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { formatKickoff, formatTime } from '@/lib/format'
import { hasScore, type MatchDTO } from '../dto'
import { LiveBadge, Scoreboard, TeamCrest } from './scoreboard'

type MatchCardProps = {
  match: MatchDTO
  /** `compact`: una fila por partido (listas como «Hoy también juegan»). */
  variant?: 'standard' | 'compact'
  className?: string
}

/** Tarjeta de partido: toda la tarjeta enlaza al detalle. */
export function MatchCard({ match, variant = 'standard', className }: MatchCardProps) {
  const href = `/partidos/${match.slug}`
  const live = match.status === 'en_vivo'

  if (variant === 'compact') {
    return (
      <Link
        href={href}
        className={cn(
          'grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-3 py-2 hover:bg-(--fg)/8',
          className,
        )}
      >
        <span className="w-20 text-meta font-semibold">{match.seriesName}</span>
        {/* Sin cortar nombres: en el celular, un equipo por línea; desde `sm`, en una fila con «vs». */}
        <span className="grid min-w-0 gap-1 text-sm sm:flex sm:items-center sm:gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <TeamCrest team={match.home} size="sm" />
            <span className="text-pretty">{match.home.shortName}</span>
          </span>
          <span className="text-(--muted) max-sm:sr-only">vs</span>
          <span className="flex min-w-0 items-center gap-2 sm:flex-row-reverse">
            <TeamCrest team={match.away} size="sm" />
            <span className="text-pretty">{match.away.shortName}</span>
          </span>
        </span>
        <span className="text-right font-tight text-xl font-black tabular-nums [font-stretch:62.5%]">
          {hasScore(match) ? `${match.homeScore}-${match.awayScore}` : formatTime(match.kickoffAt)}
        </span>
      </Link>
    )
  }

  return (
    <Card interactive className={cn('relative', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <p className="text-meta">
          <span className="font-bold">{match.seriesName}</span>
          {match.roundLabel && <span className="text-(--muted)">, {match.roundLabel}</span>}
        </p>
        {live ? <LiveBadge /> : <p className="text-meta text-(--muted)">{formatKickoff(match.kickoffAt)}</p>}
      </div>
      <Link href={href} className="block p-4 after:absolute after:inset-0 after:rounded-lg">
        <Scoreboard match={match} />
      </Link>
      {!hasScore(match) && match.venue && (
        <p className="flex items-center justify-center gap-1.5 border-t border-(--border) px-4 py-3 text-meta text-(--muted)">
          <MapPin aria-hidden="true" className="size-4" />
          {match.venue.name}
        </p>
      )}
    </Card>
  )
}
