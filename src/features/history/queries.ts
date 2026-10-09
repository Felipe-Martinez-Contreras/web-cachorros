import 'server-only'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import { hallOfFame, historicKits, historyMilestones, honours, mediaAssets, series } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { tags } from '@/lib/cache-tags'
import { type ImageDTO, toImageDTO } from '@/lib/images/dto'
import { formatMilestoneDate, fromMilestoneDate, yearOf } from './lib/dates'
import type { HistorySection } from './sections'

const imageSelect = {
  variants: mediaAssets.variants,
  width: mediaAssets.width,
  height: mediaAssets.height,
  altText: mediaAssets.altText,
  lqip: mediaAssets.lqip,
  credit: mediaAssets.credit,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
}

// ── Sitio público: cacheado con el tag `history` (especificación 3.4) ────────────────────────────

export type MilestoneDTO = {
  id: string
  year: number
  /** «1 de abril de 1934», «1934» o `null` si la fecha todavía no se confirma. */
  dateLabel: string | null
  title: string
  body: string | null
  image: ImageDTO | null
  isPlaceholder: boolean
}

export async function getTimeline(): Promise<MilestoneDTO[]> {
  'use cache'
  cacheTag(tags.history(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: historyMilestones.id,
      occurredOn: historyMilestones.occurredOn,
      datePrecision: historyMilestones.datePrecision,
      title: historyMilestones.title,
      body: historyMilestones.body,
      isPlaceholder: historyMilestones.isPlaceholder,
      image: imageSelect,
    })
    .from(historyMilestones)
    .leftJoin(mediaAssets, eq(mediaAssets.id, historyMilestones.imageMediaId))
    .orderBy(asc(historyMilestones.occurredOn), asc(historyMilestones.sortOrder))
  return rows.map((row) => ({
    id: row.id,
    year: yearOf(row.occurredOn),
    // De un hito por confirmar solo se muestra la fecha si se conoce el día exacto.
    dateLabel:
      row.isPlaceholder && row.datePrecision !== 'dia'
        ? null
        : formatMilestoneDate(row.occurredOn, row.datePrecision),
    title: row.title,
    body: row.body,
    image: toImageDTO(row.image),
    isPlaceholder: row.isPlaceholder,
  }))
}

export type HonourDTO = {
  id: string
  name: string
  year: number | null
  seriesName: string | null
  competitionName: string | null
  description: string | null
  image: ImageDTO | null
}

export async function getHonours(): Promise<HonourDTO[]> {
  'use cache'
  cacheTag(tags.history(), tags.media(), tags.matches())
  cacheLife('hours')

  const rows = await db
    .select({
      id: honours.id,
      name: honours.name,
      year: honours.year,
      seriesName: series.name,
      competitionName: honours.competitionName,
      description: honours.description,
      image: imageSelect,
    })
    .from(honours)
    .leftJoin(series, eq(series.id, honours.seriesId))
    .leftJoin(mediaAssets, eq(mediaAssets.id, honours.imageMediaId))
    // Del más reciente al más antiguo; los que no tienen año, al final.
    .orderBy(sql`${honours.year} desc nulls last`, asc(honours.name))
  return rows.map(({ image, ...row }) => ({ ...row, image: toImageDTO(image) }))
}

export type IdolDTO = {
  id: string
  fullName: string
  nickname: string | null
  eraLabel: string | null
  position: string | null
  bio: string | null
  photo: ImageDTO | null
}

export async function getHallOfFame(): Promise<IdolDTO[]> {
  'use cache'
  cacheTag(tags.history(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: hallOfFame.id,
      fullName: hallOfFame.fullName,
      nickname: hallOfFame.nickname,
      eraLabel: hallOfFame.eraLabel,
      position: hallOfFame.position,
      bio: hallOfFame.bio,
      photo: imageSelect,
    })
    .from(hallOfFame)
    .leftJoin(mediaAssets, eq(mediaAssets.id, hallOfFame.photoMediaId))
    .orderBy(asc(hallOfFame.sortOrder), asc(hallOfFame.createdAt))
  return rows.map(({ photo, ...row }) => ({ ...row, photo: toImageDTO(photo) }))
}

