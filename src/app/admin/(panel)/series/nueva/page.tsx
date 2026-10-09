import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearSerie } from '@/features/series/actions'
import { SeriesForm } from '@/features/series/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nueva serie' }

export default async function NewSeriesPage() {
  await requirePanelUser('sport:write')
  return (
    <>
      <PageHeader title="Nueva serie" back={{ href: '/admin/series', label: 'Series' }} />
      <SeriesForm
        action={crearSerie}
        defaults={{
          name: '',
          shortName: '',
          kind: 'adulta',
          halfLengthMinutes: 45,
          containsMinors: false,
          isActive: true,
          description: '',
        }}
      />
    </>
  )
}
