'use server'

import { and, eq, inArray, ne } from 'drizzle-orm'
import * as z from 'zod'
import { db, type Tx } from '@/db/client'
import { matches, siteSettings, socialPublications } from '@/db/schema'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { isClubMatch } from '@/features/matches/queries'
import { assertPublishableMedia } from '@/features/media/guards'
import { weekendOf } from '@/features/share/lib/cards'
import { parseJornadaKey, parseSeries } from '@/features/share/lib/jornada'
import { jornadaMatches, weekendCardOf } from '@/features/share/queries'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/session'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { formatLongDateTime } from '@/lib/format'
import { publicationKindLabels } from '@/lib/labels'
import { runAction } from '@/lib/run-action'
import { facebook, facebookAvailability, loadFacebookSettings } from './config'
import { encodePhotos, manualPhotosSchema, parsePhotos } from './lib/photos'
import { type PublicationKind, publicationKindFor } from './lib/rules'
import {
  firstKickoffOf,
  rivalOf,
  scheduleGuard,
  scheduleSnapshot,
  validateScheduledAt,
} from './lib/scheduling'
import { facebookSettingsSchema, nextFacebookSettings, readFacebookSettings } from './lib/settings'
import { type ProcessOutcome, processPublication, publicationContent } from './publish'
import { loadGuardMatches } from './scheduled'
import { manualPublishSchema, schedulePublishSchema, scheduleTimeSchema } from './schemas'

// Acciones del panel para Facebook (sección Facebook, la página de cada jornada y la de cada partido).
// Publicar llama a la Graph API después de la transacción: la fila queda en la cola aunque Facebook falle, y
// la tarea `tick` la reintenta. Programar solo deja la fila «programada»: la publica el tick a su hora.

/** Guarda los ajustes de la publicación en Facebook. */
export async function guardarFacebook(input: unknown): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'settings.facebook.update',
    permission: 'settings:write',
    entityType: 'site_settings',
    schema: facebookSettingsSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const [row] = await tx
        .select({ socialPublishing: siteSettings.socialPublishing })
        .from(siteSettings)
        .where(eq(siteSettings.id, 1))
        .for('update')
      if (!row) throw new Rejection('No encontramos la configuración del club. Avisa a soporte.')
      await assertPublishablePhotos(tx, [data.photo1, data.photo2, data.photo3])
      if (data.topLineMode === 'logo') {
        await assertPublishableMedia(tx, data.topLineLogo ?? null, 'topLineLogo')
      }
      const next = nextFacebookSettings(readFacebookSettings(row.socialPublishing), data, new Date())
      await tx
        .update(siteSettings)
        .set({ socialPublishing: { ...row.socialPublishing, facebook: next } })
        .where(eq(siteSettings.id, 1))
      return {
        id: '1',
        summary: `Cambió la configuración: Facebook (${data.enabled ? 'activada' : 'desactivada'})`,
        meta: {
          section: 'facebook',
          enabled: data.enabled,
          weekly: data.weekly,
          publishResults: data.publishResults,
          photos: next.photos?.filter(Boolean).length ?? 0,
          topLine: data.topLineMode,
        },
      }
    },
  })
}

/** Consulta la página con el token cargado en el servidor. No publica nada. */
export async function probarConexionFacebook(): Promise<ActionResult<{ name: string }>> {
  return runAction('social.facebook.test', async () => {
    const user = await requirePermission('settings:write')
    const channel = facebook()
    if (!channel) return fail('Falta cargar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN en el servidor.')
    const result = await channel.testConnection()
    await db.transaction((tx) =>
      audit(tx, user, 'social.facebook.test', {
        entityType: 'site_settings',
        entityId: '1',
        summary: `Probó la conexión con Facebook (${result.ok ? 'correcta' : 'con error'})`,
        meta: { ok: result.ok },
      }),
    )
    return result.ok ? ok({ name: result.name }) : fail(result.message)
  })
}

