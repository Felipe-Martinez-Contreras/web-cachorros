import { Clock } from 'lucide-react'
import { staffRoleLabels, weekdayLabels } from '@/lib/labels'
import type { TrainingSeriesDTO } from '../dto'

type Props = {
  series: TrainingSeriesDTO[]
  /** Nivel del título de cada serie dentro de la página. */
  headingLevel?: 'h2' | 'h3'
  showCoaches?: boolean
  showDescription?: boolean
}

/** Horarios de entrenamiento por serie (6.9 y 6.13), como lista legible también sin estilos. */
export function TrainingSchedule({
  series,
  headingLevel: Heading = 'h3',
  showCoaches = false,
  showDescription = false,
}: Props) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {series.map((serie) => (
        <li
          key={serie.slug}
          className="grid content-start gap-3 rounded-lg border border-(--border) bg-(--surface) p-4"
        >
          <Heading className="text-lg font-bold">{serie.name}</Heading>
          {showDescription && serie.description && <p className="text-(--muted)">{serie.description}</p>}
          {serie.sessions.length === 0 ? (
            <p className="text-(--muted)">Horario por confirmar: escríbenos para saber cuándo entrena.</p>
          ) : (
            <ul aria-label={`Entrenamientos de ${serie.name}`} className="grid gap-2">
              {serie.sessions.map((session) => (
                <li key={`${session.weekday}-${session.startsAt}`} className="flex items-start gap-2">
                  <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-strong" />
                  <span>
                    <strong>{weekdayLabels[session.weekday]}</strong> · {session.startsAt} a {session.endsAt}
                    {session.venueName && <span className="text-(--muted)"> · {session.venueName}</span>}
                    {session.notes && <span className="block text-meta text-(--muted)">{session.notes}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {showCoaches && serie.coaches.length > 0 && (
            <ul aria-label={`Cuerpo técnico de ${serie.name}`} className="grid gap-1 text-meta">
              {serie.coaches.map((coach) => (
                <li key={`${coach.role}-${coach.name}`}>
                  <span className="text-(--muted)">{staffRoleLabels[coach.role]}:</span> {coach.name}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}
