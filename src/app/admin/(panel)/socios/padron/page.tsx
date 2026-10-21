import { Download, IdCard } from 'lucide-react'
import type { Metadata } from 'next'
import {
  FilterSelect,
  ListToolbar,
  NewLink,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { SectionTabs } from '@/components/admin/section-tabs'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { MEMBERS_TABS } from '@/features/members/nav'
import { listMembersAdmin, type MemberStatus } from '@/features/members/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { optionsFromLabels } from '@/lib/form-schemas'
import { memberStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Padrón de socios' }

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string }>
}) {
  await requirePanelUser('members:write')
  const { q = '', estado } = await searchParams
  const status = estado && Object.hasOwn(memberStatusLabels, estado) ? (estado as MemberStatus) : null
  const rows = await listMembersAdmin({ q, status })
  const filtered = Boolean(q || status)

  return (
    <>
      <PageHeader
        title="Padrón de socios"
        description="Los socios del club con su número correlativo. El número no cambia: identifica al socio en actas y cuotas."
        action={
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/admin/exportar/padron"
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              <Download aria-hidden="true" /> Exportar CSV
            </a>
            <NewLink href="/admin/socios/padron/nuevo">Nuevo socio</NewLink>
          </div>
        }
      />
      <SectionTabs label="Secciones de Socios" current="/admin/socios/padron" tabs={MEMBERS_TABS} />
      <ListToolbar search={q} placeholder="Buscar por nombre, RUT o correo">
        <FilterSelect
          name="estado"
          label="Estado"
          value={status ?? ''}
          options={optionsFromLabels(memberStatusLabels)}
          allLabel="Todos los estados"
        />
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState
          icon={<IdCard aria-hidden="true" />}
          title={filtered ? 'Sin resultados' : 'El padrón está vacío'}
        >
          {filtered
            ? 'Prueba con otra búsqueda.'
            : 'Aprueba una solicitud o agrega a los socios que el club ya tiene.'}
        </EmptyState>
      ) : (
        <ResourceList label="Socios">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={`N.º ${row.memberNumber} · ${row.fullName}`}
              href={`/admin/socios/padron/${row.id}`}
              subtitle={[row.planName ?? 'Sin plan', row.rut].filter(Boolean).join(' · ')}
              badges={
                row.status !== 'activo' && (
                  <Badge variant={row.status === 'baja' ? 'outline' : 'soft'}>
                    {memberStatusLabels[row.status]}
                  </Badge>
                )
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
