import { Download, Inbox } from 'lucide-react'
import type { Metadata } from 'next'
import { InboxStatusBadge } from '@/components/admin/inbox'
import {
  FilterSelect,
  ListToolbar,
  PageHeader,
  ResourceList,
  ResourceRow,
} from '@/components/admin/resource-list'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import type { contactTopic } from '@/db/schema/enums'
import { listContactMessagesAdmin } from '@/features/inbox/queries'
import { CONTACT_STATUSES } from '@/features/inbox/schemas'
import { requirePanelUser } from '@/lib/auth/session'
import { optionsFromLabels } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { contactTopicLabels, inboxStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Mensajes' }

type Status = (typeof CONTACT_STATUSES)[number]
type Topic = (typeof contactTopic.enumValues)[number]

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tema?: string }>
}) {
  await requirePanelUser('messages:write')
  const { estado, tema } = await searchParams
  const status = (CONTACT_STATUSES as readonly string[]).includes(estado ?? '') ? (estado as Status) : null
  const topic = tema && Object.hasOwn(contactTopicLabels, tema) ? (tema as Topic) : null
  const rows = await listContactMessagesAdmin({ status, topic })
  const filtered = Boolean(status || topic)

  return (
    <>
      <PageHeader
        title="Mensajes"
        description="Lo que llega desde el formulario de contacto. Cada mensaje también llega por correo a la directiva."
        action={
          <a
            href="/api/admin/exportar/mensajes"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            <Download aria-hidden="true" /> Exportar CSV
          </a>
        }
      />
      <ListToolbar>
        <FilterSelect
          name="estado"
          label="Estado"
          value={status ?? ''}
          options={CONTACT_STATUSES.map((value) => ({ value, label: inboxStatusLabels[value] }))}
          allLabel="Todos los estados"
        />
        <FilterSelect
          name="tema"
          label="Tema"
          value={topic ?? ''}
          options={optionsFromLabels(contactTopicLabels)}
          allLabel="Todos los temas"
        />
      </ListToolbar>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox aria-hidden="true" />}
          title={filtered ? 'Sin resultados' : 'No hay mensajes'}
        >
          {filtered ? 'Prueba con otro filtro.' : 'Los mensajes del formulario de contacto aparecen aquí.'}
        </EmptyState>
      ) : (
        <ResourceList label="Mensajes de contacto">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.name}
              href={`/admin/mensajes/${row.id}`}
              subtitle={`${contactTopicLabels[row.topic]} · ${formatLongDateTime(row.createdAt)} · ${row.message.slice(0, 80)}`}
              badges={<InboxStatusBadge status={row.status} />}
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
