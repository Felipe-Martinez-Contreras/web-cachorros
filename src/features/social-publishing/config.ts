import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { siteSettings } from '@/db/schema'
import { env } from '@/lib/env'
import { facebookChannel } from './channels/facebook'
import type { PublishChannel } from './channels/types'
import { type PublishAvailability, publishAvailability } from './lib/rules'
import { type FacebookSettings, readFacebookSettings } from './lib/settings'

// Configuración de Facebook: los secretos vienen del entorno (nunca de la BD) y los ajustes, del panel.

export async function loadFacebookSettings(): Promise<FacebookSettings> {
  const [row] = await db
    .select({ socialPublishing: siteSettings.socialPublishing })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return readFacebookSettings(row?.socialPublishing)
}

/** ¿Se puede publicar con este entorno y estos ajustes? */
export function facebookAvailability(settings: Pick<FacebookSettings, 'enabled'>): PublishAvailability {
  return publishAvailability({
    pageId: env.FACEBOOK_PAGE_ID,
    token: env.FACEBOOK_PAGE_TOKEN,
    siteEnv: env.SITE_ENV,
    allowNonProduction: env.FACEBOOK_ALLOW_NON_PRODUCTION,
    enabled: settings.enabled,
  })
}

/** El canal de Facebook, o `null` si faltan el id o el token de la página. */
export function facebook(): PublishChannel | null {
  if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_TOKEN) return null
  return facebookChannel({
    pageId: env.FACEBOOK_PAGE_ID,
    token: env.FACEBOOK_PAGE_TOKEN,
    baseUrl: env.FACEBOOK_GRAPH_URL,
  })
}
