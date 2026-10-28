import 'server-only'
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matches, mediaAssets, series, siteSettings, socialPublications, teams } from '@/db/schema'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import { isClubMatch } from '@/features/matches/queries'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { isShareImageCached } from '@/features/share/images'
import { type ShareFormat, type ShareRequest, shareUrl, weekendTitle } from '@/features/share/lib/cards'
import { encodeSeries, parseJornadaKey } from '@/features/share/lib/jornada'
import { jornadaMatches, shareVersionOf } from '@/features/share/queries'
import { env } from '@/lib/env'
import { formatLongDate, fromIsoDate } from '@/lib/format'
import { publicationKindLabels } from '@/lib/labels'
import { facebookAvailability, loadFacebookSettings } from './config'
import { encodePhotos } from './lib/photos'
import { publicationKindFor } from './lib/rules'
import { defaultScheduleAt, firstKickoffOf } from './lib/scheduling'
import { type FacebookSettings, type TopLineMode, topLineModeOf } from './lib/settings'
import { publicationContent, shareRequestFor } from './publish'

// Lo que muestra el panel de la publicación en Facebook. Solo DTOs: nunca el token.

export type PublicationDTO = {
  id: string
  kind: (typeof socialPublications.$inferSelect)['kind']
  status: (typeof socialPublications.$inferSelect)['status']
  trigger: (typeof socialPublications.$inferSelect)['trigger']
  /** De qué es: «Honor: Cachorros vs Rival», el fin de semana o la jornada. */
  subject: string
  matchId: string | null
  attempts: number
  lastError: string | null
  externalUrl: string | null
  publishedAt: string | null
  createdAt: string
  /** Solo las programadas (o las que lo fueron): cuándo sale. */
  scheduledAt: string | null
}

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')

function selectPublications() {
  return db
    .select({
      id: socialPublications.id,
      kind: socialPublications.kind,
      status: socialPublications.status,
      trigger: socialPublications.trigger,
      subjectKey: socialPublications.subjectKey,
      matchId: socialPublications.matchId,
      attempts: socialPublications.attempts,
      lastError: socialPublications.lastError,
      externalUrl: socialPublications.externalUrl,
      publishedAt: socialPublications.publishedAt,
      createdAt: socialPublications.createdAt,
      scheduledAt: socialPublications.scheduledAt,
      photoIds: socialPublications.photoIds,
      seriesIds: socialPublications.seriesIds,
      seriesName: series.name,
      homeName: homeTeam.shortName,
      awayName: awayTeam.shortName,
    })
    .from(socialPublications)
    .leftJoin(matches, eq(matches.id, socialPublications.matchId))
    .leftJoin(series, eq(series.id, matches.seriesId))
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
}

type PublicationRow = Awaited<ReturnType<typeof selectPublications>>[number]

/** «Sábado 31 de octubre: Cachorros vs Rival» (la jornada guarda su primer partido en `match_id`). */
function jornadaSubject(row: PublicationRow): string {
  const date = parseJornadaKey(row.subjectKey)?.date
  const day = date ? formatLongDate(fromIsoDate(date)).replace(/ de \d{4}$/, '') : row.subjectKey
  const title = day.replace(/^./, (letter) => letter.toUpperCase())
  return row.homeName && row.awayName ? `${title}: ${row.homeName} vs ${row.awayName}` : title
}

function toPublicationDTO(row: PublicationRow): PublicationDTO {
  const subject =
    row.kind === 'programacion'
      ? weekendTitle(row.subjectKey)
      : row.kind === 'jornada'
        ? jornadaSubject(row)
        : row.homeName && row.awayName
          ? `${row.seriesName}: ${row.homeName} vs ${row.awayName}`
          : 'Partido eliminado'
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    trigger: row.trigger,
    subject,
    matchId: row.matchId,
    attempts: row.attempts,
    lastError: row.lastError,
    externalUrl: row.externalUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  }
}

/** Miniaturas de las fotos, por nombre de campo (`photo1`…`photo3`), para los formularios del panel. */
async function photoThumbs(
  photos: readonly (string | null)[],
): Promise<Record<string, MediaThumbDTO | null>> {
  const ids = photos.filter((id): id is string => Boolean(id))
  const rows =
    ids.length > 0
      ? await db
          .select({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            altText: mediaAssets.altText,
            containsMinors: mediaAssets.containsMinors,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, ids))
      : []
  return Object.fromEntries(
    [0, 1, 2].map((index) => {
      const row = rows.find((item) => item.id === photos[index])
      return [`photo${index + 1}`, row ? toMediaThumbDTO(row) : null]
    }),
  )
}

