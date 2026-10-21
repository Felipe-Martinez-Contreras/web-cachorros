'use server'

import { and, eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { albumItems, albums, events, matches, videos } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { albumItemSchema, albumItemUpdateSchema, albumSchema, videoSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>
type AlbumData = z.output<typeof albumSchema>

const nothing = z.unknown()

const albumConstraints = {
  albums_minors_consent_check: {
    message: 'Para publicar un álbum con menores, confirma que el club tiene las autorizaciones.',
    field: 'minorsConsent',
  },
  news_album_id_albums_id_fk: {
    message: 'Una noticia de galería usa este álbum: cámbiala o elimínala antes.',
  },
}

const itemConstraints = {
  album_items_album_media_uq: { message: 'Esa foto ya está en el álbum.', field: 'mediaId' },
}

async function assertLinks(tx: Tx, data: { matchId: string | null; eventId?: string | null }) {
  if (data.matchId) {
    const [match] = await tx.select({ id: matches.id }).from(matches).where(eq(matches.id, data.matchId))
    if (!match) throw new Rejection('Ese partido ya no existe. Elige otro.', 'matchId')
  }
  if (data.eventId) {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, data.eventId))
    if (!event) throw new Rejection('Ese evento ya no existe. Elige otro.', 'eventId')
  }
}

/** Valores del álbum, con quién confirmó las autorizaciones de menores y cuándo (9.6). */
function albumValues({ minorsConsent, ...data }: AlbumData, userId: string, confirmedAt: Date | null) {
  const confirmed = data.containsMinors && minorsConsent
  return {
    ...data,
    minorsConsentConfirmedBy: confirmed ? userId : null,
    minorsConsentConfirmedAt: confirmed ? (confirmedAt ?? new Date()) : null,
  }
}

// ── Álbumes ─────────────────────────────────────────────────────────────────────────────────────

export async function crearAlbum(input: unknown): Result {
  return mutate({
    action: 'album.create',
    permission: 'gallery:write',
    entityType: 'album',
    schema: albumSchema,
    input,
    tags: [tags.gallery()],
    constraints: albumConstraints,
    write: async (tx, data, user) => {
      await assertPublishableMedia(tx, data.coverMediaId, 'coverMediaId')
      await assertLinks(tx, data)
      const slug = await resolveSlug(tx, albums, data.title)
      const [row] = await tx
        .insert(albums)
        .values({ ...albumValues(data, user.id, null), slug })
        .returning({ id: albums.id })
      if (!row) throw new Error('El álbum no se creó.')
      return {
        id: row.id,
        summary: `Creó el álbum ${data.title}`,
        meta: { slug, isPublished: data.isPublished, containsMinors: data.containsMinors },
      }
    },
  })
}

export async function actualizarAlbum(id: string, input: unknown): Result {
  return mutate({
    action: 'album.update',
    permission: 'gallery:write',
    entityType: 'album',
    schema: albumSchema,
    input,
    tags: [tags.gallery()],
    constraints: albumConstraints,
    write: async (tx, data, user) => {
      const albumId = assertId(id, 'No encontramos ese álbum.')
      const [current] = await tx
        .select({ slug: albums.slug, confirmedAt: albums.minorsConsentConfirmedAt })
        .from(albums)
        .where(eq(albums.id, albumId))
        .for('update')
      if (!current) throw new Rejection('No encontramos ese álbum. Puede que lo hayan eliminado.')
      await assertPublishableMedia(tx, data.coverMediaId, 'coverMediaId')
      await assertLinks(tx, data)
      // Al renombrar cambia la dirección; la anterior responde con un 301 (3.9).
      const slug = await resolveSlug(tx, albums, data.title, albumId)
      await tx
        .update(albums)
        .set({ ...albumValues(data, user.id, current.confirmedAt), slug })
        .where(eq(albums.id, albumId))
      await recordSlugChange(tx, 'album', albumId, current.slug, slug)
      return {
        id: albumId,
        summary: `Editó el álbum ${data.title}`,
        meta: { slug, isPublished: data.isPublished, containsMinors: data.containsMinors },
      }
    },
  })
}

export async function eliminarAlbum(id: string): Result {
  return mutate({
    action: 'album.delete',
    permission: 'gallery:write',
    entityType: 'album',
    schema: nothing,
    input: null,
    tags: [tags.gallery()],
    constraints: albumConstraints,
    write: async (tx) => {
      const albumId = assertId(id, 'No encontramos ese álbum.')
      // Sus fotos salen del álbum (ON DELETE CASCADE), pero siguen en la biblioteca.
      const [row] = await tx.delete(albums).where(eq(albums.id, albumId)).returning({ title: albums.title })
      if (!row) throw new Rejection('No encontramos ese álbum. Puede que ya lo hayan eliminado.')
      return { id: albumId, summary: `Eliminó el álbum ${row.title}` }
    },
  })
}

