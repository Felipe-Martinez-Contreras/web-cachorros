import 'server-only'
import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { albumItems, albums, events, mediaAssets, videos } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'
import { formatShortDate } from '@/lib/format'

// Lecturas del panel: sin caché, siempre el estado actual.

const thumbSelect = {
  id: mediaAssets.id,
  variants: mediaAssets.variants,
  altText: mediaAssets.altText,
  containsMinors: mediaAssets.containsMinors,
}

const thumb = (row: { id: string | null } & Omit<Parameters<typeof toMediaThumbDTO>[0], 'id'>) =>
  row.id ? toMediaThumbDTO({ ...row, id: row.id }) : (null as MediaThumbDTO | null)

export async function listAlbumsAdmin() {
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: albums.id,
        title: albums.title,
        slug: albums.slug,
        takenOn: albums.takenOn,
        isPublished: albums.isPublished,
        containsMinors: albums.containsMinors,
        cover: thumbSelect,
      })
      .from(albums)
      .leftJoin(mediaAssets, eq(mediaAssets.id, albums.coverMediaId))
      .orderBy(desc(sql`coalesce(${albums.takenOn}, ${albums.createdAt}::date)`)),
    db.select({ albumId: albumItems.albumId, photos: count() }).from(albumItems).groupBy(albumItems.albumId),
  ])
  const photos = new Map(counts.map((row) => [row.albumId, row.photos]))
  return rows.map(({ cover, ...row }) => ({
    ...row,
    cover: cover ? thumb(cover) : null,
    photoCount: photos.get(row.id) ?? 0,
  }))
}

export async function getAlbumAdmin(id: string) {
  const [[album], items] = await Promise.all([
    db
      .select({
        id: albums.id,
        title: albums.title,
        slug: albums.slug,
        takenOn: albums.takenOn,
        matchId: albums.matchId,
        eventId: albums.eventId,
        isPublished: albums.isPublished,
        containsMinors: albums.containsMinors,
        minorsConsentConfirmedAt: albums.minorsConsentConfirmedAt,
        cover: thumbSelect,
      })
      .from(albums)
      .leftJoin(mediaAssets, eq(mediaAssets.id, albums.coverMediaId))
      .where(eq(albums.id, id))
      .limit(1),
    db
      .select({
        id: albumItems.id,
        caption: albumItems.caption,
        sortOrder: albumItems.sortOrder,
        media: thumbSelect,
      })
      .from(albumItems)
      .innerJoin(mediaAssets, eq(mediaAssets.id, albumItems.mediaId))
      .where(eq(albumItems.albumId, id))
      .orderBy(asc(albumItems.sortOrder), asc(albumItems.createdAt)),
  ])
  if (!album) return null
  const { cover, ...rest } = album
  return {
    ...rest,
    cover: cover ? thumb(cover) : null,
    items: items.map((item) => ({ ...item, media: toMediaThumbDTO(item.media) })),
  }
}
export type AlbumAdmin = NonNullable<Awaited<ReturnType<typeof getAlbumAdmin>>>

export async function eventOptions() {
  const rows = await db
    .select({ value: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .orderBy(desc(events.startsAt))
  return rows.map((row) => ({ value: row.value, label: `${formatShortDate(row.startsAt)} · ${row.title}` }))
}

export async function listVideosAdmin() {
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      provider: videos.provider,
      url: videos.url,
      publishedOn: videos.publishedOn,
      matchId: videos.matchId,
      isPublished: videos.isPublished,
      thumbnail: thumbSelect,
    })
    .from(videos)
    .leftJoin(mediaAssets, eq(mediaAssets.id, videos.thumbnailMediaId))
    .orderBy(desc(sql`coalesce(${videos.publishedOn}, ${videos.createdAt}::date)`))
  return rows.map(({ thumbnail, ...row }) => ({ ...row, thumbnail: thumbnail ? thumb(thumbnail) : null }))
}
export type VideoAdmin = Awaited<ReturnType<typeof listVideosAdmin>>[number]

export async function getVideoAdmin(id: string): Promise<VideoAdmin | null> {
  return (await listVideosAdmin()).find((row) => row.id === id) ?? null
}
