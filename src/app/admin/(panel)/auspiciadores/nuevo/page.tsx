import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearAuspiciador } from '@/features/sponsors/actions'
import { SponsorForm } from '@/features/sponsors/components/sponsor-form'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo auspiciador' }

export default async function NewSponsorPage() {
  await requirePanelUser('sponsors:write')
  return (
    <>
      <PageHeader title="Nuevo auspiciador" back={{ href: '/admin/auspiciadores', label: 'Auspiciadores' }} />
      <SponsorForm
        action={crearAuspiciador}
        logo={null}
        defaults={{
          name: '',
          tier: 'colaborador',
          logoMediaId: '',
          description: '',
          websiteUrl: '',
          instagramUrl: '',
          whatsapp: '',
          startsOn: '',
          endsOn: '',
          isActive: true,
          sortOrder: '0',
        }}
      />
    </>
  )
}