// ── Fotos del álbum ─────────────────────────────────────────────────────────────────────────────

export async function agregarFotoAlbum(albumId: string, input: unknown): Result {
  return mutate({
    action: 'album_item.create',
    permission: 'gallery:write',
    entityType: 'album_item',
    schema: albumItemSchema,
    input,
    tags: [tags.gallery()],
    constraints: itemConstraints,
    write: async (tx, data) => {
      const owner = assertId(albumId, 'No encontramos ese álbum.')
      const [album] = await tx.select({ title: albums.title }).from(albums).where(eq(albums.id, owner))
      if (!album) throw new Rejection('No encontramos ese álbum. Puede que lo hayan eliminado.')
      await assertPublishableMedia(tx, data.mediaId, 'mediaId')
      const [row] = await tx
        .insert(albumItems)
        .values({ ...data, albumId: owner })
        .returning({ id: albumItems.id })
      if (!row) throw new Error('La foto no se agregó.')
      return { id: row.id, summary: `Agregó una foto al álbum ${album.title}` }
    },
  })
}

export async function actualizarFotoAlbum(albumId: string, itemId: string, input: unknown): Result {
  return mutate({
    action: 'album_item.update',
    permission: 'gallery:write',
    entityType: 'album_item',
    schema: albumItemUpdateSchema,
    input,
    tags: [tags.gallery()],
    write: async (tx, data) => {
      const id = assertId(itemId, 'No encontramos esa foto.')
      const owner = assertId(albumId, 'No encontramos ese álbum.')
      const [row] = await tx
        .update(albumItems)
        .set(data)
        .where(and(eq(albumItems.id, id), eq(albumItems.albumId, owner)))
        .returning({ id: albumItems.id })
      if (!row) throw new Rejection('No encontramos esa foto. Puede que la hayan quitado.')
      return { id, summary: 'Editó una foto de un álbum', meta: { sortOrder: data.sortOrder } }
    },
  })
}

export async function quitarFotoAlbum(albumId: string, itemId: string): Result {
  return mutate({
    action: 'album_item.delete',
    permission: 'gallery:write',
    entityType: 'album_item',
    schema: nothing,
    input: null,
    tags: [tags.gallery()],
    write: async (tx) => {
      const id = assertId(itemId, 'No encontramos esa foto.')
      const owner = assertId(albumId, 'No encontramos ese álbum.')
      const [row] = await tx
        .delete(albumItems)
        .where(and(eq(albumItems.id, id), eq(albumItems.albumId, owner)))
        .returning({ id: albumItems.id })
      if (!row) throw new Rejection('No encontramos esa foto. Puede que ya la hayan quitado.')
      return { id, summary: 'Quitó una foto de un álbum' }
    },
  })
}

// ── Videos ──────────────────────────────────────────────────────────────────────────────────────

export async function crearVideo(input: unknown): Result {
  return mutate({
    action: 'video.create',
    permission: 'gallery:write',
    entityType: 'video',
    schema: videoSchema,
    input,
    tags: [tags.gallery()],
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.thumbnailMediaId, 'thumbnailMediaId')
      await assertLinks(tx, data)
      const [row] = await tx.insert(videos).values(data).returning({ id: videos.id })
      if (!row) throw new Error('El video no se creó.')
      return { id: row.id, summary: `Agregó el video ${data.title}`, meta: { provider: data.provider } }
    },
  })
}

export async function actualizarVideo(id: string, input: unknown): Result {
  return mutate({
    action: 'video.update',
    permission: 'gallery:write',
    entityType: 'video',
    schema: videoSchema,
    input,
    tags: [tags.gallery()],
    write: async (tx, data) => {
      const videoId = assertId(id, 'No encontramos ese video.')
      await assertPublishableMedia(tx, data.thumbnailMediaId, 'thumbnailMediaId')
      await assertLinks(tx, data)
      const [row] = await tx
        .update(videos)
        .set(data)
        .where(eq(videos.id, videoId))
        .returning({ id: videos.id })
      if (!row) throw new Rejection('No encontramos ese video. Puede que lo hayan eliminado.')
      return { id: videoId, summary: `Editó el video ${data.title}`, meta: { provider: data.provider } }
    },
  })
}

export async function eliminarVideo(id: string): Result {
  return mutate({
    action: 'video.delete',
    permission: 'gallery:write',
    entityType: 'video',
    schema: nothing,
    input: null,
    tags: [tags.gallery()],
    write: async (tx) => {
      const videoId = assertId(id, 'No encontramos ese video.')
      const [row] = await tx.delete(videos).where(eq(videos.id, videoId)).returning({ title: videos.title })
      if (!row) throw new Rejection('No encontramos ese video. Puede que ya lo hayan eliminado.')
      return { id: videoId, summary: `Eliminó el video ${row.title}` }
    },
  })
}