/** Cada foto del matchday debe existir y no estar marcada «contiene menores» (6.3). */
async function assertPublishablePhotos(tx: Tx, photos: readonly (string | null)[]): Promise<void> {
  for (const [index, photo] of photos.entries()) {
    await assertPublishableMedia(tx, photo ?? null, `photo${index + 1}`)
  }
}

/**
 * Elige las fotos del matchday solo para el post que se está preparando: valida y devuelve las 3 (como
 * texto para la dirección), sin guardar nada. La publicación las vuelve a validar al enviarse.
 */
export async function elegirFotosPublicacion(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction('social.publish.photos', async () => {
    await requirePermission('social:write')
    const parsed = manualPhotosSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error)
    const photos = [parsed.data.photo1, parsed.data.photo2, parsed.data.photo3]
    try {
      await db.transaction((tx) => assertPublishablePhotos(tx, photos))
    } catch (error) {
      if (!(error instanceof Rejection)) throw error
      return {
        ok: false,
        message: 'Revisa los campos marcados.',
        fieldErrors: error.field ? { [error.field]: [error.message] } : undefined,
      }
    }
    return ok({ id: encodePhotos(photos) })
  })
}

/** Rechaza si falta la página, el entorno no lo permite o está desactivada (con el motivo en español). */
async function assertCanPublish(): Promise<void> {
  const availability = facebookAvailability(await loadFacebookSettings())
  if (!availability.ok) throw new Rejection(availability.message)
}

/** Respuesta después de intentar publicar: el resultado o por qué quedó en la cola. */
function afterPublish(outcome: ProcessOutcome, id: string): ActionResult<{ id: string }> {
  if (outcome.status === 'publicado' || outcome.status === 'omitida') return ok({ id })
  if (outcome.status === 'descartado') return fail(outcome.message)
  return fail(
    outcome.status === 'incierto'
      ? `${outcome.message} Revisa la página de Facebook: si no aparece, usa «Reintentar».`
      : `No se pudo publicar: ${outcome.message} Quedó en la cola y se reintentará sola.`,
  )
}

type PublicationValues = typeof socialPublications.$inferInsert

/**
 * Toma el sujeto (partido o jornada) para publicarlo o programarlo. Una fila descartada (por un seguro o a
 * mano) se reutiliza desde cero; lo publicado, en curso o programado sigue bloqueado: devuelve `undefined`.
 */
async function claimSubject(tx: Tx, values: PublicationValues): Promise<{ id: string } | undefined> {
  const now = new Date()
  const [row] = await tx
    .insert(socialPublications)
    .values({ ...values, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [socialPublications.channel, socialPublications.kind, socialPublications.subjectKey],
      set: {
        matchId: values.matchId ?? null,
        trigger: values.trigger,
        message: values.message ?? null,
        photoIds: values.photoIds ?? null,
        seriesIds: values.seriesIds ?? null,
        status: values.status ?? 'pendiente',
        scheduledAt: values.scheduledAt ?? null,
        scheduledSnapshot: values.scheduledSnapshot ?? null,
        imageVersion: values.imageVersion ?? null,
        requestedBy: values.requestedBy ?? null,
        attempts: 0,
        lastError: null,
        nextAttemptAt: null,
        externalId: null,
        externalUrl: null,
        publishedAt: null,
        discardNotifiedAt: null,
        discardNotifyAttempts: 0,
        createdAt: now,
        updatedAt: now,
      },
      setWhere: eq(socialPublications.status, 'descartado'),
    })
    .returning({ id: socialPublications.id })
  return row
}

const TAKEN = {
  partido: {
    scheduled: 'Este partido ya está programado en Facebook: cámbiale la fecha o cancélalo.',
    taken: 'Este partido ya se publicó en Facebook (o está en la cola).',
  },
  jornada: {
    scheduled: 'Esta jornada ya está programada en Facebook: cámbiale la fecha o cancélala.',
    taken: 'Esta jornada ya se publicó en Facebook (o está en la cola).',
  },
} as const

