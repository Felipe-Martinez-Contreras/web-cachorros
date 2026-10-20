import type { Metadata } from 'next'
import { PageHeader } from '@/components/admin/resource-list'
import { PersonalDataTool } from '@/features/privacy/components/personal-data-tool'
import { requirePanelUser } from '@/lib/auth/session'

export const metadata: Metadata = { title: 'Datos personales' }

export default async function PersonalDataPage() {
  await requirePanelUser('privacy:manage')
  return (
    <>
      <PageHeader
        title="Datos personales"
        description="Cuando alguien pide una copia de sus datos o que los borremos: búscalo por su correo, RUT o celular en las solicitudes, el padrón y los mensajes."
      />
      <PersonalDataTool />
    </>
  )
}
