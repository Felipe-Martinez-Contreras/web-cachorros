import 'server-only'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  boardMembers,
  documents,
  mediaAssets,
  seasons,
  series,
  siteSettings,
  staffAssignments,
  staffMembers,
  trainingSchedules,
  venues,
} from '@/db/schema'
import { DOCUMENT_FILENAME } from '@/features/media/lib/upload-rules'
import { tags } from '@/lib/cache-tags'
import { toIsoDate } from '@/lib/format'
import { mediaUrl, toImageDTO } from '@/lib/images/dto'
import { safeExternalUrl } from '@/lib/links'
import type {
  BoardMemberDTO,
  ClubPlaceDTO,
  DocumentCategory,
  DonationDTO,
  TrainingSeriesDTO,
  TransparencyDocumentDTO,
  TransparencyDTO,
} from './dto'
import { bankTransferText } from './lib/place'

/** Integrantes vigentes de la directiva, en su orden (especificación 6.12). */
export async function getCurrentBoard(): Promise<BoardMemberDTO[]> {
  'use cache'
  cacheTag(tags.club(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: boardMembers.id,
      fullName: boardMembers.fullName,
      roleTitle: boardMembers.roleTitle,
      publicEmail: boardMembers.publicEmail,
      termStart: boardMembers.termStart,
      termEnd: boardMembers.termEnd,
      photo: {
        variants: mediaAssets.variants,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        lqip: mediaAssets.lqip,
        credit: mediaAssets.credit,
        focalX: mediaAssets.focalX,
        focalY: mediaAssets.focalY,
        containsMinors: mediaAssets.containsMinors,
      },
    })
    .from(boardMembers)
    .leftJoin(mediaAssets, eq(mediaAssets.id, boardMembers.photoMediaId))
    .where(eq(boardMembers.isCurrent, true))
    .orderBy(asc(boardMembers.sortOrder), asc(boardMembers.fullName))

  return rows.map(({ photo, ...row }) => ({
    ...row,
    photo: photo?.containsMinors ? null : toImageDTO(photo),
  }))
}

// Año del documento: el de su fecha o, si no tiene, el de su publicación (en Chile).
const documentYear = sql<
  number | null
>`extract(year from coalesce(${documents.documentDate}, (${documents.publishedAt} at time zone 'America/Santiago')::date))::int`

/**
 * Documentos publicados para `/club/transparencia`, filtrados por categoría y año (formulario GET), con
 * las categorías y los años que existen para armar los filtros.
 */
export async function getTransparency(filters: {
  category: DocumentCategory | null
  year: number | null
}): Promise<TransparencyDTO> {
  'use cache'
  cacheTag(tags.club(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      category: documents.category,
      periodLabel: documents.periodLabel,
      documentDate: documents.documentDate,
      publishedAt: documents.publishedAt,
      description: documents.description,
      year: documentYear,
      storageKey: mediaAssets.storageKey,
      bytes: mediaAssets.bytes,
    })
    .from(documents)
    .innerJoin(mediaAssets, eq(mediaAssets.id, documents.fileMediaId))
    .where(and(eq(documents.isPublished, true), eq(mediaAssets.mime, 'application/pdf')))
    .orderBy(
      desc(sql`coalesce(${documents.documentDate}, ${documents.publishedAt}::date)`),
      asc(documents.title),
    )

  const all: TransparencyDocumentDTO[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    periodLabel: row.periodLabel,
    date: row.documentDate ?? (row.publishedAt ? toIsoDate(row.publishedAt) : null),
    year: row.year,
    description: row.description,
    url: mediaUrl(`${row.storageKey}/${DOCUMENT_FILENAME}`),
    bytes: row.bytes,
  }))
  return {
    documents: all.filter(
      (document) =>
        (!filters.category || document.category === filters.category) &&
        (!filters.year || document.year === filters.year),
    ),
    categories: [...new Set(all.map((document) => document.category))],
    years: [
      ...new Set(all.map((document) => document.year).filter((year): year is number => year !== null)),
    ].sort((a, b) => b - a),
  }
}

/**
 * Horarios de entrenamiento por serie activa (6.9 y 6.13), con el cuerpo técnico de la temporada actual.
 * `youth`: solo las series formativas y juveniles (página Divisiones formativas). Las series sin horarios
 * cargados igual aparecen en formativas (con su descripción); en La cancha, solo las que tienen horario.
 */
