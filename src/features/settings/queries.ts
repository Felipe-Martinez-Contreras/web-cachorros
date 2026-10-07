import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { siteSettings } from '@/db/schema'
import { type ClubIdentityDTO, toClubIdentityDTO } from './dto'

/** Lectura sin caché para el panel. La versión pública cacheada (`"use cache"` + tag) llega en la Fase 1. */
export async function getClubIdentity(): Promise<ClubIdentityDTO | null> {
  const [row] = await db
    .select({
      clubName: siteSettings.clubName,
      shortName: siteSettings.shortName,
      foundedOn: siteSettings.foundedOn,
    })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return row ? toClubIdentityDTO(row) : null
}
