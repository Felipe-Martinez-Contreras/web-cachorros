import { safeExternalUrl, whatsappUrl } from '@/lib/links'

/** Enlaces de un auspiciador, en el orden en que se ofrecen (especificación 6.10). Lógica pura. */
export const SPONSOR_LINKS = ['web', 'instagram', 'whatsapp'] as const
export type SponsorLink = (typeof SPONSOR_LINKS)[number]

export const sponsorLinkLabels: Record<SponsorLink, string> = {
  web: 'Sitio web',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
}

export type SponsorLinkSource = {
  websiteUrl: string | null
  instagramUrl: string | null
  whatsappE164: string | null
}

/** Destino real de cada enlace; los marcadores `[COMPLETAR]` y textos que no son direcciones no cuentan. */
export function sponsorTargets(source: SponsorLinkSource): Partial<Record<SponsorLink, string>> {
  const targets: Partial<Record<SponsorLink, string>> = {}
  const web = safeExternalUrl(source.websiteUrl)
  const instagram = safeExternalUrl(source.instagramUrl)
  if (web) targets.web = web
  if (instagram) targets.instagram = instagram
  if (source.whatsappE164?.startsWith('+')) targets.whatsapp = whatsappUrl(source.whatsappE164)
  return targets
}

/** El enlace pedido (`?a=`) o, si no viene o no existe, el primero disponible. */
export function resolveSponsorTarget(source: SponsorLinkSource, requested: string | null): string | null {
  const targets = sponsorTargets(source)
  const wanted = SPONSOR_LINKS.find((link) => link === requested)
  if (wanted && targets[wanted]) return targets[wanted]
  for (const link of SPONSOR_LINKS) if (targets[link]) return targets[link]
  return null
}
