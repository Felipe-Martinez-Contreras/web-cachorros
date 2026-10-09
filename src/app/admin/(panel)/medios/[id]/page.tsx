import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { actualizarMedio, eliminarMedio } from '@/features/media/actions'
import { MediaEditForm } from '@/features/media/components/media-edit-form'
import { getMediaById, getMediaUsage } from '@/features/media/queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatNumber, formatShortDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Editar imagen' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('media:write')
  const { id } = await params
  if (!UUID.test(id)) notFound()
  const [media, usage] = await Promise.all([getMediaById(id), getMediaUsage(id)])
  if (!media) notFound()

  return (
    <>
      <PageHeader
        title="Editar imagen"
        back={{ href: '/admin/medios', label: 'Biblioteca de medios' }}
        description={
          <>
            {media.originalFilename ?? 'Sin nombre de archivo'} · {media.width} × {media.height} px ·{' '}
            {formatNumber(Math.round(media.bytes / 1024))} KB · subida el {formatShortDate(media.createdAt)}
          </>
        }
      />

      <MediaEditForm media={media} action={actualizarMedio.bind(null, media.id)} />

      <section aria-labelledby="uso-titulo" className="mt-8 grid max-w-2xl gap-3">
        <h2 id="uso-titulo" className="text-lg font-bold">
          Dónde se usa
        </h2>
        {usage.length === 0 ? (
          <p className="text-neutral-600">Esta imagen no se usa en ninguna parte del sitio.</p>
        ) : (
          <ul className="grid gap-1">
            {usage.map((item) => (
              <li key={item.label}>
                {item.label}: <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        )}

        {usage.length > 0 ? (
          <Alert title="No se puede eliminar todavía">
            Está en uso. Reemplázala en los lugares de la lista y después podrás eliminarla.
          </Alert>
        ) : (
          <div>
            <ActionButton
              action={eliminarMedio.bind(null, media.id)}
              variant="danger"
              redirectTo="/admin/medios"
              successMessage="Imagen eliminada."
              confirm={{
                title: '¿Eliminar esta imagen?',
                description: 'Se borra de la biblioteca y no se puede recuperar.',
                confirmLabel: 'Sí, eliminar',
              }}
            >
              Eliminar imagen
            </ActionButton>
          </div>
        )}
      </section>
    </>
  )
}
