import { desc, eq } from 'drizzle-orm'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createSportFixture, type SportFixture } from './fixtures'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const { auditLog, news, newsCategories, newsSeries, slugRedirects } = await import('@/db/schema')
const actions = await import('@/features/news/actions')
const { getNewsDetail, getNewsFeed, getNewsPage, resolveNewsRedirect } = await import(
  '@/features/news/public-queries'
)
const { publishDueNews } = await import('@/features/news/publish-due')
const { getNewsAdmin, getNewsPreview, listNewsAdmin } = await import('@/features/news/admin-queries')
const { GET: tick } = await import('@/app/api/cron/tick/route')
const { env } = await import('@/lib/env')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let f: SportFixture
let adminId: string

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const body = (...paragraphs: string[]) => ({ type: 'doc', content: paragraphs.map(paragraph) })

const newsInput = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  type: 'noticia',
  categoryId: '',
  excerpt: '',
  body: body('Primer párrafo de la noticia.', 'Segundo párrafo.'),
  coverMediaId: '',
  seriesIds: [],
  matchId: '',
  albumId: '',
  isFeatured: false,
  isPinned: false,
  slug: '',
  seoTitle: '',
  seoDescription: '',
  ogMediaId: '',
  ...extra,
})

async function idOf(result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>) {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function rowOf(id: string) {
  const [row] = await db.select().from(news).where(eq(news.id, id))
  if (!row) throw new Error('La noticia no existe.')
  return row
}

async function insertMedia(key: string, containsMinors: boolean): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors)
    values ('imagen', ${key}, 'image/jpeg', 10, 'Foto de prueba', ${containsMinors}) returning id`
  return row?.id ?? ''
}

async function wipe() {
  await cleanSport(admin)
  await admin`delete from news_categories`
  await admin`delete from slug_redirects`
  await admin`delete from media_assets where storage_key like 'noticias-test-%'`
}

beforeAll(async () => {
  await wipe()
  ;({ adminId } = await ensureTestUsers())
  f = await createSportFixture(admin)
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await wipe()
  await admin.end()
  await sql.end()
})

describe('autorización', () => {
  it('sin sesión o sin permiso no se escribe', async () => {
    const id = await idOf(actions.crearNoticia(newsInput('Para probar permisos')))
    for (const who of ['nadie', 'prensa'] as const) {
      await actAs(who)
      const message =
        who === 'nadie' ? 'Debes iniciar sesión para continuar.' : 'No tienes permiso para hacer esto.'
      for (const result of [
        await actions.crearNoticia(newsInput('No debe crearse')),
        await actions.actualizarNoticia(id, newsInput('Cambiado')),
        await actions.publicarNoticia(id),
        await actions.eliminarNoticia(id),
        await actions.crearCategoria({ name: 'Sin permiso', sortOrder: '' }),
      ]) {
        expect(result).toEqual({ ok: false, message })
      }
      expect(invalidatedTags()).toEqual([])
    }
    expect((await rowOf(id)).status).toBe('borrador')
    expect((await db.select().from(news)).length).toBe(1)
  })
})

describe('crear y editar', () => {
  it('crea un borrador con slug, autor, texto plano y series, y audita', async () => {
    const id = await idOf(
      actions.crearNoticia(
        newsInput('Ñandú campeón: ¡gran triunfo!', { seriesIds: [f.seriesId, f.seriesId] }),
      ),
    )
    const row = await rowOf(id)
    expect(row).toMatchObject({
      slug: 'nandu-campeon-gran-triunfo',
      status: 'borrador',
      publishedAt: null,
      authorId: adminId,
      bodyText: 'Primer párrafo de la noticia.\n\nSegundo párrafo.',
      excerpt: null,
    })
    expect(await db.select().from(newsSeries).where(eq(newsSeries.newsId, id))).toHaveLength(1)
    expect(invalidatedTags()).toEqual(['news'])
    const [entry] = await db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(1)
    expect(entry).toMatchObject({ action: 'news.create', entityType: 'news', entityId: id, userId: adminId })
  })

  it('valida en español: título, crónica sin partido, galería sin álbum y contenido no permitido', async () => {
    expect(await actions.crearNoticia(newsInput(''))).toMatchObject({
      ok: false,
      fieldErrors: { title: ['Escribe el título.'] },
    })
    expect(await actions.crearNoticia(newsInput('Crónica', { type: 'cronica' }))).toMatchObject({
      ok: false,
      fieldErrors: { matchId: ['Una crónica necesita su partido.'] },
    })
    expect(await actions.crearNoticia(newsInput('Galería', { type: 'galeria' }))).toMatchObject({
      ok: false,
      fieldErrors: { albumId: ['Una galería necesita su álbum de fotos.'] },
    })
    const unsafe = await actions.crearNoticia(
      newsInput('Con script', { body: { type: 'doc', content: [{ type: 'script', content: [] }] } }),
    )
    expect(unsafe).toMatchObject({ ok: false })
    expect(unsafe.ok === false && unsafe.fieldErrors?.body?.[0]).toContain('no se puede publicar')
  })

  it('guarda el documento reducido a la lista blanca', async () => {
    const id = await idOf(
      actions.crearNoticia(
        newsInput('Con enlaces', {
          body: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { onclick: 'x' },
                content: [
                  {
                    type: 'text',
                    text: 'malo',
                    marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
                  },
                  {
                    type: 'text',
                    text: 'bueno',
                    marks: [{ type: 'link', attrs: { href: 'https://anfa.cl' } }],
                  },
                ],
              },
            ],
          },
        }),
      ),
    )
    expect(JSON.stringify((await rowOf(id)).body)).not.toMatch(/javascript|onclick/)
    expect((await rowOf(id)).body?.content?.[0]?.content?.[1]?.marks).toEqual([
      { type: 'link', attrs: { href: 'https://anfa.cl' } },
    ])
  })

  it('no acepta imágenes marcadas con menores en la portada ni en el texto', async () => {
    const minors = await insertMedia('noticias-test-menores', true)
    const ok = await insertMedia('noticias-test-ok', false)
    expect(await actions.crearNoticia(newsInput('Portada', { coverMediaId: minors }))).toMatchObject({
      ok: false,
      fieldErrors: { coverMediaId: [expect.stringContaining('menores de edad')] },
    })
    const inBody = { type: 'doc', content: [{ type: 'image', attrs: { mediaId: minors, src: '' } }] }
    expect(await actions.crearNoticia(newsInput('En el texto', { body: inBody }))).toMatchObject({
      ok: false,
      fieldErrors: { body: [expect.stringContaining('menores de edad')] },
    })
    await idOf(actions.crearNoticia(newsInput('Con portada', { coverMediaId: ok })))
  })

  it('al editar conserva la dirección; al cambiarla deja la redirección', async () => {
    const id = await idOf(actions.crearNoticia(newsInput('Título original')))
    await idOf(actions.actualizarNoticia(id, newsInput('Título corregido', { slug: 'titulo-original' })))
    expect((await rowOf(id)).slug).toBe('titulo-original')
    expect(invalidatedTags().slice(-2)).toEqual(['news', `news:${id}`])

    await idOf(actions.actualizarNoticia(id, newsInput('Título corregido', { slug: 'Nueva Dirección' })))
    expect((await rowOf(id)).slug).toBe('nueva-direccion')
    expect(await db.select().from(slugRedirects).where(eq(slugRedirects.entityId, id))).toMatchObject([
      { entityType: 'news', oldSlug: 'titulo-original' },
    ])
    // La redirección solo se resuelve hacia una noticia visible.
    expect(await resolveNewsRedirect('titulo-original')).toBeNull()
    await idOf(actions.publicarNoticia(id))
    expect(await resolveNewsRedirect('titulo-original')).toBe('nueva-direccion')
  })
})

describe('estados', () => {
  it('publicar exige texto, fija la fecha y deja la noticia visible; despublicar la oculta', async () => {
    const empty = await idOf(actions.crearNoticia(newsInput('Sin texto', { body: null })))
    expect(await actions.publicarNoticia(empty)).toMatchObject({
      ok: false,
      message: expect.stringContaining('todavía no tiene texto'),
    })

    const matchId = await createMatch(admin, f, 'partido-de-la-cronica')
    const [category] = await db
      .insert(newsCategories)
      .values({ name: 'Primer equipo', slug: 'primer-equipo' })
      .returning({ id: newsCategories.id })
    const id = await idOf(
      actions.crearNoticia(
        newsInput('Crónica del partido', {
          type: 'cronica',
          matchId,
          categoryId: category?.id,
          seriesIds: [f.seriesId],
        }),
      ),
    )
    expect(await getNewsDetail('cronica-del-partido')).toBeNull()

    const before = Date.now()
    await idOf(actions.publicarNoticia(id))
    const published = await rowOf(id)
    expect(published.status).toBe('publicada')
    expect(published.publishedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000)
    expect(invalidatedTags().slice(-2)).toEqual(['news', `news:${id}`])

    const detail = await getNewsDetail('cronica-del-partido')
    expect(detail).toMatchObject({
      title: 'Crónica del partido',
      categoryName: 'Primer equipo',
      categorySlug: 'primer-equipo',
      excerpt: 'Primer párrafo de la noticia. Segundo párrafo.',
      series: [{ slug: 'honor', name: 'Honor' }],
      match: { slug: 'partido-de-la-cronica' },
    })
    // El DTO público no lleva datos internos.
    expect(Object.keys(detail ?? {})).not.toEqual(expect.arrayContaining(['authorId', 'status']))

    const byCategory = await getNewsPage('primer-equipo', null, 1)
    expect(byCategory.items.map((item) => item.id)).toEqual([id])
    expect((await getNewsPage('primer-equipo', 'honor', 1)).total).toBe(1)
    expect((await getNewsPage(null, 'no-existe', 1)).total).toBe(0)
    expect((await getNewsFeed()).map((item) => item.slug)).toContain('cronica-del-partido')

    // Volver a publicar después de despublicar conserva la fecha original.
    await idOf(actions.pasarNoticiaABorrador(id))
    expect(await getNewsDetail('cronica-del-partido')).toBeNull()
    await idOf(actions.publicarNoticia(id))
    expect((await rowOf(id)).publishedAt).toEqual(published.publishedAt)

    await idOf(actions.archivarNoticia(id))
    expect((await rowOf(id)).status).toBe('archivada')
    expect(await getNewsDetail('cronica-del-partido')).toBeNull()
  })

  it('programar exige una fecha futura; la tarea tick la publica cuando llega su hora', async () => {
    const id = await idOf(actions.crearNoticia(newsInput('Noticia programada')))
    expect(await actions.programarNoticia(id, { date: '2020-01-01', time: '10:00' })).toMatchObject({
      ok: false,
      fieldErrors: { date: [expect.stringContaining('ya pasó')] },
    })
    expect(await actions.programarNoticia(id, { date: '', time: '' })).toMatchObject({ ok: false })

    await idOf(actions.programarNoticia(id, { date: '2999-06-15', time: '10:30' }))
    const scheduled = await rowOf(id)
    expect(scheduled.status).toBe('programada')
    // 10:30 en Santiago (UTC-4 en junio) son las 14:30 UTC.
    expect(scheduled.publishedAt?.toISOString()).toBe('2999-06-15T14:30:00.000Z')
    expect(await getNewsDetail('noticia-programada')).toBeNull()
    expect(await publishDueNews()).toEqual([])

    await admin`update news set published_at = now() - interval '1 minute' where id = ${id}`
    expect(await publishDueNews()).toEqual([{ id, title: 'Noticia programada' }])
    expect((await rowOf(id)).status).toBe('publicada')
    expect(await getNewsDetail('noticia-programada')).not.toBeNull()
    const [entry] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, id))
      .orderBy(desc(auditLog.createdAt))
    expect(entry).toMatchObject({ action: 'news.publish.scheduled', userId: null })
    // Idempotente: no hay nada más que publicar.
    expect(await publishDueNews()).toEqual([])
  })

  it('la ruta tick exige el secreto y avisa a la caché', async () => {
    const request = (authorization?: string) =>
      new Request('http://localhost/api/cron/tick', { headers: authorization ? { authorization } : {} })
    const secret = env.CRON_SECRET
    expect(secret, 'las pruebas definen CRON_SECRET').toBeTruthy()
    expect((await tick(request())).status).toBe(401)
    expect((await tick(request('Bearer incorrecto'))).status).toBe(401)

    const id = await idOf(actions.crearNoticia(newsInput('Sale por tick')))
    await idOf(actions.programarNoticia(id, { date: '2999-01-01', time: '09:00' }))
    await admin`update news set published_at = now() - interval '1 minute' where id = ${id}`
    await actAs('nadie')
    const response = await tick(request(`Bearer ${secret}`))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, publishedNews: 1 })
    expect(invalidatedTags()).toEqual(['news', `news:${id}`])
  })

  it('una noticia publicada o programada no se elimina; un borrador sí', async () => {
    const id = await idOf(actions.crearNoticia(newsInput('Para eliminar')))
    await idOf(actions.publicarNoticia(id))
    expect(await actions.eliminarNoticia(id)).toMatchObject({
      ok: false,
      message: expect.stringContaining('no se elimina'),
    })
    await idOf(actions.pasarNoticiaABorrador(id))
    await idOf(actions.eliminarNoticia(id))
    expect(await db.select().from(news).where(eq(news.id, id))).toEqual([])
    expect(await actions.eliminarNoticia(id)).toMatchObject({ ok: false })
    expect(await actions.publicarNoticia('no-es-un-id')).toMatchObject({ ok: false })
  })
})

describe('panel', () => {
  it('lista con filtros, entrega el detalle para editar y la vista previa de un borrador', async () => {
    const id = await idOf(
      actions.crearNoticia(newsInput('Borrador para el panel', { seriesIds: [f.seriesId] })),
    )
    const drafts = await listNewsAdmin({ status: 'borrador', q: 'para el panel' })
    expect(drafts.items.map((item) => item.id)).toEqual([id])
    expect((await listNewsAdmin({ status: 'archivada', q: 'para el panel' })).total).toBe(0)

    expect(await getNewsAdmin(id)).toMatchObject({ slug: 'borrador-para-el-panel', seriesIds: [f.seriesId] })
    expect(await getNewsPreview(id)).toMatchObject({ title: 'Borrador para el panel', publishedAt: null })
  })
})

describe('categorías', () => {
  it('crea con slug, edita y no elimina una categoría en uso', async () => {
    const id = await idOf(actions.crearCategoria({ name: 'Formativas', sortOrder: '3' }))
    const [created] = await db.select().from(newsCategories).where(eq(newsCategories.id, id))
    expect(created).toMatchObject({ slug: 'formativas', sortOrder: 3 })
    expect(await actions.crearCategoria({ name: '', sortOrder: '' })).toMatchObject({
      ok: false,
      fieldErrors: { name: ['Escribe el nombre de la categoría.'] },
    })

    await idOf(actions.actualizarCategoria(id, { name: 'Escuela de fútbol', sortOrder: '' }))
    const [renamed] = await db.select().from(newsCategories).where(eq(newsCategories.id, id))
    expect(renamed).toMatchObject({ name: 'Escuela de fútbol', slug: 'escuela-de-futbol', sortOrder: 0 })

    const newsId = await idOf(actions.crearNoticia(newsInput('Con categoría', { categoryId: id })))
    expect(await actions.eliminarCategoria(id)).toMatchObject({
      ok: false,
      message: expect.stringContaining('Hay noticias con esta categoría'),
    })
    await idOf(actions.eliminarNoticia(newsId))
    await idOf(actions.eliminarCategoria(id))
    expect(await db.select().from(newsCategories).where(eq(newsCategories.id, id))).toEqual([])
  })
})