/** Por qué no se pudo tomar el sujeto: ya está programado, o ya se publicó (o está en la cola). */
async function takenMessage(tx: Tx, kind: PublicationKind, key: string): Promise<string> {
  const [row] = await tx
    .select({ status: socialPublications.status })
    .from(socialPublications)
    .where(
      and(
        eq(socialPublications.channel, 'facebook'),
        eq(socialPublications.kind, kind),
        eq(socialPublications.subjectKey, key),
      ),
    )
    .limit(1)
  const messages = TAKEN[kind === 'jornada' ? 'jornada' : 'partido']
  return row?.status === 'programada' ? messages.scheduled : messages.taken
}

/** Texto igual al sugerido: se guarda `null` y se vuelve a armar al publicar con los datos vigentes. */
function sameText(message: string, suggested: string): boolean {
  const normalize = (text: string) => text.replace(/\r\n/g, '\n').trim()
  return normalize(message) === normalize(suggested)
}

/** La hora elegida en Santiago, validada contra el inicio del primer partido. */
function scheduledAtFrom(data: { date: string; time: string }, firstKickoff: Date | null): Date {
  if (!firstKickoff) throw new Rejection('No hay partidos programados para publicar.')
  const at = santiagoWallTime(data.date, data.time)
  const check = validateScheduledAt({ at, now: new Date(), firstKickoff })
  if (!check.ok) throw new Rejection(check.message, 'time')
  return at
}

/** El partido del club y lo que corresponde publicar de él, con las fotos elegidas ya revisadas. */
async function matchSelection(tx: Tx, matchId: string, photos: string | null) {
  const id = assertId(matchId)
  const [match] = await tx
    .select({
      status: matches.status,
      kickoffAt: matches.kickoffAt,
      clubSide: matches.clubSide,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
    })
    .from(matches)
    .where(and(eq(matches.id, id), isClubMatch))
  if (!match) throw new Rejection('No encontramos ese partido. Puede que lo hayan eliminado.')
  const kind = publicationKindFor(match.status)
  if (!kind) throw new Rejection('Este partido no se puede publicar en su estado actual.')
  // Las fotos llegan enlazadas desde la página: se vuelven a validar aquí.
  const photoIds = photos && kind === 'proximo' ? parsePhotos(photos) : null
  if (photos && kind === 'proximo' && !photoIds) {
    throw new Rejection('Las fotos elegidas ya no son válidas. Vuelve a elegirlas.')
  }
  if (photoIds) await assertPublishablePhotos(tx, photoIds)
  return { id, match, kind, photoIds }
}

/**
 * Publica a mano la tarjeta de un partido (previa o resultado, según su estado) con el texto revisado.
 * Lo que ya se publicó (o está en la cola o programado) no se vuelve a publicar.
 */
export async function publicarEnFacebook(
  matchId: string,
  photos: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const queued = await mutate({
    action: 'social.publish.request',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: manualPublishSchema,
    input,
    tags: [],
    write: async (tx, data, user) => {
      await assertCanPublish()
      const { id, kind, photoIds } = await matchSelection(tx, matchId, photos)
      const row = await claimSubject(tx, {
        channel: 'facebook',
        kind,
        subjectKey: id,
        matchId: id,
        trigger: 'manual',
        message: data.message,
        photoIds,
        requestedBy: user.id,
      })
      if (!row) throw new Rejection(await takenMessage(tx, kind, id))
      return {
        id: row.id,
        summary: `Publicó en Facebook: ${publicationKindLabels[kind].toLowerCase()}`,
        meta: { kind, matchId: id, ownPhotos: photoIds !== null },
      }
    },
  })
  if (!queued.ok) return queued
  const channel = facebook()
  if (!channel) return fail('Falta cargar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN en el servidor.')
  return afterPublish(await processPublication(queued.data.id, channel), queued.data.id)
}