export type KitDTO = {
  id: string
  description: string
  /** «1984 – 1990», «Desde 2020», «Hasta 1960» o `null`. */
  years: string | null
  image: ImageDTO | null
}

function kitYears(from: number | null, to: number | null): string | null {
  if (from !== null && to !== null) return from === to ? String(from) : `${from} – ${to}`
  if (from !== null) return `Desde ${from}`
  return to !== null ? `Hasta ${to}` : null
}

export async function getHistoricKits(): Promise<KitDTO[]> {
  'use cache'
  cacheTag(tags.history(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: historicKits.id,
      description: historicKits.description,
      yearFrom: historicKits.yearFrom,
      yearTo: historicKits.yearTo,
      image: imageSelect,
    })
    .from(historicKits)
    .leftJoin(mediaAssets, eq(mediaAssets.id, historicKits.imageMediaId))
    .orderBy(asc(historicKits.sortOrder), asc(historicKits.createdAt))
  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    years: kitYears(row.yearFrom, row.yearTo),
    image: toImageDTO(row.image),
  }))
}

// ── Panel: sin caché ────────────────────────────────────────────────────────────────────────────

const thumbSelect = {
  id: mediaAssets.id,
  variants: mediaAssets.variants,
  altText: mediaAssets.altText,
  containsMinors: mediaAssets.containsMinors,
}

type ThumbRow = Parameters<typeof toMediaThumbDTO>[0] | null
const toThumb = (row: ThumbRow): MediaThumbDTO | null => (row ? toMediaThumbDTO(row) : null)

export type HistoryAdminRow = {
  id: string
  title: string
  subtitle: string | null
  thumb: MediaThumbDTO | null
  isPlaceholder: boolean
}

/** Lista de una sección para el panel, en el mismo orden que el sitio. */
export async function listHistoryAdmin(section: HistorySection): Promise<HistoryAdminRow[]> {
  switch (section) {
    case 'hitos': {
      const rows = await db
        .select({
          id: historyMilestones.id,
          title: historyMilestones.title,
          occurredOn: historyMilestones.occurredOn,
          datePrecision: historyMilestones.datePrecision,
          isPlaceholder: historyMilestones.isPlaceholder,
          thumb: thumbSelect,
        })
        .from(historyMilestones)
        .leftJoin(mediaAssets, eq(mediaAssets.id, historyMilestones.imageMediaId))
        .orderBy(asc(historyMilestones.occurredOn), asc(historyMilestones.sortOrder))
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: formatMilestoneDate(row.occurredOn, row.datePrecision),
        thumb: toThumb(row.thumb),
        isPlaceholder: row.isPlaceholder,
      }))
    }
    case 'titulos': {
      const rows = await db
        .select({
          id: honours.id,
          title: honours.name,
          year: honours.year,
          competitionName: honours.competitionName,
          thumb: thumbSelect,
        })
        .from(honours)
        .leftJoin(mediaAssets, eq(mediaAssets.id, honours.imageMediaId))
        .orderBy(sql`${honours.year} desc nulls last`, asc(honours.name))
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.year, row.competitionName].filter(Boolean).join(' · ') || null,
        thumb: toThumb(row.thumb),
        isPlaceholder: false,
      }))
    }
    case 'salon-de-la-fama': {
      const rows = await db
        .select({
          id: hallOfFame.id,
          title: hallOfFame.fullName,
          eraLabel: hallOfFame.eraLabel,
          position: hallOfFame.position,
          thumb: thumbSelect,
        })
        .from(hallOfFame)
        .leftJoin(mediaAssets, eq(mediaAssets.id, hallOfFame.photoMediaId))
        .orderBy(asc(hallOfFame.sortOrder), asc(hallOfFame.createdAt))
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: [row.position, row.eraLabel].filter(Boolean).join(' · ') || null,
        thumb: toThumb(row.thumb),
        isPlaceholder: false,
      }))
    }
    case 'camisetas': {
      const rows = await db
        .select({
          id: historicKits.id,
          title: historicKits.description,
          yearFrom: historicKits.yearFrom,
          yearTo: historicKits.yearTo,
          thumb: thumbSelect,
        })
        .from(historicKits)
        .leftJoin(mediaAssets, eq(mediaAssets.id, historicKits.imageMediaId))
        .orderBy(asc(historicKits.sortOrder), asc(historicKits.createdAt))
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: kitYears(row.yearFrom, row.yearTo),
        thumb: toThumb(row.thumb),
        isPlaceholder: false,
      }))
    }
  }
}