/** Aviso para lo programado cuando no se puede publicar. */
export const DISABLED_SCHEDULE_NOTICE =
  'Facebook está desactivado: lo programado no saldrá hasta que lo actives.'

export type FacebookStatus = {
  /** El id y el token están cargados en el servidor. */
  configured: boolean
  /** Por qué no se publica ahora, si no se puede. */
  blockedReason: string | null
  /** El aviso para lo programado (`null` si saldrá). */
  scheduledNotice: string | null
  /** Solo para avisar que es staging con publicación permitida a propósito. */
  nonProductionAllowed: boolean
}

function statusOf(settings: FacebookSettings): FacebookStatus {
  const availability = facebookAvailability(settings)
  return {
    configured: Boolean(env.FACEBOOK_PAGE_ID && env.FACEBOOK_PAGE_TOKEN),
    blockedReason: availability.ok ? null : availability.message,
    scheduledNotice: availability.ok
      ? null
      : availability.reason === 'desactivada'
        ? DISABLED_SCHEDULE_NOTICE
        : `Lo programado no saldrá: ${availability.message}`,
    nonProductionAllowed: env.SITE_ENV !== 'production' && env.FACEBOOK_ALLOW_NON_PRODUCTION,
  }
}

/** Si se puede publicar y qué avisar (encabezado de la sección Facebook y formularios). */
export async function facebookStatus(): Promise<FacebookStatus> {
  return statusOf(await loadFacebookSettings())
}

export type FacebookSettingsState = FacebookStatus & {
  settings: FacebookSettings
  /** Miniaturas de las 3 fotos del matchday y del logo de la línea superior (por campo del formulario). */
  photoPreviews: Record<string, MediaThumbDTO | null>
  /** La línea sobre «MATCHDAY» que se usa hoy (sin elegirla aún, la del auspiciador si hay uno). */
  topLineMode: TopLineMode
}

/** Facebook → Ajustes: los ajustes, si se puede publicar y las miniaturas de las fotos. */
export async function facebookSettingsState(): Promise<FacebookSettingsState> {
  const settings = await loadFacebookSettings()
  const [[club], [logo]] = await Promise.all([
    db
      .select({ sponsorId: siteSettings.shareCardSponsorId })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
    settings.topLine?.logoId
      ? db
          .select({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            altText: mediaAssets.altText,
            containsMinors: mediaAssets.containsMinors,
          })
          .from(mediaAssets)
          .where(eq(mediaAssets.id, settings.topLine.logoId))
      : [],
  ])
  return {
    ...statusOf(settings),
    settings,
    photoPreviews: {
      ...(await photoThumbs(settings.photos ?? [])),
      topLineLogo: logo ? toMediaThumbDTO(logo) : null,
    },
    topLineMode: topLineModeOf(settings, Boolean(club?.sponsorId)),
  }
}

/** Facebook → Publicadas: todo lo que no está programado, lo más reciente primero. */
export async function publishedPublications(limit = 30): Promise<PublicationDTO[]> {
  const rows = await selectPublications()
    .where(ne(socialPublications.status, 'programada'))
    .orderBy(desc(socialPublications.createdAt))
    .limit(limit)
  return rows.map(toPublicationDTO)
}

export type CardPreviewDTO = { src: string; cached: boolean }

/** Dirección de la tarjeta de una publicación (la del panel si lleva series o fotos elegidas). */
function cardSrc(request: ShareRequest, version: string): string {
  if (request.template === 'jornada') {
    return jornadaCardUrl(request.id, request.format, version, request.series ?? null, request.photos ?? null)
  }
  if (request.template === 'proximo' && request.photos) {
    return `/api/admin/tarjetas/${request.id}?fotos=${encodeURIComponent(encodePhotos(request.photos))}&v=${version}`
  }
  return shareUrl(request.template, request.id, request.format, version)
}

/**
 * Vista previa de una tarjeta sin dibujar nada: la versión vigente (solo consultas) y si ya está en el
 * disco. Si no está, el panel muestra «Ver imagen».
 */
async function cardPreview(request: ShareRequest): Promise<CardPreviewDTO | null> {
  const current = await shareVersionOf(request)
  if (!current) return null
  return {
    src: cardSrc(request, current.version),
    cached: await isShareImageCached(request, current.version),
  }
}

export type ScheduledPublicationDTO = PublicationDTO & {
  scheduledAt: string
  preview: CardPreviewDTO | null
  /** La página donde se preparó (jornada o partido). */
  href: string
  /** Fecha y hora programadas en Chile, para precargar «Cambiar fecha». */
  current: { date: string; time: string }
}