/**
 * Programa la previa de un partido: sale sola a la hora elegida (en Santiago), antes del inicio. Se permite
 * con Facebook apagado: el panel avisa que no saldrá hasta activarlo.
 */
export async function programarEnFacebook(
  matchId: string,
  photos: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'social.schedule.request',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: schedulePublishSchema,
    input,
    tags: [],
    write: async (tx, data, user) => {
      const { id, match, kind, photoIds } = await matchSelection(tx, matchId, photos)
      if (kind !== 'proximo' || match.status !== 'programado') {
        throw new Rejection(
          'Solo se programa la previa de un partido programado. El resultado se publica en el momento.',
        )
      }
      const at = scheduledAtFrom(data, match.kickoffAt)
      const content = await publicationContent('proximo', id, photoIds)
      if (!content) throw new Rejection('Este partido ya no se puede publicar.')
      const row = await claimSubject(tx, {
        channel: 'facebook',
        kind,
        subjectKey: id,
        matchId: id,
        trigger: 'manual',
        status: 'programada',
        message: sameText(data.message, content.caption) ? null : data.message,
        photoIds,
        scheduledAt: at,
        scheduledSnapshot: scheduleSnapshot(rivalOf(match), [{ id, kickoffAt: match.kickoffAt }]),
        imageVersion: content.version,
        requestedBy: user.id,
      })
      if (!row) throw new Rejection(await takenMessage(tx, kind, id))
      return {
        id: row.id,
        summary: `Programó en Facebook: próximo partido (${formatLongDateTime(at)})`,
        meta: { kind, matchId: id, at: at.toISOString(), ownPhotos: photoIds !== null },
      }
    },
  })
}

/** La jornada, sus series y fotos elegidas (revisadas de nuevo) y los partidos que van en la tarjeta. */
async function jornadaSelection(tx: Tx, key: string, series: string | null, photos: string | null) {
  const jornada = parseJornadaKey(key)
  if (!jornada) throw new Rejection('Esta jornada no existe. Vuelve a Partidos.')
  // Las series y las fotos llegan enlazadas desde la página: se vuelven a validar aquí.
  const seriesIds = series ? parseSeries(series) : null
  const photoIds = photos ? parsePhotos(photos) : null
  if ((series && !seriesIds) || (photos && !photoIds)) {
    throw new Rejection('Las series o las fotos elegidas ya no son válidas. Vuelve a elegirlas.')
  }
  const playing = await jornadaMatches(key, seriesIds)
  const [first] = playing
  if (!first) throw new Rejection('Esta jornada ya no tiene partidos programados.')
  if (seriesIds && playing.length !== seriesIds.length) {
    throw new Rejection('Una de las series elegidas ya no juega en esta jornada. Vuelve a elegirlas.')
  }
  if (photoIds) await assertPublishablePhotos(tx, photoIds)
  await assertNotInWeekendPost(tx, key, jornada.date)
  return { jornada, seriesIds, photoIds, playing, first }
}

/**
 * Publica a mano la tarjeta de una jornada (`clave` = día y rival) con las series y fotos elegidas y el texto
 * revisado. Una jornada se publica una sola vez, y no si ya salió como la programación del fin de semana.
 */
export async function publicarJornadaEnFacebook(
  key: string,
  series: string | null,
  photos: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const queued = await mutate({
    action: 'social.publish.request',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: manualPublishSchema,
    input,
    tags: [],
    write: async (tx, data, user) => {
      await assertCanPublish()
      const { jornada, seriesIds, photoIds, playing, first } = await jornadaSelection(tx, key, series, photos)
      const row = await claimSubject(tx, {
        channel: 'facebook',
        kind: 'jornada',
        subjectKey: key,
        // El primer partido: así el panel muestra los equipos de la publicación.
        matchId: first.id,
        trigger: 'manual',
        message: data.message,
        photoIds,
        seriesIds,
        requestedBy: user.id,
      })
      if (!row) throw new Rejection(await takenMessage(tx, 'jornada', key))
      return {
        id: row.id,
        summary: 'Publicó en Facebook: jornada',
        meta: { kind: 'jornada', date: jornada.date, series: playing.length, ownPhotos: photoIds !== null },
      }
    },
  })
  if (!queued.ok) return queued
  const channel = facebook()
  if (!channel) return fail('Falta cargar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN en el servidor.')
  return afterPublish(await processPublication(queued.data.id, channel), queued.data.id)
}

