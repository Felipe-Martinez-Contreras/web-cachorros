import { MessageSquareText } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  BallIcon,
  CardIcon,
  PenaltyMissIcon,
  SecondYellowIcon,
  SubstitutionIcon,
} from '@/components/icons/football'
import { cn } from '@/lib/cn'
import { matchEventTypeLabels } from '@/lib/labels'
import type { MatchEventDTO } from '../dto'
import { formatMinute } from '../lib/match-clock'

const ICONS: Record<MatchEventDTO['type'], ReactNode> = {
  gol: <BallIcon />,
  gol_penal: <BallIcon />,
  autogol: <BallIcon className="text-live" />,
  penal_errado: <PenaltyMissIcon />,
  tarjeta_amarilla: <CardIcon className="text-[#f5c518]" />,
  segunda_amarilla: <SecondYellowIcon />,
  tarjeta_roja: <CardIcon className="text-live" />,
  cambio: <SubstitutionIcon />,
  comentario: <MessageSquareText aria-hidden="true" />,
}

function eventText(event: MatchEventDTO): string {
  if (event.type === 'comentario') return event.comment ?? ''
  if (event.type === 'cambio') {
    const entra = event.relatedPlayerName ? `Entra ${event.relatedPlayerName}` : null
    const sale = event.playerName ? `sale ${event.playerName}` : null
    return [entra, sale].filter(Boolean).join(', ') || matchEventTypeLabels.cambio
  }
  return event.playerName ?? ''
}

type EventTimelineProps = {
  events: MatchEventDTO[]
  homeName: string
  awayName: string
  className?: string
}

/**
 * Cronología del partido: los eventos del local a la izquierda y los de la visita a la derecha, con el
 * minuto al centro. Cada evento lleva su tipo como texto (no depende solo del ícono ni del color).
 */
export function EventTimeline({ events, homeName, awayName, className }: EventTimelineProps) {
  if (events.length === 0) return null
  return (
    <ol className={cn('grid gap-1', className)}>
      {events.map((event) => {
        const text = eventText(event)
        const team = event.side === 'home' ? homeName : event.side === 'away' ? awayName : null
        const body = (
          <span
            className={cn('flex items-center gap-2', event.side === 'away' && 'flex-row-reverse text-right')}
          >
            <span className="shrink-0 [&_svg]:size-5">{ICONS[event.type]}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {matchEventTypeLabels[event.type]}
                {team && <span className="sr-only"> de {team}</span>}
              </span>
              {text && <span className="block text-sm break-words text-(--muted)">{text}</span>}
            </span>
          </span>
        )
        return (
          <li
            key={event.id}
            className="grid grid-cols-[1fr_3.5rem_1fr] items-center gap-2 border-b border-(--border) py-2 last:border-0"
          >
            <span>{event.side !== 'away' && body}</span>
            <span className="text-center font-display text-lg font-black tabular-nums [font-stretch:75%]">
              <span className="sr-only">Minuto </span>
              {formatMinute(event.minute, event.stoppageMinute)}
            </span>
            <span>{event.side === 'away' && body}</span>
          </li>
        )
      })}
    </ol>
  )
}
