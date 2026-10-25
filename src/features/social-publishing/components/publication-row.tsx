import { ActionButton } from '@/components/admin/action-button'
import { ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { formatLongDateTime } from '@/lib/format'
import { publicationKindLabels, publicationStatusLabels } from '@/lib/labels'
import { descartarPublicacion, reintentarPublicacion } from '../actions'
import type { PublicationDTO } from '../admin-queries'

const STATUS_VARIANT = {
  pendiente: 'neutral',
  publicando: 'neutral',
  publicado: 'success',
  error: 'danger',
  incierto: 'accent',
  descartado: 'outline',
} as const

const RETRYABLE = new Set(['error', 'incierto', 'descartado'])
const DISCARDABLE = new Set(['pendiente', 'error', 'incierto'])

/** Una publicación en Facebook: estado, error, enlace al post y, si corresponde, reintentar o descartar. */
export function PublicationRow({
  publication,
  showKind = true,
}: {
  publication: PublicationDTO
  showKind?: boolean
}) {
  const { status } = publication
  const when = publication.publishedAt ?? publication.createdAt
  return (
    <ResourceRow
      title={
        showKind ? `${publicationKindLabels[publication.kind]} · ${publication.subject}` : publication.subject
      }
      subtitle={
        <>
          {status === 'publicado' ? 'Publicado' : 'Creado'} el {formatLongDateTime(when)}
          {publication.trigger === 'manual' ? ' · a mano' : ' · automática'}
          {publication.attempts > 1 && ` · ${publication.attempts} intentos`}
          {publication.lastError && status !== 'publicado' && (
            <span className="mt-1 block text-danger">{publication.lastError}</span>
          )}
        </>
      }
      badges={<Badge variant={STATUS_VARIANT[status]}>{publicationStatusLabels[status]}</Badge>}
      actions={
        <>
          {publication.externalUrl && (
            <a
              href={publication.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center font-semibold text-link underline"
            >
              Ver en Facebook
            </a>
          )}
          {RETRYABLE.has(status) && (
            <ActionButton
              action={reintentarPublicacion.bind(null, publication.id)}
              successMessage="Publicado en Facebook."
              confirm={
                status === 'incierto'
                  ? {
                      title: '¿Reintentar la publicación?',
                      description:
                        'No sabemos si llegó a Facebook. Revisa la página primero: si ya está, reintentar la duplicaría.',
                      confirmLabel: 'Reintentar',
                    }
                  : undefined
              }
            >
              Reintentar
            </ActionButton>
          )}
          {DISCARDABLE.has(status) && (
            <ActionButton
              action={descartarPublicacion.bind(null, publication.id)}
              successMessage="Publicación descartada."
              confirm={{
                title: '¿Descartar esta publicación?',
                description: 'No se enviará a Facebook. Puedes reintentarla después si cambias de opinión.',
                confirmLabel: 'Descartar',
              }}
            >
              Descartar
            </ActionButton>
          )}
        </>
      }
    />
  )
}
