import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearJugador } from '@/features/players/actions'
import { NewPlayerForm } from '@/features/players/components/forms'
import { sportOptions } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Nuevo jugador' }

export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ serie?: string }> }) {
  await requirePanelUser('players:write')
  const [{ serie }, options] = await Promise.all([searchParams, sportOptions()])

  return (
    <>
      <PageHeader title="Nuevo jugador" back={{ href: '/admin/jugadores', label: 'Jugadores' }} />
      <NewPlayerForm
        action={crearJugador}
        series={options.series}
        defaults={{
          firstName: '',
          lastName: '',
          nickname: '',
          birthDate: '',
          primaryPosition: 'mediocampista',
          positionDetail: '',
          photoMediaId: '',
          isActive: true,
          imageConsent: false,
          // Si se llega desde la lista filtrada por una serie, se propone esa misma.
          seriesId: isUuid(serie) ? serie : '',
          shirtNumber: '',
        }}
      />
    </>
  )
}
