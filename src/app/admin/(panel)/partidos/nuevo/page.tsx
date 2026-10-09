import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { crearPartido } from '@/features/matches/actions'
import { matchFormOptions, missingForScheduling } from '@/features/matches/admin-options'
import { MatchForm } from '@/features/matches/components/admin-forms'
import { requirePanelUser } from '@/lib/auth/session'
import { toIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Programar un partido' }

export default async function NewMatchPage() {
  await requirePanelUser('matches:write')
  const options = await matchFormOptions()
  const missing = missingForScheduling(options)

  return (
    <>
      <PageHeader
        title="Programar un partido"
        description="Para varias series contra el mismo rival el mismo día, usa «Programar jornada». Para la tabla calculada también puedes cargar aquí partidos entre dos rivales."
        back={{ href: '/admin/partidos', label: 'Partidos' }}
      />
      {missing ? (
        <Alert title="Todavía no se puede programar">Primero hay que crear {missing}.</Alert>
      ) : (
        <MatchForm
          isNew
          action={crearPartido}
          options={options}
          defaults={{
            seriesId: options.series[0]?.value ?? '',
            competitionId: options.competitions[0]?.value ?? '',
            homeTeamId: options.ownTeamId ?? '',
            awayTeamId: options.rivals[0]?.value ?? '',
            date: toIsoDate(new Date()),
            time: '16:00',
            venueId: options.homeVenueId ?? '',
            roundNumber: '',
            roundLabel: '',
            notes: '',
          }}
        />
      )}
    </>
  )
}
