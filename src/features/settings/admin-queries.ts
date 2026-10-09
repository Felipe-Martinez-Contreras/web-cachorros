import 'server-only'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, series, siteSettings, sponsors } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { formatCoordinates } from '@/features/teams/lib/parse-coordinates'
import { formatLongDate, fromIsoDate } from '@/lib/format'

// Lecturas del panel: sin caché. Aquí sí viajan los datos bancarios y los destinatarios de los avisos.

const text = (value: string | null | undefined) => value ?? ''
const list = (value: string[] | undefined) => (value ?? []).join(', ')

/** Toda la configuración con los valores tal como los espera cada formulario; `null` si falta la fila. */
export async function getSettingsAdmin() {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
  if (!row) return null

  const mediaIds = [row.hero?.mediaId, row.hero?.mobileMediaId, row.seoDefaults?.ogMediaId].filter(
    (id): id is string => Boolean(id),
  )
  const [mediaRows, seriesRows, sponsorRows] = await Promise.all([
    mediaIds.length > 0
      ? db
          .select({
            id: mediaAssets.id,
            variants: mediaAssets.variants,
            altText: mediaAssets.altText,
            containsMinors: mediaAssets.containsMinors,
          })
          .from(mediaAssets)
          .where(inArray(mediaAssets.id, mediaIds))
      : [],
    db
      .select({ value: series.id, label: series.name })
      .from(series)
      .where(eq(series.isActive, true))
      .orderBy(asc(series.sortOrder), asc(series.name)),
    db
      .select({ value: sponsors.id, label: sponsors.name })
      .from(sponsors)
      .orderBy(desc(sponsors.isActive), asc(sponsors.sortOrder), asc(sponsors.name)),
  ])
  const thumb = (id: string | undefined): MediaThumbDTO | null => {
    const media = mediaRows.find((item) => item.id === id)
    return media ? toMediaThumbDTO(media) : null
  }

  return {
    foundedOn: formatLongDate(fromIsoDate(row.foundedOn)),
    options: { series: seriesRows, sponsors: sponsorRows },
    previews: {
      mediaId: thumb(row.hero?.mediaId),
      mobileMediaId: thumb(row.hero?.mobileMediaId),
      ogMediaId: thumb(row.seoDefaults?.ogMediaId),
    },
    forms: {
      club: { clubName: row.clubName, shortName: row.shortName },
      contacto: {
        whatsapp: text(row.whatsappE164),
        phone: text(row.phoneE164),
        publicEmail: text(row.publicEmail),
        notifySocios: list(row.notifyRecipients?.socios),
        notifyAuspicios: list(row.notifyRecipients?.auspicios),
        notifyContacto: list(row.notifyRecipients?.contacto),
      },
      redes: {
        instagram: text(row.socialLinks?.instagram),
        facebook: text(row.socialLinks?.facebook),
        tiktok: text(row.socialLinks?.tiktok),
        youtube: text(row.socialLinks?.youtube),
        x: text(row.socialLinks?.x),
      },
      ubicacion: {
        address: text(row.address),
        commune: text(row.commune),
        region: text(row.region),
        location: formatCoordinates(row.geoLat, row.geoLng),
      },
      aportes: {
        holder: text(row.bankDetails?.holder),
        rut: text(row.bankDetails?.rut),
        bank: text(row.bankDetails?.bank),
        accountType: text(row.bankDetails?.accountType),
        accountNumber: text(row.bankDetails?.accountNumber),
        email: text(row.bankDetails?.email),
        donationUrl: text(row.donationUrl),
      },
      portada: {
        title: text(row.hero?.title),
        subtitle: text(row.hero?.subtitle),
        ctaLabel: text(row.hero?.ctaLabel),
        ctaHref: text(row.hero?.ctaHref),
        mediaId: text(row.hero?.mediaId),
        mobileMediaId: text(row.hero?.mobileMediaId),
      },
      destacados: {
        featuredSeriesId: text(row.featuredSeriesId),
        shareCardSponsorId: text(row.shareCardSponsorId),
      },
      seo: {
        description: text(row.seoDefaults?.description),
        ogMediaId: text(row.seoDefaults?.ogMediaId),
      },
    },
  }
}

export type SettingsAdmin = NonNullable<Awaited<ReturnType<typeof getSettingsAdmin>>>
