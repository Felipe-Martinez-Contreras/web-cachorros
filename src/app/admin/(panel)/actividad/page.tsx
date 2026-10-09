import { History } from 'lucide-react'
import type { Metadata } from 'next'
import {
  FilterSelect,
  ListToolbar,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination } from '@/components/ui/pagination'
import { auditFilterOptions, listAuditLog, SYSTEM_ACTOR } from '@/features/audit/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatLongDateTime } from '@/lib/format'
import { auditEntityLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Actividad' }

type Props = {
  searchParams: Promise<{ persona?: string; tipo?: string; desde?: string; hasta?: string; pagina?: string }>
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const dateOrNull = (value: string | undefined) => (value && ISO_DATE.test(value) ? value : null)

function DateFilter({ name, label, value }: { name: string; label: string; value: string | null }) {
  return (
    <label className="grid min-w-0 basis-40 gap-1 text-sm font-medium">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={value ?? ''}
        className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base font-normal"
      />
    </label>
  )
}

export default async function ActivityPage({ searchParams }: Props) {
  await requirePanelUser('audit:read')
  const params = await searchParams
  const options = await auditFilterOptions()
  const userId =
    params.persona === SYSTEM_ACTOR || options.people.some((person) => person.value === params.persona)
      ? (params.persona ?? null)
      : null
  const entityType = options.entityTypes.includes(params.tipo ?? '') ? (params.tipo ?? null) : null
  const from = dateOrNull(params.desde)
  const to = dateOrNull(params.hasta)
  const { items, page, totalPages, total } = await listAuditLog({
    userId,
    entityType,
    from,
    to,
    page: Number.parseInt(params.pagina ?? '1', 10) || 1,
  })
  const filtered = Boolean(userId || entityType || from || to)

  return (
    <>
      <PageHeader
        title="Actividad"
        description="Todo lo que se crea, edita, publica o elimina en el panel queda anotado aquí durante 12 meses."
      />
      <ListToolbar>
        <FilterSelect
          name="persona"
          label="Persona"
          value={userId ?? ''}
          options={[...options.people, { value: SYSTEM_ACTOR, label: 'El sistema' }]}
          allLabel="Todas"
        />
        <FilterSelect
          name="tipo"
          label="Sobre"
          value={entityType ?? ''}
          options={options.entityTypes.map((value) => ({ value, label: auditEntityLabels[value] ?? value }))}
          allLabel="Todo"
        />
        <DateFilter name="desde" label="Desde" value={from} />
        <DateFilter name="hasta" label="Hasta" value={to} />
      </ListToolbar>

      {items.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden="true" />}
          title={filtered ? 'Sin actividad con esos filtros' : 'Todavía no hay actividad'}
        >
          {filtered
            ? 'Cambia los filtros para ver más.'
            : 'Aquí aparecerá cada cambio que se haga en el panel.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-600">{total === 1 ? '1 registro' : `${total} registros`}</p>
          <ResourceList label="Actividad">
            {items.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.summary ?? item.action}
                subtitle={
                  <>
                    {item.userName ?? 'El sistema'} ·{' '}
                    <time dateTime={item.createdAt.toISOString()}>{formatLongDateTime(item.createdAt)}</time>
                    {item.entityType && ` · ${auditEntityLabels[item.entityType] ?? item.entityType}`}
                  </>
                }
              />
            ))}
          </ResourceList>
          <Pagination
            page={page}
            totalPages={totalPages}
            hrefFor={(n) =>
              `/admin/actividad?${new URLSearchParams({
                ...(userId ? { persona: userId } : {}),
                ...(entityType ? { tipo: entityType } : {}),
                ...(from ? { desde: from } : {}),
                ...(to ? { hasta: to } : {}),
                pagina: String(n),
              })}`
            }
            className="mt-6"
          />
        </>
      )}
    </>
  )
}