export async function getTrainingBySeries(scope: 'all' | 'youth'): Promise<TrainingSeriesDTO[]> {
  'use cache'
  cacheTag(tags.club(), tags.players(), tags.matches())
  cacheLife('hours')

  const seriesRows = await db
    .select({ id: series.id, slug: series.slug, name: series.name, description: series.description })
    .from(series)
    .where(
      and(
        eq(series.isActive, true),
        scope === 'youth' ? inArray(series.kind, ['formativa', 'juvenil']) : undefined,
      ),
    )
    .orderBy(asc(series.sortOrder), asc(series.name))
  if (seriesRows.length === 0) return []
  const ids = seriesRows.map((row) => row.id)

  const [sessions, coaches] = await Promise.all([
    db
      .select({
        seriesId: trainingSchedules.seriesId,
        weekday: trainingSchedules.weekday,
        startsAt: trainingSchedules.startsAt,
        endsAt: trainingSchedules.endsAt,
        notes: trainingSchedules.notes,
        venueName: venues.name,
      })
      .from(trainingSchedules)
      .leftJoin(venues, eq(venues.id, trainingSchedules.venueId))
      .where(inArray(trainingSchedules.seriesId, ids))
      .orderBy(asc(trainingSchedules.weekday), asc(trainingSchedules.startsAt)),
    db
      .select({
        seriesId: staffAssignments.seriesId,
        name: staffMembers.fullName,
        role: staffAssignments.role,
      })
      .from(staffAssignments)
      .innerJoin(staffMembers, eq(staffMembers.id, staffAssignments.staffId))
      .innerJoin(seasons, eq(seasons.id, staffAssignments.seasonId))
      .where(and(inArray(staffAssignments.seriesId, ids), eq(seasons.isCurrent, true)))
      .orderBy(asc(staffAssignments.sortOrder), asc(staffMembers.fullName)),
  ])

  return seriesRows
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      sessions: sessions
        .filter((session) => session.seriesId === row.id)
        .map(({ seriesId: _, startsAt, endsAt, ...session }) => ({
          ...session,
          startsAt: startsAt.slice(0, 5),
          endsAt: endsAt.slice(0, 5),
        })),
      coaches: coaches.filter((coach) => coach.seriesId === row.id).map(({ seriesId: _, ...coach }) => coach),
    }))
    .filter((row) => scope === 'youth' || row.sessions.length > 0)
}

/** Dirección y coordenadas de la cancha del club (Configuración; si faltan, la cancha propia). */
export async function getClubPlace(): Promise<ClubPlaceDTO> {
  'use cache'
  cacheTag(tags.settings(), tags.matches())
  cacheLife('hours')

  const [[settings], [home]] = await Promise.all([
    db
      .select({
        address: siteSettings.address,
        commune: siteSettings.commune,
        region: siteSettings.region,
        geoLat: siteSettings.geoLat,
        geoLng: siteSettings.geoLng,
      })
      .from(siteSettings)
      .where(eq(siteSettings.id, 1))
      .limit(1),
    db
      .select({ address: venues.address, geoLat: venues.geoLat, geoLng: venues.geoLng })
      .from(venues)
      .where(eq(venues.isHome, true))
      .limit(1),
  ])
  const lat = settings?.geoLat ?? home?.geoLat ?? null
  const lng = settings?.geoLng ?? home?.geoLng ?? null
  return {
    address: settings?.address ?? home?.address ?? null,
    commune: settings?.commune ?? null,
    region: settings?.region ?? null,
    geo: lat !== null && lng !== null ? { lat, lng } : null,
  }
}

/** Datos de «Apoya al club»: transferencia formateada y link de pago, solo si es una dirección real. */
export async function getDonationInfo(): Promise<DonationDTO> {
  'use cache'
  cacheTag(tags.settings())
  cacheLife('hours')

  const [row] = await db
    .select({ bankDetails: siteSettings.bankDetails, donationUrl: siteSettings.donationUrl })
    .from(siteSettings)
    .where(eq(siteSettings.id, 1))
    .limit(1)
  return {
    transferText: bankTransferText(row?.bankDetails),
    paymentUrl: safeExternalUrl(row?.donationUrl),
  }
}
