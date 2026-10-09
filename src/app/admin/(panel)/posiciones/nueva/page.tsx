import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { matchFormOptions } from '@/features/matches/admin-options'
import { crearTabla } from '@/features/standings/actions'
import { NewStandingsForm } from '@/features/standings/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { toIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Nueva tabla de posiciones' }

export default async function NewStandingsPage() {
  await requirePanelUser('standings:write')
  const options = await matchFormOptions()
  const ready = options.series.length > 0 && options.competitions.length > 0

  return (
    <>
      <PageHeader title="Nueva tabla" back={{ href: '/admin/posiciones', label: 'Tabla de posiciones' }} />
      {ready ? (
        <NewStandingsForm
          action={crearTabla}
          series={options.series}
          competitions={options.competitions}
          defaults={{
            seriesId: options.series[0]?.value ?? '',
            competitionId: options.competitions[0]?.value ?? '',
            groupLabel: '',
            mode: 'manual',
            asOf: toIsoDate(new Date()),
            sourceNote: '',
          }}
        />
      ) : (
        <Alert title="Faltan datos">Primero crea una serie y una competencia.</Alert>
      )}
    </>
  )
}
