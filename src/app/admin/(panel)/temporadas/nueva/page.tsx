import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearTemporada } from '@/features/series/actions'
import { SeasonForm } from '@/features/series/components/forms'
import { listSeasonsAdmin } from '@/features/series/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { toIsoDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Nueva temporada' }

export default async function NewSeasonPage() {
  await requirePanelUser('sport:write')
  const existing = await listSeasonsAdmin()
  // Valor por defecto inteligente: el año siguiente al de la última temporada (o el actual).
  const currentYear = Number(toIsoDate(new Date()).slice(0, 4))
  const year = existing[0] ? Math.max(existing[0].year + 1, currentYear) : currentYear

  return (
    <>
      <PageHeader
        title="Nueva temporada"
        description="Después de crearla podrás copiar el plantel y el cuerpo técnico de una temporada anterior."
        back={{ href: '/admin/temporadas', label: 'Temporadas' }}
      />
      <SeasonForm
        action={crearTemporada}
        defaults={{ name: `Temporada ${year}`, year, startsOn: '', endsOn: '', isCurrent: false }}
      />
    </>
  )
}
