import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { crearRival } from '@/features/teams/actions'
import { TeamForm } from '@/features/teams/components/forms'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Nuevo rival' }

export default async function NewTeamPage() {
  await requirePanelUser('sport:write')
  return (
    <>
      <PageHeader title="Nuevo rival" back={{ href: '/admin/rivales', label: 'Rivales' }} />
      <TeamForm
        action={crearRival}
        crest={null}
        defaults={{ name: '', shortName: '', commune: '', crestMediaId: '' }}
      />
    </>
  )
}
