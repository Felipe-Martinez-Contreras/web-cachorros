import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { actualizarAuspiciador, eliminarAuspiciador } from '@/features/sponsors/actions'
import { getSponsorAdmin } from '@/features/sponsors/admin-queries'
import { SponsorForm } from '@/features/sponsors/components/sponsor-form'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar auspiciador' }

export default async function EditSponsorPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('sponsors:write')
  const { id } = await params
  const row = isUuid(id) ? await getSponsorAdmin(id) : null
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title={`Editar ${row.name}`}
        description={`Enlace con conteo de clics: /r/auspiciador/${row.slug}`}
        back={{ href: '/admin/auspiciadores', label: 'Auspiciadores' }}
      />
      <SponsorForm
        action={actualizarAuspiciador.bind(null, row.id)}
        logo={row.logo}
        defaults={{
          name: row.name,
          tier: row.tier,
          logoMediaId: row.logo?.id ?? '',
          description: row.description ?? '',
          websiteUrl: row.websiteUrl ?? '',
          instagramUrl: row.instagramUrl ?? '',
          whatsapp: row.whatsappE164 ?? '',
          startsOn: row.startsOn ?? '',
          endsOn: row.endsOn ?? '',
          isActive: row.isActive,
          sortOrder: String(row.sortOrder),
        }}
      />
      <DeleteSection
        what={`el auspiciador ${row.name}`}
        description="Se borran también sus clics. Para conservar el historial del reporte, mejor ocúltalo."
        action={eliminarAuspiciador.bind(null, row.id)}
        redirectTo="/admin/auspiciadores"
        buttonLabel="Eliminar auspiciador"
        successMessage="Auspiciador eliminado."
      />
    </>
  )
}
