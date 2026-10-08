import { count } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, news, teams } from '@/db/schema'
import { seedClub } from './club'
import { seedContent } from './content'
import { buildSeedMedia } from './media'
import { seedSport } from './sport'
import { upsert } from './util'

export type SeedOptions = {
  /** «Hoy» para calcular las fechas relativas. */
  now: Date
  /** Deja un partido de Honor en curso, con eventos, para mostrar la franja EN VIVO. */
  live: boolean
  /** Carpeta de subidas (`UPLOADS_DIR`) donde se guardan las imágenes de ejemplo. */
  uploadsDir: string
  siteEnv: string
}

export type SeedResult = {
  media: number
  players: number
  matches: number
  events: number
  usedClubFiles: { crest: boolean; hero: boolean }
}

/**
 * Carga los datos de ejemplo (especificación, sección 13). Es idempotente (ids deterministas + *upsert*),
 * determinista (semilla fija) y usa fechas relativas a hoy, para que la demo siempre tenga partidos
 * jugados y por jugar.
 */
export async function runSeed(options: SeedOptions): Promise<SeedResult> {
  if (options.siteEnv === 'production') {
    const [[teamCount], [newsCount]] = await Promise.all([
      db.select({ n: count() }).from(teams),
      db.select({ n: count() }).from(news),
    ])
    if ((teamCount?.n ?? 0) > 0 || (newsCount?.n ?? 0) > 0) {
      throw new Error(
        'El seed no corre en producción sobre una base con contenido: sobrescribiría datos reales. No se tocó nada.',
      )
    }
  }

  // Las imágenes se procesan antes de abrir la transacción (escriben archivos y tardan unos segundos).
  const media = await buildSeedMedia(options.uploadsDir)

  const sport = await db.transaction(async (tx) => {
    await upsert(tx, mediaAssets, media.rows)
    const seeded = await seedSport({ tx, now: options.now, live: options.live, media })
    const club = await seedClub({ tx, now: options.now, media, sport: seeded })
    await seedContent({ tx, now: options.now, media, sport: seeded, club })
    return seeded
  })

  return { media: media.rows.length, ...sport.counts, usedClubFiles: media.usedClubFiles }
}
