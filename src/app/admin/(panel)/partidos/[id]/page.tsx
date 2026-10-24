import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader, ResourceList } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { actualizarPartido, cambiarEstadoPartido, eliminarPartido } from '@/features/matches/actions'
import { matchFormOptions } from '@/features/matches/admin-options'
import { getMatchAdmin } from '@/features/matches/admin-queries'
import { MatchForm, MatchStatusForm } from '@/features/matches/components/admin-forms'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import { matchShareCards } from '@/features/share/admin-queries'
import { ShareCards } from '@/features/share/components/share-cards'
import { matchFacebookState } from '@/features/social-publishing/admin-queries'
import { PublicationRow } from '@/features/social-publishing/components/publication-row'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { matchStatusLabels, publicationKindLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Editar partido' }

export default async function EditMatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('matches:write')
  const { id } = await params
  const [match, options, cards, facebook] = await Promise.all([
    isUuid(id) ? getMatchAdmin(id) : null,
    matchFormOptions(),
    isUuid(id) ? matchShareCards(id) : [],
    isUuid(id) ? matchFacebookState(id) : null,
  ])
  if (!match) notFound()
  const { date, time } = toSantiagoWallTime(match.kickoffAt)
  const finished = match.status === 'finalizado'
  const customLabel =
    match.roundLabel && match.roundLabel !== `Fecha ${match.roundNumber}` ? match.roundLabel : ''

  return (
    <>
      <PageHeader
        title={`${match.homeName} vs ${match.awayName}`}
        description={
          <>
            {match.seriesName} · {formatLongDateTime(match.kickoffAt)}{' '}
            <Badge className="ml-1 align-middle">{matchStatusLabels[match.status]}</Badge>
          </>
        }
        back={{ href: '/admin/partidos', label: 'Partidos' }}
        action={
          match.status !== 'cancelado' && (
            <div className="flex flex-wrap gap-2">
              {!finished && match.clubSide !== 'ninguno' && (
                <Link
                  href={`/admin/partidos/${match.id}/en-vivo`}
                  className={buttonVariants({ variant: 'primary', size: 'lg' })}
                >
                  {match.status === 'en_vivo' ? 'Volver a la consola' : 'Iniciar en vivo'}
                </Link>
              )}
              <Link
                href={`/admin/partidos/${match.id}/resultado`}
                className={buttonVariants({ variant: 'dark', size: 'lg' })}
              >
                {finished ? 'Corregir resultado' : 'Cargar resultado'}
              </Link>
            </div>
          )
        }
      />

      {cards.length > 0 && (
        <section aria-labelledby="tarjetas" className="mb-10 grid gap-3">
          <h2 id="tarjetas" className="scroll-mt-20 text-lg font-bold">
            Tarjetas para redes
          </h2>
          <p className="text-neutral-600">
            Se actualizan solas con cada gol o cambio del partido. Descárgalas o compártelas directo desde el
            celular.
          </p>
          <ShareCards cards={cards} />
        </section>
      )}

      {facebook?.kind && (
        <section aria-labelledby="facebook" className="mb-10 grid gap-3">
          <h2 id="facebook" className="scroll-mt-20 text-lg font-bold">
            Facebook
          </h2>
          {facebook.publication ? (
            <ResourceList label="Publicación en Facebook">
              <PublicationRow publication={facebook.publication} />
            </ResourceList>
          ) : facebook.blockedReason ? (
            <p className="text-neutral-600">{facebook.blockedReason}</p>
          ) : (
            <>
              <p className="text-neutral-600">
                Sube la tarjeta «{publicationKindLabels[facebook.kind]}» a la página del club. Antes de
                publicar ves la imagen y puedes cambiar el texto.
              </p>
              <div>
                <Link
                  href={`/admin/partidos/${match.id}/facebook`}
                  className={buttonVariants({ variant: 'outline', size: 'lg' })}
                >
                  Publicar en Facebook
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      <MatchForm
        action={actualizarPartido.bind(null, match.id)}
        options={options}
        defaults={{
          seriesId: match.seriesId,
          competitionId: match.competitionId,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          date,
          time,
          venueId: match.venueId ?? '',
          roundNumber: match.roundNumber ?? '',
          roundLabel: customLabel,
          notes: match.notes ?? '',
        }}
      />

      {!finished && (
        <section
          aria-labelledby="estado-titulo"
          className="mt-10 grid max-w-2xl gap-3 border-t border-neutral-200 pt-6"
        >
          <h2 id="estado-titulo" className="text-lg font-bold">
            Postergar, suspender o cancelar
          </h2>
          <p className="text-neutral-600">
            El partido no se borra: cambia de estado y el sitio lo avisa con el motivo. Cuando haya nueva
            fecha, vuelve a dejarlo «Programado» con su día y hora.
          </p>
          <MatchStatusForm
            action={cambiarEstadoPartido.bind(null, match.id)}
            defaults={{ status: 'postergado', date: '', time: '', notes: '' }}
          />
        </section>
      )}

      <DeleteSection
        what="este partido"
        description="Solo se puede eliminar un partido sin resultado cargado (por ejemplo, uno creado por error). Si no se va a jugar, cancélalo."
        action={eliminarPartido.bind(null, match.id)}
        redirectTo="/admin/partidos"
        buttonLabel="Eliminar partido"
        successMessage="Partido eliminado."
      />
    </>
  )
}
