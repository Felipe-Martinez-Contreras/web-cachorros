'use server'

import { eq } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { news, newsCategories, newsSeries } from '@/db/schema'
import { santiagoWallTime } from '@/features/matches/lib/schedule'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { formatLongDateTime } from '@/lib/format'
import { isRichTextEmpty, richTextMediaIds, richTextToPlain } from '@/lib/rich-text/document'
import { recordSlugChange, resolveSlug } from '@/lib/slug-redirects'
import { z } from '@/lib/zod'
import { newsCategorySchema, newsSchema, scheduleNewsSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>
type NewsData = z.output<typeof newsSchema>

const NEWS_TAGS = [tags.news()]
const nothing = z.unknown()
const NOT_FOUND = 'No encontramos esa noticia. Puede que la hayan eliminado.'

const newsConstraints = {
  news_slug_uq: { message: 'Ya existe una noticia con esa dirección. Prueba con otra.', field: 'slug' },
  news_cronica_match_check: { message: 'Una crónica necesita su partido.', field: 'matchId' },
  news_galeria_album_check: { message: 'Una galería necesita su álbum de fotos.', field: 'albumId' },
}

/** Toda imagen de la noticia (portada, redes y las del texto) debe poder publicarse. */
async function assertNewsMedia(tx: Tx, data: NewsData): Promise<void> {
  await assertPublishableMedia(tx, data.coverMediaId, 'coverMediaId')
  await assertPublishableMedia(tx, data.ogMediaId, 'ogMediaId')
  for (const mediaId of richTextMediaIds(data.body)) await assertPublishableMedia(tx, mediaId, 'body')
}

function newsValues({ seriesIds: _seriesIds, slug: _slug, ...data }: NewsData) {
  return { ...data, bodyText: richTextToPlain(data.body) || null }
}

async function replaceSeries(tx: Tx, newsId: string, seriesIds: string[]): Promise<void> {
  await tx.delete(newsSeries).where(eq(newsSeries.newsId, newsId))
  const unique = [...new Set(seriesIds)]
  if (unique.length > 0) await tx.insert(newsSeries).values(unique.map((seriesId) => ({ newsId, seriesId })))
}

/** Crea la noticia como borrador: se publica o se programa después, desde su pantalla. */
export async function crearNoticia(input: unknown): Result {
  return mutate({
    action: 'news.create',
    permission: 'news:write',
    entityType: 'news',
    schema: newsSchema,
    input,
    tags: NEWS_TAGS,
    constraints: newsConstraints,
    write: async (tx, data, user) => {
      await assertNewsMedia(tx, data)
      const slug = await resolveSlug(tx, news, data.slug ?? data.title)
      const [row] = await tx
        .insert(news)
        .values({ ...newsValues(data), slug, status: 'borrador', authorId: user.id })
        .returning({ id: news.id })
      if (!row) throw new Error('La noticia no se creó.')
      await replaceSeries(tx, row.id, data.seriesIds)
      return { id: row.id, summary: `Creó la noticia «${data.title}»`, meta: { type: data.type } }
    },
  })
}

export async function actualizarNoticia(id: string, input: unknown): Result {
  return mutate({
    action: 'news.update',
    permission: 'news:write',
    entityType: 'news',
    schema: newsSchema,
    input,
    tags: NEWS_TAGS,
    constraints: newsConstraints,
    write: async (tx, data) => {
      const newsId = assertId(id, NOT_FOUND)
      await assertNewsMedia(tx, data)
      const [current] = await tx
        .select({ slug: news.slug })
        .from(news)
        .where(eq(news.id, newsId))
        .for('update')
      if (!current) throw new Rejection(NOT_FOUND)
      // La dirección no cambia sola al corregir el título: solo si se edita (o se deja vacía).
      const slug =
        data.slug === current.slug
          ? current.slug
          : await resolveSlug(tx, news, data.slug ?? data.title, newsId)
      await tx
        .update(news)
        .set({ ...newsValues(data), slug })
        .where(eq(news.id, newsId))
      await replaceSeries(tx, newsId, data.seriesIds)
      await recordSlugChange(tx, 'news', newsId, current.slug, slug)
      return {
        id: newsId,
        summary: `Editó la noticia «${data.title}»`,
        meta: { type: data.type, slug },
        tags: [tags.newsItem(newsId)],
      }
    },
  })
}

type Status = (typeof news.status.enumValues)[number]

/** Cambio de estado de una noticia: lee la fila con bloqueo, decide y escribe en la misma transacción. */
function changeStatus(
  id: string,
  action: string,
  decide: (current: { title: string; status: Status; publishedAt: Date | null; isEmpty: boolean }) => {
    status: Status
    publishedAt?: Date | null
    summary: string
  },
): Result {
  return mutate({
    action,
    permission: 'news:write',
    entityType: 'news',
    schema: nothing,
    input: null,
    tags: NEWS_TAGS,
    write: async (tx) => {
      const newsId = assertId(id, NOT_FOUND)
      const [current] = await tx
        .select({ title: news.title, status: news.status, publishedAt: news.publishedAt, body: news.body })
        .from(news)
        .where(eq(news.id, newsId))
        .for('update')
      if (!current) throw new Rejection(NOT_FOUND)
      const { summary, ...next } = decide({ ...current, isEmpty: isRichTextEmpty(current.body) })
      await tx.update(news).set(next).where(eq(news.id, newsId))
      return { id: newsId, summary, meta: { status: next.status }, tags: [tags.newsItem(newsId)] }
    },
  })
}

const EMPTY_BODY = 'La noticia todavía no tiene texto. Escríbelo y guarda antes de publicarla.'

export async function publicarNoticia(id: string): Result {
  return changeStatus(id, 'news.publish', (current) => {
    if (current.isEmpty) throw new Rejection(EMPTY_BODY)
    const now = new Date()
    // Una noticia que ya estuvo publicada conserva su fecha; una nueva o programada sale ahora.
    const keepDate = current.publishedAt !== null && current.publishedAt <= now
    return {
      status: 'publicada',
      publishedAt: keepDate ? current.publishedAt : now,
      summary: `Publicó la noticia «${current.title}»`,
    }
  })
}

export async function programarNoticia(id: string, input: unknown): Result {
  const parsed = scheduleNewsSchema.safeParse(input)
  return changeStatus(id, 'news.schedule', (current) => {
    if (!parsed.success) throw new Rejection('Elige el día y la hora de publicación.', 'date')
    if (current.isEmpty) throw new Rejection(EMPTY_BODY)
    const publishedAt = santiagoWallTime(parsed.data.date, parsed.data.time)
    if (publishedAt <= new Date()) {
      throw new Rejection('Esa fecha ya pasó. Elige una futura o publica ahora.', 'date')
    }
    return {
      status: 'programada',
      publishedAt,
      summary: `Programó la noticia «${current.title}» para el ${formatLongDateTime(publishedAt)}`,
    }
  })
}

export async function pasarNoticiaABorrador(id: string): Result {
  return changeStatus(id, 'news.unpublish', (current) => ({
    status: 'borrador',
    summary: `Volvió a borrador la noticia «${current.title}»`,
  }))
}

export async function archivarNoticia(id: string): Result {
  return changeStatus(id, 'news.archive', (current) => ({
    status: 'archivada',
    summary: `Archivó la noticia «${current.title}»`,
  }))
}

export async function eliminarNoticia(id: string): Result {
  return mutate({
    action: 'news.delete',
    permission: 'news:write',
    entityType: 'news',
    schema: nothing,
    input: null,
    tags: NEWS_TAGS,
    write: async (tx) => {
      const newsId = assertId(id, NOT_FOUND)
      const [current] = await tx
        .select({ title: news.title, status: news.status })
        .from(news)
        .where(eq(news.id, newsId))
        .for('update')
      if (!current) throw new Rejection('No encontramos esa noticia. Puede que ya la hayan eliminado.')
      if (current.status === 'publicada' || current.status === 'programada') {
        throw new Rejection(
          'Una noticia publicada o programada no se elimina: archívala o pásala a borrador.',
        )
      }
      await tx.delete(news).where(eq(news.id, newsId))
      return { id: newsId, summary: `Eliminó la noticia «${current.title}»`, tags: [tags.newsItem(newsId)] }
    },
  })
}

// ── Categorías ──────────────────────────────────────────────────────────────────────────────────

const categoryConstraints = {
  news_categories_slug_uq: { message: 'Ya existe una categoría con ese nombre.', field: 'name' },
}

export async function crearCategoria(input: unknown): Result {
  return mutate({
    action: 'news_category.create',
    permission: 'news:write',
    entityType: 'news_category',
    schema: newsCategorySchema,
    input,
    tags: NEWS_TAGS,
    constraints: categoryConstraints,
    write: async (tx, data) => {
      const slug = await resolveSlug(tx, newsCategories, data.name)
      const [row] = await tx
        .insert(newsCategories)
        .values({ name: data.name, slug, sortOrder: data.sortOrder ?? 0 })
        .returning({ id: newsCategories.id })
      if (!row) throw new Error('La categoría no se creó.')
      return { id: row.id, summary: `Creó la categoría ${data.name}`, meta: data }
    },
  })
}

export async function actualizarCategoria(id: string, input: unknown): Result {
  return mutate({
    action: 'news_category.update',
    permission: 'news:write',
    entityType: 'news_category',
    schema: newsCategorySchema,
    input,
    tags: NEWS_TAGS,
    constraints: categoryConstraints,
    write: async (tx, data) => {
      const categoryId = assertId(id, 'No encontramos esa categoría.')
      // El slug es el valor del filtro `?categoria=`: sigue al nombre.
      const slug = await resolveSlug(tx, newsCategories, data.name, categoryId)
      const [row] = await tx
        .update(newsCategories)
        .set({ name: data.name, slug, sortOrder: data.sortOrder ?? 0 })
        .where(eq(newsCategories.id, categoryId))
        .returning({ id: newsCategories.id })
      if (!row) throw new Rejection('No encontramos esa categoría. Puede que la hayan eliminado.')
      return { id: categoryId, summary: `Editó la categoría ${data.name}`, meta: data }
    },
  })
}

export async function eliminarCategoria(id: string): Result {
  return mutate({
    action: 'news_category.delete',
    permission: 'news:write',
    entityType: 'news_category',
    schema: nothing,
    input: null,
    tags: NEWS_TAGS,
    write: async (tx) => {
      const categoryId = assertId(id, 'No encontramos esa categoría.')
      const [used] = await tx
        .select({ id: news.id })
        .from(news)
        .where(eq(news.categoryId, categoryId))
        .limit(1)
      if (used)
        throw new Rejection('Hay noticias con esta categoría. Cámbialas de categoría antes de eliminarla.')
      const [row] = await tx
        .delete(newsCategories)
        .where(eq(newsCategories.id, categoryId))
        .returning({ name: newsCategories.name })
      if (!row) throw new Rejection('No encontramos esa categoría. Puede que ya la hayan eliminado.')
      return { id: categoryId, summary: `Eliminó la categoría ${row.name}` }
    },
  })
}
