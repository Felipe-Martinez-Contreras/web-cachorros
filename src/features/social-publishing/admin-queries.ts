import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matches, mediaAssets, series, socialPublications, teams } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { shareUrl, weekendTitle } from '@/features/share/lib/cards'
import { encodeSeries, parseJornadaKey } from '@/features/share/lib/jornada'
import { env } from '@/lib/env'
import { formatLongDate, fromIsoDate } from '@/lib/format'
import { facebookAvailability, loadFacebookSettings } from './config'
import { encodePhotos } from './lib/photos'
import { publicationKindFor } from './lib/rules'
import type { FacebookSettings } from './lib/settings'
import { publicationContent } from './publish'

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
  }
}

export type FacebookPanelState = {
  settings: FacebookSettings
  /** El id y el token están cargados en el servidor. */
  configured: boolean
  /** Por qué no se publica, si no se puede. */
  blockedReason: string | null
  /** Solo para avisar que es staging con publicación permitida a propósito. */
  nonProductionAllowed: boolean
  publications: PublicationDTO[]
  /** Miniaturas de las 3 fotos del matchday (por campo del formulario). */
  photoPreviews: Record<string, MediaThumbDTO | null>
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

/** Estado de Configuración → Facebook: ajustes, si se puede publicar y las últimas publicaciones. */
export async function facebookPanelState(limit = 20): Promise<FacebookPanelState> {
  const settings = await loadFacebookSettings()
  const availability = facebookAvailability(settings)
  const rows = await selectPublications().orderBy(desc(socialPublications.createdAt)).limit(limit)
  return {
    settings,
    configured: Boolean(env.FACEBOOK_PAGE_ID && env.FACEBOOK_PAGE_TOKEN),
    blockedReason: availability.ok ? null : availability.message,
    nonProductionAllowed: env.SITE_ENV !== 'production' && env.FACEBOOK_ALLOW_NON_PRODUCTION,
    publications: rows.map(toPublicationDTO),
    photoPreviews: await photoThumbs(settings.photos ?? []),
  }
}

export type MatchFacebookState = {
  /** Lo que corresponde publicar según el estado del partido (`null`: nada). */
  kind: 'proximo' | 'resultado' | null
  /** La publicación ya hecha (o en la cola) de ese tipo. */
  publication: PublicationDTO | null
  blockedReason: string | null
}

/** Sección «Facebook» de la ficha de un partido. */
export async function matchFacebookState(matchId: string): Promise<MatchFacebookState | null> {
  const [match] = await db
    .select({ status: matches.status })
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
  const availability = facebookAvailability(await loadFacebookSettings())
  return {
    kind,
    publication: row ? toPublicationDTO(row) : null,
    blockedReason: availability.ok ? null : availability.message,
  }
}

export type ManualPublishDraft = {
  kind: 'proximo' | 'resultado'
  caption: string
  previewUrl: string
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
    previewUrl: chosen
      ? `/api/admin/tarjetas/${matchId}?fotos=${encodeURIComponent(encodePhotos(chosen))}&v=${content.version}`
      : shareUrl(request.template, request.id, request.format, content.version),
    photos: current,
    photoPreviews: await photoThumbs(current),
  }
}

export type JornadaFacebookState = {
  /** La publicación ya hecha (o en la cola) de la jornada. */
  publication: PublicationDTO | null
  blockedReason: string | null
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
  const availability = facebookAvailability(await loadFacebookSettings())
  return {
    publication: row ? toPublicationDTO(row) : null,
    blockedReason: availability.ok ? null : availability.message,
  }
}

export type JornadaDraft = {
  caption: string
  version: string
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
  return {
    caption: content.caption,
    version: content.version,
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
