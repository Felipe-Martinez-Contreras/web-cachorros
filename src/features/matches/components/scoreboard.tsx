import { ClubImage } from '@/components/site/club-image'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/format'
import { matchPeriodLabels, matchResolutionLabels, matchStatusLabels } from '@/lib/labels'
import { hasScore, type MatchDTO, scoreText, type TeamDTO } from '../dto'

const CREST_SIZES = { sm: 'size-8', md: 'size-12', lg: 'size-16 md:size-24' } as const

type CrestProps = { team: TeamDTO; size?: keyof typeof CREST_SIZES; className?: string }

/** Escudo en lienzo cuadrado. Es decorativo: el nombre del equipo siempre va escrito al lado. */
export function TeamCrest({ team, size = 'md', className }: CrestProps) {
  return (
    // `.crest` le pone un fondo blanco circular en las secciones oscuras (los escudos traen trazos negros).
    <span className={cn('crest block shrink-0', CREST_SIZES[size], className)}>
      {team.crest ? (
        <ClubImage
          image={team.crest}
          alt=""
          sizes={size === 'lg' ? '96px' : '48px'}
          className="size-full object-contain"
          style={{ backgroundImage: 'none' }}
        />
      ) : (
        // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
        <img
          src="/placeholder/escudo-generico.svg"
          alt=""
          width={96}
          height={96}
          className="size-full object-contain"
        />
      )}
    </span>
  )
}

/** Insignia EN VIVO con el punto que late (se detiene con `prefers-reduced-motion`). */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge variant="live" className={className}>
      <span className="relative flex size-2" aria-hidden="true">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-paper opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-paper" />
      </span>
      En vivo
    </Badge>
  )
}

/** Nota visible cuando el partido no se juega o no terminó en cancha. */
export function matchNote(match: MatchDTO): string | null {
  if (match.status === 'suspendido' || match.status === 'postergado' || match.status === 'cancelado') {
    return matchStatusLabels[match.status]
  }
  if (match.status !== 'finalizado') return null
  if (match.resolution === 'penales' && match.homePenalties !== null && match.awayPenalties !== null) {
    return `Penales: ${match.homePenalties}-${match.awayPenalties}`
  }
  return match.resolution === 'normal' ? null : matchResolutionLabels[match.resolution]
}

type ScoreboardProps = {
  match: MatchDTO
  /** `lg`: franja matchday y detalle del partido. `md`: tarjetas. */
  size?: 'md' | 'lg'
  className?: string
}

/** Escudos enfrentados con el marcador (o la hora, si aún no se juega). */
export function Scoreboard({ match, size = 'md', className }: ScoreboardProps) {
  const large = size === 'lg'
  const scored = hasScore(match)
  const note = matchNote(match)
  const nameClass = cn('font-semibold leading-tight', large ? 'text-base md:text-xl' : 'text-sm')

  return (
    <div className={cn('grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6', className)}>
      <div className="flex flex-col items-center gap-2 text-center">
        <TeamCrest team={match.home} size={large ? 'lg' : 'md'} />
        <span className={nameClass}>{match.home.shortName}</span>
      </div>

      <div className="grid justify-items-center gap-1">
        {scored ? (
          <p
            className={cn(
              'tabular-nums',
              large ? 'text-score' : 'font-tight text-4xl font-black [font-stretch:62.5%]',
            )}
          >
            <span className="sr-only">{scoreText(match)}</span>
            <span aria-hidden="true">
              {match.homeScore}
              <span className="mx-[0.15em] opacity-50">-</span>
              {match.awayScore}
            </span>
          </p>
        ) : (
          <p
            className={cn(
              'font-tight font-black tabular-nums [font-stretch:62.5%]',
              large ? 'text-5xl md:text-6xl' : 'text-3xl',
            )}
          >
            <span className="sr-only">Comienza a las </span>
            {formatTime(match.kickoffAt)}
          </p>
        )}
        {match.status === 'en_vivo' && <span className="text-meta">{matchPeriodLabels[match.period]}</span>}
        {note && <span className="text-meta text-(--muted)">{note}</span>}
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <TeamCrest team={match.away} size={large ? 'lg' : 'md'} />
        <span className={nameClass}>{match.away.shortName}</span>
      </div>
    </div>
  )
}
