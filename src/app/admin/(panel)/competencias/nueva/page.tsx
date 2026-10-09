import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { crearCompetencia } from '@/features/series/actions'
import { CompetitionForm } from '@/features/series/components/forms'
import { sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva competencia' }

export default async function NewCompetitionPage() {
  await requirePanelUser('sport:write')
  const options = await sportOptions()

  return (
    <>
      <PageHeader title="Nueva competencia" back={{ href: '/admin/competencias', label: 'Competencias' }} />
      {options.currentSeasonId ? (
        <CompetitionForm
          action={crearCompetencia}
          seasons={options.seasons}
          defaults={{
            seasonId: options.currentSeasonId,
            name: '',
            kind: 'liga',
            organizer: '',
            pointsWin: 3,
            pointsDraw: 1,
          }}
        />
      ) : (
        <Alert title="Primero crea una temporada">
          Una competencia pertenece a una temporada.{' '}
          <Link href="/admin/temporadas/nueva" className="font-semibold underline">
            Crear temporada
          </Link>
        </Alert>
      )}
    </>
  )
}
