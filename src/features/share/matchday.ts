import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, siteSettings, sponsors } from '@/db/schema'
import { readFacebookSettings } from '@/features/social-publishing/lib/settings'
import { isSponsorVisible } from '@/features/sponsors/queries'
import type { MatchdayData } from './dto'
import { shortHash } from './lib/cards'

// Lo que agrega «Próximo partido» (matchday) a una tarjeta: el auspiciador de Configuración → Destacados y
// las 3 fotos de Configuración → Facebook (o las elegidas para una publicación). Las fotos marcadas
// «contiene menores» nunca salen del sitio (6.3): se descartan aquí, aunque ya estuvieran elegidas.

type Assets = {
  sponsor: string | null
  photos: ({ id: string; file: string; focalX: number; focalY: number } | null)[]
}

/** El auspiciador de las tarjetas (Configuración → Destacados) si está vigente; si no, `null`. */
export async function loadCardSponsor(): Promise<string | null> {
  const [row] = await db
    .select({ name: sponsors.name })
    .from(siteSettings)
    .innerJoin(sponsors, eq(sponsors.id, siteSettings.shareCardSponsorId))
    .where(and(eq(siteSettings.id, 1), isSponsorVisible()))
    .limit(1)
  return row?.name ?? null
}

async function loadAssets(override: readonly (string | null)[] | undefined): Promise<Assets> {
  const [settings] = await db
    .select({ sponsorId: siteSettings.shareCardSponsorId, socialPublishing: siteSettings.socialPublishing })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  const ids = [0, 1, 2].map(
    (index) => (override ?? readFacebookSettings(settings?.socialPublishing).photos ?? [])[index] ?? null,
  )
  const wanted = ids.filter((id): id is string => id !== null)
  const [[sponsor], media] = await Promise.all([
    settings?.sponsorId
      ? db
          .select({ name: sponsors.name })
          .from(sponsors)
          .where(and(eq(sponsors.id, settings.sponsorId), isSponsorVisible()))
          .limit(1)
      : [],
    wanted.length > 0
      ? db
          .select({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            focalX: mediaAssets.focalX,
            focalY: mediaAssets.focalY,
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
    sponsor: sponsor?.name ?? null,
    photos: ids.map((id) => {
      const row = media.find((item) => item.id === id)
      return row?.variants
        ? { id: row.id, file: row.variants.master, focalX: row.focalX, focalY: row.focalY }
        : null
    }),
  }
}

/** Auspiciador y fotos de la tarjeta, listos para dibujarla (las fotos se tratan en `images.ts`). */
export async function loadMatchday(override?: readonly (string | null)[]): Promise<MatchdayData> {
  const assets = await loadAssets(override)
  return {
    sponsor: assets.sponsor,
    photoSources: assets.photos.map((photo) =>
      photo ? { file: photo.file, focalX: photo.focalX, focalY: photo.focalY } : null,
    ),
    photos: [null, null, null],
  }
}

/**
 * Revisión del matchday para la versión de «Próximo partido»: cambia si cambian las fotos, su punto focal o
 * el auspiciador, o si una foto pasa a «contiene menores» (deja de usarse). Así la URL de la tarjeta cambia y
 * la caché (disco y Cloudflare) se renueva. Sin caché propia a propósito: un cambio en una foto con menores
 * debe notarse en la petición siguiente.
 */
export async function matchdayRevision(override?: readonly (string | null)[]): Promise<string> {
  const assets = await loadAssets(override)
  return shortHash([
    assets.sponsor ?? '',
    ...assets.photos.map((photo) => (photo ? `${photo.id}@${photo.focalX},${photo.focalY}` : '-')),
  ])
}
