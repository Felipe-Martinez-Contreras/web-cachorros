import 'server-only'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { db } from '@/db/client'
import {
  albumItems,
  albums,
  events,
  matches,
  mediaAssets,
  series,
  slugRedirects,
  teams,
  videos,
} from '@/db/schema'
import { tags } from '@/lib/cache-tags'
import { toImageDTO } from '@/lib/images/dto'
import { parseEmbedUrl } from '@/lib/rich-text/embed'
import type { AlbumCardDTO, AlbumDetailDTO, VideoDTO } from './dto'

const imageSelect = {
  variants: mediaAssets.variants,
  width: mediaAssets.width,
  height: mediaAssets.height,
  altText: mediaAssets.altText,
  lqip: mediaAssets.lqip,
  credit: mediaAssets.credit,
  focalX: mediaAssets.focalX,
  focalY: mediaAssets.focalY,
  containsMinors: mediaAssets.containsMinors,
}

/** Una foto marcada con menores no se entrega al sitio, aunque haya quedado asignada (9.6). */
function publicImage(
  row: (NonNullable<Parameters<typeof toImageDTO>[0]> & { containsMinors: boolean }) | null,
) {
  return row?.containsMinors ? null : toImageDTO(row)
}

// Solo las fotos que el sitio puede mostrar: las que no están marcadas con menores.
const visibleItem = eq(mediaAssets.containsMinors, false)

/** Álbumes publicados, del más reciente al más antiguo, con su portada y la cantidad de fotos (6.5). */
export async function getAlbums(): Promise<AlbumCardDTO[]> {
  'use cache'
  cacheTag(tags.gallery(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: albums.id,
      slug: albums.slug,
      title: albums.title,
      takenOn: albums.takenOn,
      cover: imageSelect,
    })
    .from(albums)
    .leftJoin(mediaAssets, eq(mediaAssets.id, albums.coverMediaId))
    .where(eq(albums.isPublished, true))
    .orderBy(desc(sql`coalesce(${albums.takenOn}, ${albums.createdAt}::date)`), asc(albums.title))
  if (rows.length === 0) return []

  const counts = await db
    .select({ albumId: albumItems.albumId, photos: count() })
    .from(albumItems)
    .innerJoin(mediaAssets, eq(mediaAssets.id, albumItems.mediaId))
    .where(
      and(
        inArray(
          albumItems.albumId,
          rows.map((row) => row.id),
        ),
        visibleItem,
      ),
    )
    .groupBy(albumItems.albumId)
  const photos = new Map(counts.map((row) => [row.albumId, row.photos]))

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    takenOn: row.takenOn,
    cover: publicImage(row.cover),
    photoCount: photos.get(row.id) ?? 0,
  }))
}

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')

/** Álbum publicado por su slug vigente, con sus fotos en orden; `null` si no existe o no está publicado. */
export async function getAlbumDetail(slug: string): Promise<AlbumDetailDTO | null> {
  'use cache'
  cacheTag(tags.gallery(), tags.media())
  cacheLife('hours')

  const [row] = await db
    .select({
      id: albums.id,
      slug: albums.slug,
      title: albums.title,
      takenOn: albums.takenOn,
      updatedAt: albums.updatedAt,
      cover: imageSelect,
      matchSlug: matches.slug,
      seriesName: series.name,
      homeName: homeTeam.shortName,
      awayName: awayTeam.shortName,
      eventSlug: events.slug,
      eventTitle: events.title,
      eventPublished: events.isPublished,
    })
    .from(albums)
    .leftJoin(mediaAssets, eq(mediaAssets.id, albums.coverMediaId))
    .leftJoin(matches, and(eq(matches.id, albums.matchId), sql`${matches.clubSide} <> 'ninguno'`))
    .leftJoin(series, eq(series.id, matches.seriesId))
    .leftJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .leftJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .leftJoin(events, eq(events.id, albums.eventId))
    .where(and(eq(albums.slug, slug), eq(albums.isPublished, true)))
    .limit(1)
  if (!row) return null

  const items = await db
    .select({ id: albumItems.id, caption: albumItems.caption, image: imageSelect })
    .from(albumItems)
    .innerJoin(mediaAssets, eq(mediaAssets.id, albumItems.mediaId))
    .where(and(eq(albumItems.albumId, row.id), visibleItem))
    .orderBy(asc(albumItems.sortOrder), asc(albumItems.createdAt))

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    takenOn: row.takenOn,
    cover: publicImage(row.cover),
    photos: items.flatMap((item) => {
      const image = publicImage(item.image)
      return image ? [{ id: item.id, image, caption: item.caption }] : []
    }),
    match:
      row.matchSlug && row.homeName && row.awayName
        ? { slug: row.matchSlug, label: `${row.seriesName}: ${row.homeName} vs ${row.awayName}` }
        : null,
    event:
      row.eventSlug && row.eventTitle && row.eventPublished
        ? { slug: row.eventSlug, title: row.eventTitle }
        : null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Slug vigente de un álbum publicado al que se llegó por una dirección antigua (segunda barrera). */
export async function resolveAlbumRedirect(oldSlug: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: albums.slug })
    .from(slugRedirects)
    .innerJoin(albums, eq(albums.id, slugRedirects.entityId))
    .where(
      and(
        eq(slugRedirects.entityType, 'album'),
        eq(slugRedirects.oldSlug, oldSlug),
        eq(albums.isPublished, true),
      ),
    )
    .limit(1)
  return row?.slug ?? null
}

/**
 * Videos publicados, del más reciente al más antiguo (6.5). Solo los que tienen una dirección real de
 * YouTube o Facebook: un marcador `[COMPLETAR]` no es un video.
 */
export async function getVideos(): Promise<VideoDTO[]> {
  'use cache'
  cacheTag(tags.gallery(), tags.media())
  cacheLife('hours')

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      url: videos.url,
      publishedOn: videos.publishedOn,
      thumbnail: imageSelect,
    })
    .from(videos)
    .leftJoin(mediaAssets, eq(mediaAssets.id, videos.thumbnailMediaId))
    .where(eq(videos.isPublished, true))
    .orderBy(desc(sql`coalesce(${videos.publishedOn}, ${videos.createdAt}::date)`), asc(videos.title))

  return rows.flatMap((row) => {
    const embed = parseEmbedUrl(row.url)
    if (!embed || embed.provider === 'instagram') return []
    return [
      {
        id: row.id,
        title: row.title,
        provider: embed.provider,
        url: embed.url,
        youtubeId: embed.videoId ?? null,
        thumbnail: publicImage(row.thumbnail),
        publishedOn: row.publishedOn,
      },
    ]
  })
}
