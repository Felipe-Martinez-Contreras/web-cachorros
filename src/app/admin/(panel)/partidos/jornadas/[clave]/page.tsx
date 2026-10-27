import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader, ResourceList } from '@/components/admin/resource-list'
import { Alert } from '@/components/ui/feedback'
import { elegirOpcionesJornada } from '@/features/share/actions'
import { jornadaAdmin, type ShareCardLink } from '@/features/share/admin-queries'
import { ShareCards } from '@/features/share/components/share-cards'
import { SHARE_FORMATS, type ShareFormat } from '@/features/share/lib/cards'
import { parseSeries } from '@/features/share/lib/jornada'
import { publicarJornadaEnFacebook } from '@/features/social-publishing/actions'
import {
  jornadaCardUrl,
  jornadaDraft,
  jornadaFacebookState,
} from '@/features/social-publishing/admin-queries'
import { JornadaOptionsForm, ManualPublishForm } from '@/features/social-publishing/components/forms'
import { PublicationRow } from '@/features/social-publishing/components/publication-row'
import { encodePhotos, parsePhotos } from '@/features/social-publishing/lib/photos'
import { requirePanelUser } from '@/lib/auth/session'
import { formatTime } from '@/lib/format'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Tarjeta de la jornada' }

type Props = {
  params: Promise<{ clave: string }>
  searchParams: Promise<{ series?: string | string[]; fotos?: string | string[] }>
}

const FORMATS: ShareFormat[] = ['vertical', 'cuadrado', 'historia', 'og']

export default async function JornadaPage({ params, searchParams }: Props) {
  const user = await requirePanelUser('matches:write')
  const { clave } = await params
  const jornada = await jornadaAdmin(clave)
  if (!jornada) notFound()
  const { series, fotos } = await searchParams
  // Lo elegido en «Series y fotos» viaja en la dirección; si no viene, todas las series y las fotos de siempre.
  const chosenSeries = parseSeries(typeof series === 'string' ? series : null)
  const chosenPhotos = parsePhotos(typeof fotos === 'string' ? fotos : null)
  const canPublish = can(user, 'social:write')
  const [draft, facebook] = await Promise.all([
    jornadaDraft(jornada.key, chosenSeries, chosenPhotos),
    canPublish ? jornadaFacebookState(jornada.key) : null,
  ])
  const marked = chosenSeries ?? jornada.defaultSeries
  const title = `${jornada.day} vs ${jornada.rivalName}`
  const urlOf = (format: ShareFormat) =>
    draft ? jornadaCardUrl(jornada.key, format, draft.version, chosenSeries, chosenPhotos) : ''
  const card: ShareCardLink | null = draft
    ? {
        template: 'jornada',
        label: 'Jornada',
        title,
        id: jornada.key,
        version: draft.version,
        slug: jornada.date,
        formats: FORMATS,
        urls: Object.fromEntries(FORMATS.map((format) => [format, urlOf(format)])),
      }
    : null

  return (
    <>
      <PageHeader
        title="Tarjeta de la jornada"
        description={`${title} · ${jornada.matches.length} series`}
        back={{ href: '/admin/partidos', label: 'Partidos' }}
      />
      {!draft ? (
        <Alert variant="warning" title="Las series elegidas ya no juegan en esta jornada">
          Vuelve a marcar las series que van en la tarjeta.
        </Alert>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <figure className="grid content-start gap-2">
            {/* biome-ignore lint/performance/noImgElement: la tarjeta ya viene en su tamaño final. */}
            <img
              src={urlOf('vertical')}
              width={SHARE_FORMATS.vertical.width}
              height={SHARE_FORMATS.vertical.height}
              alt={`Tarjeta de la jornada: ${title}`}
              className="h-auto w-full max-w-sm rounded-md border border-neutral-200 bg-ink"
            />
            <figcaption className="text-sm text-neutral-600">
              4:5, la que se sube a Facebook
              {chosenPhotos ? ', con las fotos elegidas para esta tarjeta.' : '.'}
            </figcaption>
          </figure>
          <div className="grid content-start gap-10">
            <section aria-labelledby="series-y-fotos" className="grid gap-3">
              <h2 id="series-y-fotos" className="text-lg font-bold">
                Series y fotos
              </h2>
              <p className="text-neutral-600">
                Por defecto van todas las series y las fotos de Configuración → Facebook. Lo que cambies aquí
                vale solo para esta tarjeta.
              </p>
              <JornadaOptionsForm
                action={elegirOpcionesJornada.bind(null, jornada.key)}
                jornadaKey={jornada.key}
                series={jornada.matches.map((match) => ({
                  value: match.seriesId,
                  label: `${match.seriesName} · ${formatTime(match.kickoffAt)} h`,
                }))}
                defaults={{
                  series: marked,
                  photo1: draft.photos[0] ?? '',
                  photo2: draft.photos[1] ?? '',
                  photo3: draft.photos[2] ?? '',
                }}
                previews={draft.photoPreviews}
              />
            </section>

            {card && (
              <section id="descargar" aria-labelledby="descargar-titulo" className="grid scroll-mt-20 gap-3">
                <h2 id="descargar-titulo" className="text-lg font-bold">
                  Descargar tarjeta
                </h2>
                <ShareCards cards={[card]} />
              </section>
            )}

            {facebook && (
              <section id="facebook" aria-labelledby="facebook-titulo" className="grid scroll-mt-20 gap-3">
                <h2 id="facebook-titulo" className="text-lg font-bold">
                  Publicar en Facebook
                </h2>
                {facebook.publication ? (
                  <ResourceList label="Publicación en Facebook">
                    <PublicationRow publication={facebook.publication} />
                  </ResourceList>
                ) : facebook.blockedReason ? (
                  <Alert variant="warning" title="Por ahora no se puede publicar">
                    {facebook.blockedReason}
                  </Alert>
                ) : (
                  <ManualPublishForm
                    action={publicarJornadaEnFacebook.bind(
                      null,
                      jornada.key,
                      chosenSeries ? chosenSeries.join(',') : null,
                      chosenPhotos ? encodePhotos(chosenPhotos) : null,
                    )}
                    caption={draft.caption}
                    backHref={`/admin/partidos/jornadas/${jornada.key}`}
                    help="Se armó con los datos de la jornada y las series marcadas. Puedes cambiarlo antes de publicar."
                  />
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </>
  )
}
