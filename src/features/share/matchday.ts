import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, siteSettings, sponsors } from '@/db/schema'
import { readFacebookSettings, topLineModeOf } from '@/features/social-publishing/lib/settings'
import { isSponsorVisible } from '@/features/sponsors/queries'
import type { MatchdayData, MatchdayTopLine } from './dto'
import { shortHash } from './lib/cards'

// Lo que agrega el matchday («Próximo partido», «Jornada» y, la línea superior, «Programación») a una
// tarjeta: la línea sobre el título (Configuración → Facebook: el auspiciador de Configuración → Destacados,
// un texto o un logo) y las 3 fotos de Configuración → Facebook (o las elegidas para una publicación). Las
// fotos marcadas «contiene menores» nunca salen del sitio (6.3): se descartan aquí, aunque ya estuvieran
// elegidas.

type Photo = { id: string; file: string; focalX: number; focalY: number; focalZoom: number }
/** La línea superior y lo que la identifica para la revisión (el logo, por su id y su archivo). */
type TopLine = { line: MatchdayTopLine; key: string } | null

type Assets = { topLine: TopLine; photos: (Photo | null)[] }

async function loadSettings() {
  const [settings] = await db
    .select({ sponsorId: siteSettings.shareCardSponsorId, socialPublishing: siteSettings.socialPublishing })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return {
    sponsorId: settings?.sponsorId ?? null,
    facebook: readFacebookSettings(settings?.socialPublishing),
  }
}

async function resolveTopLine({
  sponsorId,
  facebook,
}: Awaited<ReturnType<typeof loadSettings>>): Promise<TopLine> {
  const mode = topLineModeOf(facebook, sponsorId !== null)
  if (mode === 'texto') {
    const text = facebook.topLine?.text?.trim()
    return text ? { line: { kind: 'texto', text }, key: `t:${text}` } : null
  }
  if (mode === 'auspiciador' && sponsorId) {
    const [sponsor] = await db
      .select({ name: sponsors.name })
      .from(sponsors)
      .where(and(eq(sponsors.id, sponsorId), isSponsorVisible()))
      .limit(1)
    return sponsor
      ? { line: { kind: 'texto', text: `Powered by ${sponsor.name}` }, key: `a:${sponsor.name}` }
      : null
  }
  const logoId = facebook.topLine?.logoId
  if (mode === 'logo' && logoId) {
    const [logo] = await db
      .select({ variants: mediaAssets.variants })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.id, logoId),
          eq(mediaAssets.kind, 'imagen'),
          eq(mediaAssets.containsMinors, false),
        ),
      )
      .limit(1)
    const file = logo?.variants?.png512 ?? logo?.variants?.master
    return file ? { line: { kind: 'logo', file, src: null }, key: `l:${logoId}:${file}` } : null
  }
  return null
}

/** La línea superior del matchday (también la usa «Programación»). */
export async function loadTopLine(): Promise<TopLine> {
  return resolveTopLine(await loadSettings())
}

async function loadAssets(override: readonly (string | null)[] | undefined): Promise<Assets> {
  const settings = await loadSettings()
  const ids = [0, 1, 2].map((index) => (override ?? settings.facebook.photos ?? [])[index] ?? null)
  const wanted = ids.filter((id): id is string => id !== null)
  const [topLine, media] = await Promise.all([
    resolveTopLine(settings),
    wanted.length > 0
      ? db
          .select({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            focalX: mediaAssets.focalX,
            focalY: mediaAssets.focalY,
            focalZoom: mediaAssets.focalZoom,
          })
          .from(mediaAssets)
          .where(
            and(
              inArray(mediaAssets.id, wanted),
              eq(mediaAssets.kind, 'imagen'),
              eq(mediaAssets.containsMinors, false),
            ),
          )
      : [],
  ])
  return {
    topLine,
    photos: ids.map((id) => {
      const row = media.find((item) => item.id === id)
      return row?.variants
        ? {
            id: row.id,
            file: row.variants.master,
            focalX: row.focalX,
            focalY: row.focalY,
            focalZoom: row.focalZoom,
          }
        : null
    }),
  }
}

/** Línea superior y fotos de la tarjeta, listas para dibujarla (las fotos se tratan en `images.ts`). */
export async function loadMatchday(override?: readonly (string | null)[]): Promise<MatchdayData> {
  const assets = await loadAssets(override)
  return {
    topLine: assets.topLine?.line ?? null,
    photoSources: assets.photos.map((photo) =>
      photo
        ? { file: photo.file, focalX: photo.focalX, focalY: photo.focalY, focalZoom: photo.focalZoom }
        : null,
    ),
    photos: [null, null, null],
  }
}

/** Revisión de la línea superior sola (la versión de «Programación»). */
export async function topLineRevision(): Promise<string> {
  return (await loadTopLine())?.key ?? ''
}

/**
 * Revisión del matchday para la versión de la tarjeta: cambia si cambian las fotos, su punto focal o su zoom,
 * o la línea superior, o si una foto pasa a «contiene menores» (deja de usarse). Así la URL de la tarjeta
 * cambia y la caché (disco y Cloudflare) se renueva. Sin caché propia a propósito: un cambio en una foto con
 * menores debe notarse en la petición siguiente.
 */
export async function matchdayRevision(override?: readonly (string | null)[]): Promise<string> {
  const assets = await loadAssets(override)
  return shortHash([
    assets.topLine?.key ?? '',
    ...assets.photos.map((photo) =>
      photo ? `${photo.id}@${photo.focalX},${photo.focalY},${photo.focalZoom}` : '-',
    ),
  ])
}
