import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { getMatchAdmin } from '@/features/matches/admin-queries'
import { elegirFotosPublicacion, publicarEnFacebook } from '@/features/social-publishing/actions'
import { manualPublishDraft, matchFacebookState } from '@/features/social-publishing/admin-queries'
import { ManualPhotosForm, ManualPublishForm } from '@/features/social-publishing/components/forms'
import { encodePhotos, parsePhotos } from '@/features/social-publishing/lib/photos'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { publicationKindLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Publicar en Facebook' }

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ fotos?: string | string[] }> }

export default async function PublishMatchPage({ params, searchParams }: Props) {
  await requirePanelUser('social:write')
  const { id } = await params
  if (!isUuid(id)) notFound()
  const [match, state] = await Promise.all([getMatchAdmin(id), matchFacebookState(id)])
  if (!match || !state) notFound()
  // Ya publicado (o en la cola): la ficha del partido muestra su estado y el enlace.
  if (state.publication) redirect(`/admin/partidos/${id}`)
  // Fotos elegidas solo para este post (`?fotos=`); si no vienen, las de Configuración → Facebook.
  const { fotos } = await searchParams
  const chosen = parsePhotos(typeof fotos === 'string' ? fotos : null)
  const draft = state.kind && !state.blockedReason ? await manualPublishDraft(id, chosen) : null

  return (
    <>
      <PageHeader
        title="Publicar en Facebook"
        description={`${match.seriesName}: ${match.homeName} vs ${match.awayName}`}
        back={{ href: `/admin/partidos/${id}`, label: 'Partido' }}
      />
      {state.blockedReason ? (
        <Alert variant="warning" title="Por ahora no se puede publicar">
          {state.blockedReason}
        </Alert>
      ) : !draft ? (
        <Alert variant="warning" title="Este partido no se puede publicar">
          Se publica la previa de un partido programado o postergado, o el resultado de uno finalizado.
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <figure className="grid content-start gap-2">
            {/* biome-ignore lint/performance/noImgElement: la tarjeta ya viene en su tamaño final. */}
            <img
              src={draft.previewUrl}
              width={1080}
              height={1350}
              alt={`Tarjeta «${publicationKindLabels[draft.kind]}» que se subirá a Facebook`}
              className="h-auto w-full max-w-sm rounded-md border border-neutral-200"
            />
            <figcaption className="text-sm text-neutral-600">
              {publicationKindLabels[draft.kind]} · la imagen 4:5 que se subirá
              {chosen ? ', con las fotos elegidas para este post.' : '.'}
            </figcaption>
          </figure>
          <div className="grid content-start gap-8">
            <ManualPublishForm
              action={publicarEnFacebook.bind(null, id, chosen ? encodePhotos(chosen) : null)}
              caption={draft.caption}
              matchId={id}
            />
            {draft.kind === 'proximo' && (
              <section aria-labelledby="fotos-del-post" className="grid gap-3">
                <h2 id="fotos-del-post" className="text-lg font-bold">
                  Fotos de esta publicación
                </h2>
                <p className="text-neutral-600">
                  Por defecto se usan las de Configuración → Facebook. Si las cambias aquí, la vista previa se
                  actualiza y solo este post las lleva.
                </p>
                <ManualPhotosForm
                  action={elegirFotosPublicacion}
                  defaults={{
                    photo1: draft.photos[0] ?? '',
                    photo2: draft.photos[1] ?? '',
                    photo3: draft.photos[2] ?? '',
                  }}
                  previews={draft.photoPreviews}
                  matchId={id}
                />
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