/**
 * Programa la tarjeta de una jornada con las series y fotos elegidas: sale sola a la hora elegida (en
 * Santiago), antes del primer partido. Se permite con Facebook apagado: el panel avisa que no saldrá.
 */
export async function programarJornadaEnFacebook(
  key: string,
  series: string | null,
  photos: string | null,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'social.schedule.request',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: schedulePublishSchema,
    input,
    tags: [],
    write: async (tx, data, user) => {
      const { jornada, seriesIds, photoIds, playing, first } = await jornadaSelection(tx, key, series, photos)
      const at = scheduledAtFrom(data, firstKickoffOf(playing))
      const content = await publicationContent('jornada', key, photoIds, seriesIds)
      if (!content) throw new Rejection('Esta jornada ya no se puede publicar.')
      const row = await claimSubject(tx, {
        channel: 'facebook',
        kind: 'jornada',
        subjectKey: key,
        matchId: first.id,
        trigger: 'manual',
        status: 'programada',
        message: sameText(data.message, content.caption) ? null : data.message,
        photoIds,
        seriesIds,
        scheduledAt: at,
        scheduledSnapshot: scheduleSnapshot(jornada.rivalId, playing),
        imageVersion: content.version,
        requestedBy: user.id,
      })
      if (!row) throw new Rejection(await takenMessage(tx, 'jornada', key))
      return {
        id: row.id,
        summary: `Programó en Facebook: jornada (${formatLongDateTime(at)})`,
        meta: { kind: 'jornada', date: jornada.date, series: playing.length, at: at.toISOString() },
      }
    },
  })
}

/** Cambia la hora de una programada: se vuelve a validar contra los partidos vigentes. */
export async function cambiarFechaProgramada(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'social.schedule.update',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: scheduleTimeSchema,
    input,
    tags: [],
    write: async (tx, data) => {
      const [row] = await tx
        .select({
          id: socialPublications.id,
          kind: socialPublications.kind,
          message: socialPublications.message,
          snapshot: socialPublications.scheduledSnapshot,
        })
        .from(socialPublications)
        .where(and(eq(socialPublications.id, assertId(id)), eq(socialPublications.status, 'programada')))
        .for('update')
      if (!row?.snapshot) throw new Rejection('Esta publicación ya no está programada. Recarga la página.')
      const current = await loadGuardMatches(
        row.snapshot.matches.map((match) => match.id),
        tx,
      )
      const at = scheduledAtFrom(data, firstKickoffOf(current))
      const guard = scheduleGuard({
        snapshot: row.snapshot,
        current,
        scheduledAt: at,
        messageEdited: row.message !== null,
        now: new Date(),
      })
      if (!guard.ok) throw new Rejection(`${guard.message} Cancélala y vuelve a programarla.`)
      await tx
        .update(socialPublications)
        .set({ scheduledAt: at, updatedAt: new Date() })
        .where(eq(socialPublications.id, row.id))
      return {
        id: row.id,
        summary: `Cambió la hora de la publicación programada en Facebook: ${publicationKindLabels[row.kind].toLowerCase()} (${formatLongDateTime(at)})`,
        meta: { kind: row.kind, at: at.toISOString() },
      }
    },
  })
}

