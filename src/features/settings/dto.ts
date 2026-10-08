import type { siteSettings } from '@/db/schema'

/** Lo único de la configuración que sale del servidor en la Fase 0. */
export type ClubIdentityDTO = {
  clubName: string
  shortName: string
  foundedOn: string
}

type SettingsRow = Pick<typeof siteSettings.$inferSelect, 'clubName' | 'shortName' | 'foundedOn'>

export function toClubIdentityDTO(row: SettingsRow): ClubIdentityDTO {
  return { clubName: row.clubName, shortName: row.shortName, foundedOn: row.foundedOn }
}
