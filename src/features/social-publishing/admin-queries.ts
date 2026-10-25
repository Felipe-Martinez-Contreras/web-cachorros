import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matches, series, socialPublications, teams } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { shareUrl, weekendTitle } from '@/features/share/lib/cards'
import { env } from '@/lib/env'
import { facebookAvailability, loadFacebookSettings } from './config'
import { publicationKindFor } from './lib/rules'
import type { FacebookSettings } from './lib/settings'
import { publicationContent } from './publish'

// Lo que muestra el panel de la publicación en Facebook. Solo DTOs: nunca el token.

export type PublicationDTO = {
  id: string
  kind: (typeof socialPublications.$inferSelect)['kind']
  status: (typeof socialPublications.$inferSelect)['status']
  trigger: (typeof socialPublications.$inferSelect)['trigger']
  /** De qué es: «Honor: Cachorros vs Rival» o el fin de semana. */
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

function toPublicationDTO(row: PublicationRow): PublicationDTO {
  const subject =
    row.kind === 'programacion'
      ? weekendTitle(row.subjectKey)
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

export type ManualPublishDraft = { kind: 'proximo' | 'resultado'; caption: string; previewUrl: string }

/** Lo que se muestra antes de publicar a mano: la tarjeta 4:5 que se subirá y el texto sugerido. */
export async function manualPublishDraft(matchId: string): Promise<ManualPublishDraft | null> {
  const state = await matchFacebookState(matchId)
  if (!state?.kind) return null
  const content = await publicationContent(state.kind, matchId)
  if (!content) return null
  const { request } = content
  return {
    kind: state.kind,
    caption: content.caption,
    previewUrl: shareUrl(request.template, request.id, request.format, content.version),
  }
}