const text = (value: string | number | null) => (value === null ? '' : String(value))

/** Un registro con los valores tal como los espera su formulario; `null` si no existe. */
export async function getHistoryAdmin(section: HistorySection, id: string) {
  switch (section) {
    case 'hitos': {
      const [row] = await db
        .select({ row: historyMilestones, thumb: thumbSelect })
        .from(historyMilestones)
        .leftJoin(mediaAssets, eq(mediaAssets.id, historyMilestones.imageMediaId))
        .where(eq(historyMilestones.id, id))
      if (!row) return null
      const date = fromMilestoneDate(row.row.occurredOn, row.row.datePrecision)
      return {
        section,
        name: row.row.title,
        image: toThumb(row.thumb),
        defaults: {
          title: row.row.title,
          year: text(date.year),
          month: text(date.month),
          day: text(date.day),
          body: text(row.row.body),
          imageMediaId: text(row.row.imageMediaId),
          isPlaceholder: row.row.isPlaceholder,
        },
      } as const
    }
    case 'titulos': {
      const [row] = await db
        .select({ row: honours, thumb: thumbSelect })
        .from(honours)
        .leftJoin(mediaAssets, eq(mediaAssets.id, honours.imageMediaId))
        .where(eq(honours.id, id))
      if (!row) return null
      return {
        section,
        name: row.row.name,
        image: toThumb(row.thumb),
        defaults: {
          name: row.row.name,
          year: text(row.row.year),
          seriesId: text(row.row.seriesId),
          competitionName: text(row.row.competitionName),
          description: text(row.row.description),
          imageMediaId: text(row.row.imageMediaId),
        },
      } as const
    }
    case 'salon-de-la-fama': {
      const [row] = await db
        .select({ row: hallOfFame, thumb: thumbSelect })
        .from(hallOfFame)
        .leftJoin(mediaAssets, eq(mediaAssets.id, hallOfFame.photoMediaId))
        .where(eq(hallOfFame.id, id))
      if (!row) return null
      return {
        section,
        name: row.row.fullName,
        image: toThumb(row.thumb),
        defaults: {
          fullName: row.row.fullName,
          nickname: text(row.row.nickname),
          eraLabel: text(row.row.eraLabel),
          position: text(row.row.position),
          bio: text(row.row.bio),
          photoMediaId: text(row.row.photoMediaId),
        },
      } as const
    }
    case 'camisetas': {
      const [row] = await db
        .select({ row: historicKits, thumb: thumbSelect })
        .from(historicKits)
        .leftJoin(mediaAssets, eq(mediaAssets.id, historicKits.imageMediaId))
        .where(eq(historicKits.id, id))
      if (!row) return null
      return {
        section,
        name: row.row.description,
        image: toThumb(row.thumb),
        defaults: {
          description: row.row.description,
          yearFrom: text(row.row.yearFrom),
          yearTo: text(row.row.yearTo),
          imageMediaId: text(row.row.imageMediaId),
        },
      } as const
    }
  }
}

export type HistoryAdminRecord = NonNullable<Awaited<ReturnType<typeof getHistoryAdmin>>>

/** Series para el selector del formulario de títulos. */
export function historySeriesOptions() {
  return db
    .select({ value: series.id, label: series.name })
    .from(series)
    .orderBy(asc(series.sortOrder), desc(series.isActive))
}
