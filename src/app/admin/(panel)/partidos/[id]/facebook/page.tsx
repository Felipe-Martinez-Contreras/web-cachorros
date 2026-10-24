import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PageHeader } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { getMatchAdmin } from '@/features/matches/admin-queries'
import { publicarEnFacebook } from '@/features/social-publishing/actions'
import { manualPublishDraft, matchFacebookState } from '@/features/social-publishing/admin-queries'
import { ManualPublishForm } from '@/features/social-publishing/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { publicationKindLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Publicar en Facebook' }

export default async function PublishMatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('social:write')
  const { id } = await params
  if (!isUuid(id)) notFound()
  const [match, state] = await Promise.all([getMatchAdmin(id), matchFacebookState(id)])
  if (!match || !state) notFound()
  // Ya publicado (o en la cola): la ficha del partido muestra su estado y el enlace.
  if (state.publication) redirect(`/admin/partidos/${id}`)
  const draft = state.kind && !state.blockedReason ? await manualPublishDraft(id) : null

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
            {/* biome-ignore lint/performance/noImgElement: la tarjeta ya viene en su tamaño final desde /api/share. */}
            <img
              src={draft.previewUrl}
              width={1080}
              height={1350}
              alt={`Tarjeta «${publicationKindLabels[draft.kind]}» que se subirá a Facebook`}
              className="h-auto w-full max-w-sm rounded-md border border-neutral-200"
            />
            <figcaption className="text-sm text-neutral-600">
              {publicationKindLabels[draft.kind]} · la imagen 4:5 que se subirá.
            </figcaption>
          </figure>
          <ManualPublishForm
            action={publicarEnFacebook.bind(null, id)}
            caption={draft.caption}
            matchId={id}
          />
        </div>
      )}
    </>
  )
}