/** Cancela una programada: la fila se borra y la jornada o el partido se puede volver a programar. */
export async function cancelarProgramada(id: string): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'social.schedule.cancel',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: z.unknown(),
    input: null,
    tags: [],
    write: async (tx) => {
      const [row] = await tx
        .delete(socialPublications)
        .where(and(eq(socialPublications.id, assertId(id)), eq(socialPublications.status, 'programada')))
        .returning({ id: socialPublications.id, kind: socialPublications.kind })
      if (!row) throw new Rejection('Esta publicación ya no está programada. Recarga la página.')
      return {
        id: row.id,
        summary: `Canceló la publicación programada en Facebook: ${publicationKindLabels[row.kind].toLowerCase()}`,
        meta: { kind: row.kind },
      }
    },
  })
}

/**
 * Si el fin de semana es solo esta jornada, su programación automática ya publica esta misma tarjeta: si
 * esa publicación salió (o está en la cola), publicar la jornada sería el mismo post dos veces.
 */
async function assertNotInWeekendPost(tx: Tx, key: string, date: string): Promise<void> {
  const saturday = weekendOf(date)
  const [weekendPost] = await tx
    .select({ id: socialPublications.id })
    .from(socialPublications)
    .where(
      and(
        eq(socialPublications.channel, 'facebook'),
        eq(socialPublications.kind, 'programacion'),
        eq(socialPublications.subjectKey, saturday),
        ne(socialPublications.status, 'descartado'),
      ),
    )
    .limit(1)
  if (weekendPost && (await weekendCardOf(saturday))?.jornadaKey === key) {
    throw new Rejection('Esta jornada ya salió (o está por salir) en la programación del fin de semana.')
  }
}

/** Vuelve a la cola una publicación con error, sin confirmar o descartada, y la intenta de inmediato. */
export async function reintentarPublicacion(id: string): Promise<ActionResult<{ id: string }>> {
  const queued = await mutate({
    action: 'social.publish.retry',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: z.unknown(),
    input: null,
    tags: [],
    write: async (tx) => {
      await assertCanPublish()
      const [row] = await tx
        .update(socialPublications)
        .set({ status: 'pendiente', attempts: 0, nextAttemptAt: null, lastError: null })
        .where(
          and(
            eq(socialPublications.id, assertId(id)),
            inArray(socialPublications.status, ['error', 'incierto', 'descartado']),
          ),
        )
        .returning({ id: socialPublications.id, kind: socialPublications.kind })
      if (!row) throw new Rejection('Esta publicación ya no se puede reintentar. Recarga la página.')
      return {
        id: row.id,
        summary: `Reintentó publicar en Facebook: ${publicationKindLabels[row.kind].toLowerCase()}`,
        meta: { kind: row.kind },
      }
    },
  })
  if (!queued.ok) return queued
  const channel = facebook()
  if (!channel) return fail('Falta cargar FACEBOOK_PAGE_ID y FACEBOOK_PAGE_TOKEN en el servidor.')
  return afterPublish(await processPublication(queued.data.id, channel), queued.data.id)
}

/** Saca de la cola una publicación que no se quiere enviar (o que ya se revisó a mano en Facebook). */
export async function descartarPublicacion(id: string): Promise<ActionResult<{ id: string }>> {
  return mutate({
    action: 'social.publish.discard',
    permission: 'social:write',
    entityType: 'social_publication',
    schema: z.unknown(),
    input: null,
    tags: [],
    write: async (tx) => {
      const [row] = await tx
        .update(socialPublications)
        // Descartada a mano: no hace falta avisar por correo.
        .set({ status: 'descartado', nextAttemptAt: null, discardNotifiedAt: new Date() })
        .where(
          and(
            eq(socialPublications.id, assertId(id)),
            inArray(socialPublications.status, ['pendiente', 'error', 'incierto']),
          ),
        )
        .returning({ id: socialPublications.id, kind: socialPublications.kind })
      if (!row) throw new Rejection('Esta publicación ya no se puede descartar. Recarga la página.')
      return {
        id: row.id,
        summary: `Descartó la publicación en Facebook: ${publicationKindLabels[row.kind].toLowerCase()}`,
        meta: { kind: row.kind },
      }
    },
  })
}
