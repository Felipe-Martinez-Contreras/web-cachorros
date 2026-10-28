import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { getMatchAdmin } from '@/features/matches/admin-queries'
import { CardPreview } from '@/features/share/components/card-preview'
import { elegirFotosPublicacion, publicarOProgramarPartido } from '@/features/social-publishing/actions'
import {
  manualPublishDraft,
  matchFacebookState,
  scheduleDefault,
} from '@/features/social-publishing/admin-queries'
import { ManualPhotosForm } from '@/features/social-publishing/components/forms'
import { FacebookPublishSection } from '@/features/social-publishing/components/publish-section'
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
  // Fotos elegidas solo para este post (`?fotos=`); si no vienen, las de Facebook → Ajustes.
  const { fotos } = await searchParams
  const chosen = parsePhotos(typeof fotos === 'string' ? fotos : null)
  // El formulario solo hace falta si no hay publicación o si la anterior se descartó.
  const needsForm = !state.publication || state.publication.status === 'descartado'
  const draft = state.kind && needsForm ? await manualPublishDraft(id, chosen) : null
  // Al publicar o programar se vuelve a la ficha del partido, que muestra el estado.
  const backHref = `/admin/partidos/${id}`

  return (
    <>
      <PageHeader
        title="Publicar en Facebook"
        description={`${match.seriesName}: ${match.homeName} vs ${match.awayName}`}
        back={{ href: `/admin/partidos/${id}`, label: 'Partido' }}
      />
      {!needsForm ? (
        <FacebookPublishSection
          status={state}
          publication={state.publication}
          canSchedule={state.canSchedule}
          schedule={null}
          caption=""
          backHref={backHref}
          help=""
          action={publicarOProgramarPartido.bind(null, id, null)}
        />
      ) : !draft ? (
        <Alert variant="warning" title="Este partido no se puede publicar">
          Se publica la previa de un partido programado o postergado, o el resultado de uno finalizado.
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <figure className="grid content-start gap-2">
            <CardPreview
              src={draft.previewUrl}
              cached={draft.previewCached}
              alt={`Tarjeta «${publicationKindLabels[draft.kind]}» que se subirá a Facebook`}
              className="max-w-sm"
            />
            <figcaption className="text-sm text-neutral-600">
              {publicationKindLabels[draft.kind]} · la imagen 4:5 que se subirá
              {chosen ? ', con las fotos elegidas para este post.' : '.'}
            </figcaption>
          </figure>
          <div className="grid content-start gap-8">
            <FacebookPublishSection
              status={state}
              publication={state.publication}
              canSchedule={state.canSchedule}
              schedule={scheduleDefault(state.kickoffAt)}
              caption={draft.caption}
              backHref={backHref}
              help="Se armó con los datos del partido."
              action={publicarOProgramarPartido.bind(null, id, chosen ? encodePhotos(chosen) : null)}
            />
            {draft.kind === 'proximo' && (
              <section aria-labelledby="fotos-del-post" className="grid gap-3">
                <h2 id="fotos-del-post" className="text-lg font-bold">
                  Fotos de esta publicación
                </h2>
                <p className="text-neutral-600">
                  Por defecto se usan las de Facebook → Ajustes. Si las cambias aquí, la vista previa se
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
