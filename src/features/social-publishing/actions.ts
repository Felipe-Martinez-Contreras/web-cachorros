'use server'

import { and, eq, inArray } from 'drizzle-orm'
import * as z from 'zod'
import { db, type Tx } from '@/db/client'
import { matches, siteSettings, socialPublications } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { assertPublishableMedia } from '@/features/media/guards'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/session'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { publicationKindLabels } from '@/lib/labels'
import { runAction } from '@/lib/run-action'
import { facebook, facebookAvailability, loadFacebookSettings } from './config'
import { encodePhotos, manualPhotosSchema, parsePhotos } from './lib/photos'
import { publicationKindFor } from './lib/rules'
import { facebookSettingsSchema, nextFacebookSettings, readFacebookSettings } from './lib/settings'
import { type ProcessOutcome, processPublication } from './publish'
import { manualPublishSchema } from './schemas'

// Acciones del panel para Facebook (Configuración → Facebook y la ficha de cada partido). Publicar llama a
// la Graph API después de la transacción: la fila queda en la cola aunque Facebook falle, y la tarea
// `tick` la reintenta.

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
          publishResults: data.publishResults,
          photos: next.photos?.filter(Boolean).length ?? 0,
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

/**
 * Publica a mano la tarjeta de un partido (previa o resultado, según su estado) con el texto revisado.
 * Lo que ya se publicó (o está en la cola) no se vuelve a publicar.
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
      const id = assertId(matchId)
      const [match] = await tx
        .select({ status: matches.status })
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
      const [row] = await tx
        .insert(socialPublications)
        .values({
          channel: 'facebook',
          kind,
          subjectKey: id,
          matchId: id,
          trigger: 'manual',
          message: data.message,
          photoIds,
          requestedBy: user.id,
        })
        .onConflictDoNothing()
        .returning({ id: socialPublications.id })
      if (!row) throw new Rejection('Este partido ya se publicó en Facebook (o está en la cola).')
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
        .set({ status: 'descartado', nextAttemptAt: null })
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
