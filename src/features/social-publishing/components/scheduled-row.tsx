import Link from 'next/link'
import { ActionButton } from '@/components/admin/action-button'
import { Badge } from '@/components/ui/badge'
import { CardPreview } from '@/features/share/components/card-preview'
import { formatLongDateTime } from '@/lib/format'
import { publicationKindLabels } from '@/lib/labels'
import { cambiarFechaProgramada, cancelarProgramada } from '../actions'
import type { ScheduledPublicationDTO } from '../admin-queries'
import { RescheduleForm } from './forms'

/** «Cambiar» (fecha y hora, en un `<details>`) y «Cancelar» de una programada. */
export function ScheduledActions({ id, current }: { id: string; current: { date: string; time: string } }) {
  return (
    <div className="grid gap-3">
      <details className="rounded-md border border-neutral-200 p-3">
        <summary className="min-h-12 cursor-pointer content-center font-semibold">Cambiar fecha</summary>
        <div className="mt-3">
          <RescheduleForm action={cambiarFechaProgramada.bind(null, id)} current={current} />
        </div>
      </details>
      <div>
        <ActionButton
          action={cancelarProgramada.bind(null, id)}
          successMessage="Publicación cancelada."
          confirm={{
            title: '¿Cancelar esta publicación programada?',
            description: 'No saldrá en Facebook. Puedes volver a programarla desde su página.',
            confirmLabel: 'Cancelar la publicación',
          }}
        >
          Cancelar
        </ActionButton>
      </div>
    </div>
  )
}

/** Una programada en Facebook → Programadas: qué, cuándo, la tarjeta y sus acciones. */
export function ScheduledRow({ publication }: { publication: ScheduledPublicationDTO }) {
  const what = `${publicationKindLabels[publication.kind]} · ${publication.subject}`
  return (
    <li className="grid gap-4 rounded-lg border border-neutral-200 p-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="w-40 max-w-full">
        {publication.preview ? (
          <CardPreview
            src={publication.preview.src}
            cached={publication.preview.cached}
            alt={`Tarjeta: ${what}`}
          />
        ) : (
          <p className="text-sm text-neutral-600">
            La tarjeta ya no se puede armar: revisa la jornada o el partido.
          </p>
        )}
      </div>
      <div className="grid content-start gap-3">
        <div className="grid gap-1">
          <h3 className="font-bold">
            <Link href={publication.href} className="underline-offset-4 hover:underline">
              {what}
            </Link>
          </h3>
          <p>
            <Badge variant="neutral">Programada</Badge>{' '}
            <span className="font-semibold">
              Se publicará el {formatLongDateTime(publication.scheduledAt)}
            </span>
          </p>
          <p className="text-sm text-neutral-600">
            La tarjeta se arma al publicar, con los datos de ese momento.
          </p>
        </div>
        <ScheduledActions id={publication.id} current={publication.current} />
      </div>
    </li>
  )
}
