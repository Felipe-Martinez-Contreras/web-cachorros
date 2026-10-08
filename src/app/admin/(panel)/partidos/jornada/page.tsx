import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { programarJornada } from '@/features/matches/actions'
import { matchFormOptions, missingForScheduling } from '@/features/matches/admin-options'
import { lastClubMatchBySeries } from '@/features/matches/admin-queries'
import { MatchdayForm } from '@/features/matches/components/admin-forms'
import { startOfSantiagoDay } from '@/features/matches/lib/countdown'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import { listSeriesAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { toIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Programar jornada' }

/** El próximo sábado (o hoy, si es sábado): el día habitual de una jornada. */
function nextSaturday(now: Date): string {
  for (let offset = 0; offset < 7; offset++) {
    const day = startOfSantiagoDay(now, offset)
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      weekday: 'short',
    }).format(
      // Mediodía: lejos del cambio de día en cualquier zona.
      new Date(day.getTime() + 12 * 3_600_000),
    )
    if (weekday === 'Sat') return toIsoDate(new Date(day.getTime() + 12 * 3_600_000))
  }
  return toIsoDate(now)
}

export default async function MatchdayPage() {
  await requirePanelUser('matches:write')
  const [options, seriesRows, last] = await Promise.all([
    matchFormOptions(),
    listSeriesAdmin(),
    lastClubMatchBySeries(),
  ])
  const missing = missingForScheduling(options)
  const active = seriesRows.filter((row) => row.isActive)

  return (
    <>
      <PageHeader
        title="Programar jornada"
        description="Crea en un paso los partidos de varias series contra el mismo rival. Cada serie trae su hora habitual y la fecha que le toca."
        back={{ href: '/admin/partidos', label: 'Partidos' }}
      />
      {missing ? (
        <Alert title="Todavía no se puede programar">Primero hay que crear {missing}.</Alert>
      ) : (
        <MatchdayForm
          action={programarJornada}
          options={options}
          seriesNames={Object.fromEntries(active.map((row) => [row.id, row.name]))}
          defaults={{
            date: nextSaturday(new Date()),
            competitionId: options.competitions[0]?.value ?? '',
            rivalId: options.rivals[0]?.value ?? '',
            condition: 'local',
            venueId: options.homeVenueId ?? '',
            rows: active.map((row) => {
              const previous = last.get(row.id)
              return {
                seriesId: row.id,
                include: false,
                time: previous ? toSantiagoWallTime(previous.kickoffAt).time : '16:00',
                roundNumber: previous?.roundNumber ? previous.roundNumber + 1 : '',
              }
            }),
          }}
        />
      )}
    </>
  )
}