/** Dónde se prepara la publicación de una jornada o de un partido. */
export function publicationHref(kind: PublicationDTO['kind'], subjectKey: string): string {
  return kind === 'jornada'
    ? `/admin/partidos/jornadas/${subjectKey}`
    : `/admin/partidos/${subjectKey}/facebook`
}

/**
 * Facebook → Programadas: por hora, con su miniatura. Son pocas (una por jornada o partido próximo): la
 * versión de cada tarjeta se consulta una por una, sin dibujar nada.
 */
export async function scheduledPublications(): Promise<ScheduledPublicationDTO[]> {
  const rows = await selectPublications()
    .where(eq(socialPublications.status, 'programada'))
    .orderBy(asc(socialPublications.scheduledAt))
    .limit(50)
  const items: ScheduledPublicationDTO[] = []
  for (const row of rows) {
    if (!row.scheduledAt) continue
    const request = shareRequestFor(row.kind, row.subjectKey, row.photoIds, row.seriesIds)
    items.push({
      ...toPublicationDTO(row),
      scheduledAt: row.scheduledAt.toISOString(),
      preview: await cardPreview(request),
      href: publicationHref(row.kind, row.subjectKey),
      current: toSantiagoWallTime(row.scheduledAt),
    })
  }
  return items
}

/** Cuánto tiempo se avisa en el panel una programada que descartó un seguro. */
const DISCARD_NOTICE_MS = 3 * 24 * 60 * 60 * 1000

export type DiscardedScheduledDTO = { id: string; subject: string; reason: string; href: string }

/** Programadas que un seguro descartó hace poco y nadie volvió a programar: el aviso del panel. */
export async function recentlyDiscardedScheduled(now = new Date()): Promise<DiscardedScheduledDTO[]> {
  const rows = await selectPublications()
    .where(
      and(
        eq(socialPublications.status, 'descartado'),
        isNotNull(socialPublications.scheduledAt),
        isNotNull(socialPublications.lastError),
        // Lo descartado a mano queda con el aviso marcado y sin intentos: no es un seguro.
        or(isNull(socialPublications.discardNotifiedAt), gt(socialPublications.discardNotifyAttempts, 0)),
        gt(socialPublications.updatedAt, new Date(now.getTime() - DISCARD_NOTICE_MS)),
      ),
    )
    .orderBy(desc(socialPublications.updatedAt))
    .limit(10)
  return rows.map((row) => {
    const dto = toPublicationDTO(row)
    return {
      id: dto.id,
      subject: `${publicationKindLabels[dto.kind]} · ${dto.subject}`,
      reason: dto.lastError ?? '',
      href: publicationHref(dto.kind, row.subjectKey),
    }
  })
}

export type FacebookNotices = {
  /** Hay algo programado (para avisar si no saldrá). */
  hasScheduled: boolean
  scheduledNotice: string | null
  discarded: DiscardedScheduledDTO[]
}

/** Lo que el Inicio del panel avisa de Facebook: lo programado que no saldrá y lo descartado por un seguro. */
export async function facebookNotices(now = new Date()): Promise<FacebookNotices> {
  const [status, [scheduled], discarded] = await Promise.all([
    facebookStatus(),
    db
      .select({ id: socialPublications.id })
      .from(socialPublications)
      .where(eq(socialPublications.status, 'programada'))
      .limit(1),
    recentlyDiscardedScheduled(now),
  ])
  return { hasScheduled: Boolean(scheduled), scheduledNotice: status.scheduledNotice, discarded }
}

/** Hora sugerida para programar (día anterior a las 10:00 de Chile, o la próxima hora en punto). */
export function scheduleDefault(
  firstKickoff: Date | null,
  now = new Date(),
): { date: string; time: string } | null {
  const at = firstKickoff ? defaultScheduleAt({ firstKickoff, now }) : null
  return at ? toSantiagoWallTime(at) : null
}

export type MatchFacebookState = FacebookStatus & {
  /** Lo que corresponde publicar según el estado del partido (`null`: nada). */
  kind: 'proximo' | 'resultado' | null
  /** La publicación ya hecha, en la cola, programada o descartada, de ese tipo. */
  publication: PublicationDTO | null
  /** Solo la previa de un partido programado se puede programar. */
  canSchedule: boolean
  kickoffAt: Date
}

