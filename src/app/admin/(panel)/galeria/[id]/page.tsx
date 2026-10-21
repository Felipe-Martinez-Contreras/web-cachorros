import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import {
  actualizarAlbum,
  actualizarFotoAlbum,
  agregarFotoAlbum,
  eliminarAlbum,
  quitarFotoAlbum,
} from '@/features/gallery/actions'
import { eventOptions, getAlbumAdmin } from '@/features/gallery/admin-queries'
import { AlbumUploader } from '@/features/gallery/components/album-uploader'
import { AlbumForm, AlbumItemForm, AlbumItemUpdateForm } from '@/features/gallery/components/forms'
import { newsFormOptions } from '@/features/news/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'

export const metadata: Metadata = { title: 'Editar álbum' }

const sectionClass = 'mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6'
const detailsClass = 'rounded-lg border border-neutral-200 bg-paper p-3'
const summaryClass = 'flex min-h-12 cursor-pointer items-center font-semibold'

export default async function EditAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('gallery:write')
  const { id } = await params
  const [album, { matches }, events] = await Promise.all([
    isUuid(id) ? getAlbumAdmin(id) : null,
    newsFormOptions(),
    eventOptions(),
  ])
  if (!album) notFound()
  const nextOrder = album.items.reduce((max, item) => Math.max(max, item.sortOrder + 1), 0)

  return (
    <>
      <PageHeader
        title={album.title}
        description={
          album.isPublished ? (
            <>
              En el sitio:{' '}
              <Link href={`/galeria/${album.slug}`} className="underline">
                /galeria/{album.slug}
              </Link>
            </>
          ) : (
            'Borrador: no aparece en la galería.'
          )
        }
        back={{ href: '/admin/galeria', label: 'Galería' }}
      />
      <AlbumForm
        action={actualizarAlbum.bind(null, album.id)}
        cover={album.cover}
        matches={matches}
        events={events}
        defaults={{
          title: album.title,
          takenOn: album.takenOn ?? '',
          coverMediaId: album.cover?.id ?? '',
          matchId: album.matchId ?? '',
          eventId: album.eventId ?? '',
          isPublished: album.isPublished,
          containsMinors: album.containsMinors,
          minorsConsent: album.minorsConsentConfirmedAt !== null,
        }}
      />

      <section aria-labelledby="fotos-titulo" className={sectionClass}>
        <h2 id="fotos-titulo" className="text-lg font-bold">
          Fotos ({album.items.length})
        </h2>
        <details className={detailsClass} open={album.items.length === 0}>
          <summary className={summaryClass}>Subir fotos al álbum</summary>
          <div className="pt-3">
            <AlbumUploader albumId={album.id} nextOrder={nextOrder} />
          </div>
        </details>
        <details className={detailsClass}>
          <summary className={summaryClass}>Agregar una foto de la biblioteca</summary>
          <div className="pt-3">
            <AlbumItemForm
              action={agregarFotoAlbum.bind(null, album.id)}
              defaults={{ mediaId: '', caption: '', sortOrder: String(nextOrder) }}
            />
          </div>
        </details>
        {album.items.length > 0 && (
          <ResourceList label="Fotos del álbum">
            {album.items.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.caption || item.media.alt || 'Foto sin descripción'}
                subtitle={`Orden ${item.sortOrder}`}
                badges={item.media.containsMinors && <Badge variant="soft">No se publica: menores</Badge>}
                media={
                  item.media.thumb ? (
                    // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                    <img src={item.media.thumb} alt="" className="size-12 rounded-sm object-cover" />
                  ) : undefined
                }
                actions={
                  <ActionButton
                    action={quitarFotoAlbum.bind(null, album.id, item.id)}
                    successMessage="Foto quitada del álbum."
                    confirm={{
                      title: '¿Quitar esta foto del álbum?',
                      description: 'La foto sigue en la biblioteca de medios.',
                      confirmLabel: 'Sí, quitar',
                    }}
                  >
                    Quitar
                  </ActionButton>
                }
              />
            ))}
          </ResourceList>
        )}
        {album.items.map((item, index) => (
          <details key={item.id} className={detailsClass}>
            <summary className={summaryClass}>Editar el pie y el orden de la foto {index + 1}</summary>
            <div className="pt-3">
              <AlbumItemUpdateForm
                action={actualizarFotoAlbum.bind(null, album.id, item.id)}
                defaults={{ caption: item.caption ?? '', sortOrder: String(item.sortOrder) }}
              />
            </div>
          </details>
        ))}
      </section>

      <DeleteSection
        what={`el álbum ${album.title}`}
        description="Las fotos salen del álbum, pero siguen en la biblioteca de medios."
        action={eliminarAlbum.bind(null, album.id)}
        redirectTo="/admin/galeria"
        buttonLabel="Eliminar álbum"
        successMessage="Álbum eliminado."
      />
    </>
  )
}
