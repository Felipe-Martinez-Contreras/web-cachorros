import { ResourceList } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/feedback'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import type { ActionResult } from '@/lib/action-result'
import { formatLongDateTime } from '@/lib/format'
import type { FacebookStatus, PublicationDTO } from '../admin-queries'
import { ScheduledNotice } from './facebook-notices'
import { ManualPublishForm, PublishOrScheduleForm } from './forms'
import { PublicationRow } from './publication-row'
import { ScheduledActions } from './scheduled-row'

type Action = (input: unknown) => Promise<ActionResult<unknown>>

/**
 * Sección «Publicar en Facebook» de una jornada o de un partido. Según la publicación:
 * - programada: «Se publicará el …» con «Cambiar fecha» y «Cancelar»;
 * - publicada, en la cola o con error: su estado (y reintentar o descartar);
 * - descartada o sin publicación: el motivo (si hubo) y el formulario «Publicar ahora» o «Programar».
 */
export function FacebookPublishSection({
  status,
  publication,
  canSchedule,
  schedule,
  caption,
  backHref,
  help,
  action,
}: {
  status: FacebookStatus
  publication: PublicationDTO | null
  /** Solo la previa (o la jornada) se programa; el resultado se publica en el momento. */
  canSchedule: boolean
  /** Hora sugerida para programar; `null` si ya no queda tiempo antes del partido. */
  schedule: { date: string; time: string } | null
  caption: string
  backHref: string
  help: string
  action: Action
}) {
  if (publication?.status === 'programada' && publication.scheduledAt) {
    return (
      <div className="grid gap-3">
        <ScheduledNotice notice={status.scheduledNotice} />
        <p>
          <Badge variant="neutral">Programada</Badge>{' '}
          <span className="font-semibold">Se publicará el {formatLongDateTime(publication.scheduledAt)}</span>
        </p>
        <ScheduledActions id={publication.id} current={toSantiagoWallTime(publication.scheduledAt)} />
      </div>
    )
  }
  if (publication && publication.status !== 'descartado') {
    return (
      <ResourceList label="Publicación en Facebook">
        <PublicationRow publication={publication} />
      </ResourceList>
    )
  }

  const allowNow = status.blockedReason === null
  const scheduleNow = canSchedule ? schedule : null
  return (
    <div className="grid gap-4">
      {publication?.status === 'descartado' && (
        <Alert variant="warning" title="La publicación anterior se descartó">
          {publication.lastError ?? 'Se descartó a mano.'} Puedes volver a publicarla o programarla.
        </Alert>
      )}
      {!allowNow && !scheduleNow ? (
        <Alert variant="warning" title="Por ahora no se puede publicar">
          {status.blockedReason}
        </Alert>
      ) : (
        <>
          {canSchedule && <ScheduledNotice notice={status.scheduledNotice} />}
          {scheduleNow ? (
            <PublishOrScheduleForm
              action={action}
              caption={caption}
              backHref={backHref}
              schedule={scheduleNow}
              allowNow={allowNow}
              help={help}
            />
          ) : (
            <ManualPublishForm action={action} caption={caption} backHref={backHref} help={help} />
          )}
        </>
      )}
    </div>
  )
}