/** Sección «Facebook» de la ficha de un partido. */
export async function matchFacebookState(matchId: string): Promise<MatchFacebookState | null> {
  const [match] = await db
    .select({ status: matches.status, kickoffAt: matches.kickoffAt })
    .from(matches)
    .where(and(eq(matches.id, matchId), isClubMatch))
    .limit(1)
  if (!match) return null
  const kind = publicationKindFor(match.status)
  const [row] = kind
    ? await selectPublications()
        .where(
          and(
            eq(socialPublications.channel, 'facebook'),
            eq(socialPublications.kind, kind),
            eq(socialPublications.subjectKey, matchId),
          ),
        )
        .limit(1)
    : []
  return {
    ...(await facebookStatus()),
    kind,
    publication: row ? toPublicationDTO(row) : null,
    canSchedule: kind === 'proximo' && match.status === 'programado',
    kickoffAt: match.kickoffAt,
  }
}

export type ManualPublishDraft = {
  kind: 'proximo' | 'resultado'
  caption: string
  previewUrl: string
  /** La vista previa ya está dibujada (si no, «Ver imagen»). */
  previewCached: boolean
  /** Las fotos del matchday que lleva la vista previa (las elegidas o las de Configuración). */
  photos: (string | null)[]
  photoPreviews: Record<string, MediaThumbDTO | null>
}

/**
 * Lo que se muestra antes de publicar a mano: la tarjeta 4:5 que se subirá y el texto sugerido. Con
 * `photos` (elegidas para este post) la vista previa sale de la ruta del panel, que no es pública.
 */
export async function manualPublishDraft(
  matchId: string,
  photos: (string | null)[] | null = null,
): Promise<ManualPublishDraft | null> {
  const state = await matchFacebookState(matchId)
  if (!state?.kind) return null
  const chosen = state.kind === 'proximo' ? photos : null
  const content = await publicationContent(state.kind, matchId, chosen)
  if (!content) return null
  const { request } = content
  const current = chosen ?? (await loadFacebookSettings()).photos ?? [null, null, null]
  return {
    kind: state.kind,
    caption: content.caption,
    previewUrl: cardSrc(request, content.version),
    previewCached: await isShareImageCached(request, content.version),
    photos: current,
    photoPreviews: await photoThumbs(current),
  }
}

export type JornadaFacebookState = FacebookStatus & {
  /** La publicación ya hecha, en la cola, programada o descartada, de la jornada. */
  publication: PublicationDTO | null
}

/** Sección «Publicar en Facebook» de la página de una jornada. */
export async function jornadaFacebookState(key: string): Promise<JornadaFacebookState> {
  const [row] = await selectPublications()
    .where(
      and(
        eq(socialPublications.channel, 'facebook'),
        eq(socialPublications.kind, 'jornada'),
        eq(socialPublications.subjectKey, key),
      ),
    )
    .limit(1)
  return { ...(await facebookStatus()), publication: row ? toPublicationDTO(row) : null }
}

export type JornadaDraft = {
  caption: string
  version: string
  /** Inicio del primer partido de las series marcadas. */
  firstKickoff: Date | null
  /** Qué formatos de la tarjeta ya están dibujados (si no, «Ver imagen»). */
  cached: Partial<Record<ShareFormat, boolean>>
  /** Las fotos del matchday que lleva la tarjeta (las elegidas o las de Configuración). */
  photos: (string | null)[]
  photoPreviews: Record<string, MediaThumbDTO | null>
}

/** Texto sugerido y versión de la tarjeta de una jornada con las series y fotos elegidas (o las de siempre). */
export async function jornadaDraft(
  key: string,
  series: string[] | null,
  photos: (string | null)[] | null,
): Promise<JornadaDraft | null> {
  const content = await publicationContent('jornada', key, photos, series)
  if (!content) return null
  const current = photos ?? (await loadFacebookSettings()).photos ?? [null, null, null]
  const formats: ShareFormat[] = ['vertical', 'cuadrado']
  const cached = await Promise.all(
    formats.map((format) => isShareImageCached({ ...content.request, format }, content.version)),
  )
  return {
    caption: content.caption,
    version: content.version,
    firstKickoff: firstKickoffOf(await jornadaMatches(key, series)),
    cached: Object.fromEntries(formats.map((format, index) => [format, cached[index] ?? false])),
    photos: current,
    photoPreviews: await photoThumbs(current),
  }
}

/** Dirección de la tarjeta de una jornada en la ruta del panel (con las series y fotos elegidas). */
export function jornadaCardUrl(
  key: string,
  format: string,
  version: string,
  series: readonly string[] | null,
  photos: readonly (string | null)[] | null,
): string {
  const search = new URLSearchParams({
    ...(series ? { series: encodeSeries(series) } : {}),
    ...(photos ? { fotos: encodePhotos(photos) } : {}),
    v: version,
  })
  return `/api/admin/tarjetas/jornada/${key}/${format}?${search}`
}
