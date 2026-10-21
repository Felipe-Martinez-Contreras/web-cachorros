import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const { proxySql } = await import('@/db/proxy-client')
const actions = await import('@/features/gallery/actions')
const { getAlbumDetail, getAlbums, getVideos, resolveAlbumRedirect } = await import(
  '@/features/gallery/queries'
)
const { albumSlugStatus } = await import('@/features/gallery/slug')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const albumInput = (title: string, extra: Record<string, unknown> = {}) => ({
  title,
  takenOn: '2026-05-10',
  coverMediaId: '',
  matchId: '',
  eventId: '',
  isPublished: true,
  containsMinors: false,
  minorsConsent: false,
  ...extra,
})

const videoInput = (title: string, url: string, extra: Record<string, unknown> = {}) => ({
  title,
  url,
  thumbnailMediaId: '',
  publishedOn: '',
  matchId: '',
  isPublished: true,
  ...extra,
})

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function insertPhoto(key: string, containsMinors = false): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors, width, height, variants)
    values ('imagen', ${key}, 'image/jpeg', 10, ${`Foto ${key}`}, ${containsMinors}, 1200, 800,
      ${admin.json({ master: `${key}.jpg`, webp: [{ width: 640, path: `${key}-640.webp` }] })})
    returning id`
  return row?.id ?? ''
}

async function wipe() {
  await admin`delete from news where album_id is not null`
  await admin`delete from albums`
  await admin`delete from videos`
  await admin`delete from slug_redirects where entity_type = 'album'`
  await admin`delete from media_assets where storage_key like 'galeria-%'`
}

beforeAll(async () => {
  await wipe()
  await ensureTestUsers()
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await wipe()
  await admin.end()
  await sql.end()
  await proxySql.end()
})

describe('álbumes', () => {
  it('crea, agrega fotos en orden y cuenta solo las que se pueden mostrar', async () => {
    const id = await idOf(actions.crearAlbum(albumInput('Honor vs Unión')))
    expect(invalidatedTags()).toContain('gallery')
    const first = await insertPhoto('galeria-1')
    const second = await insertPhoto('galeria-2')
    await idOf(actions.agregarFotoAlbum(id, { mediaId: second, caption: 'El gol', sortOrder: '1' }))
    await idOf(actions.agregarFotoAlbum(id, { mediaId: first, caption: '', sortOrder: '0' }))
    expect(await actions.agregarFotoAlbum(id, { mediaId: first, caption: '', sortOrder: '2' })).toMatchObject(
      {
        ok: false,
        fieldErrors: { mediaId: ['Esa foto ya está en el álbum.'] },
      },
    )
    // Una foto marcada con menores no se puede agregar…
    const minors = await insertPhoto('galeria-menores', true)
    expect(
      await actions.agregarFotoAlbum(id, { mediaId: minors, caption: '', sortOrder: '3' }),
    ).toMatchObject({
      ok: false,
      fieldErrors: {
        mediaId: ['Esa imagen está marcada con menores de edad y todavía no se puede publicar.'],
      },
    })
    // …y si se marca después de agregarla, deja de mostrarse.
    await admin`update media_assets set contains_minors = true where id = ${second}`

    const detail = await getAlbumDetail('honor-vs-union')
    expect(detail?.photos.map((photo) => photo.image.alt)).toEqual(['Foto galeria-1'])
    expect((await getAlbums()).find((album) => album.slug === 'honor-vs-union')?.photoCount).toBe(1)
    await admin`update media_assets set contains_minors = false where id = ${second}`
    expect((await getAlbumDetail('honor-vs-union'))?.photos.map((photo) => photo.caption)).toEqual([
      null,
      'El gol',
    ])
  })

  it('al renombrar, la dirección antigua redirige; un borrador no existe', async () => {
    const id = await idOf(actions.crearAlbum(albumInput('Aniversario')))
    await idOf(actions.actualizarAlbum(id, albumInput('Aniversario 92')))
    expect(await resolveAlbumRedirect('aniversario')).toBe('aniversario-92')
    expect(await albumSlugStatus('aniversario')).toEqual({ kind: 'moved', slug: 'aniversario-92' })
    await idOf(actions.actualizarAlbum(id, albumInput('Aniversario 92', { isPublished: false })))
    expect(await albumSlugStatus('aniversario-92')).toEqual({ kind: 'missing' })
    expect(await getAlbumDetail('aniversario-92')).toBeNull()
  })

  it('un álbum con menores se publica solo con la confirmación, que queda registrada', async () => {
    expect(await actions.crearAlbum(albumInput('Formativas', { containsMinors: true }))).toMatchObject({
      ok: false,
      fieldErrors: {
        minorsConsent: ['Para publicar un álbum con menores, confirma que el club tiene las autorizaciones.'],
      },
    })
    const id = await idOf(
      actions.crearAlbum(albumInput('Formativas', { containsMinors: true, minorsConsent: true })),
    )
    const [row] = await admin<{ by: string | null; at: Date | null }[]>`
      select minors_consent_confirmed_by as by, minors_consent_confirmed_at as at from albums where id = ${id}`
    expect(row?.by).toBeTruthy()
    expect(row?.at).toBeInstanceOf(Date)
  })

  it('no elimina un álbum que usa una noticia de galería', async () => {
    const id = await idOf(actions.crearAlbum(albumInput('Galería de la noticia')))
    await admin`insert into news (title, slug, type, status, album_id) values
      ('Galería', 'galeria-noticia', 'galeria', 'borrador', ${id})`
    expect(await actions.eliminarAlbum(id)).toEqual({
      ok: false,
      message: 'Una noticia de galería usa este álbum: cámbiala o elimínala antes.',
    })
  })

  it('sin permiso no escribe', async () => {
    actAs('nadie')
    expect(await actions.crearAlbum(albumInput('No'))).toMatchObject({ ok: false })
  })
})

describe('videos', () => {
  it('lista solo los publicados con una dirección real', async () => {
    await idOf(
      actions.crearVideo(
        videoInput('Resumen', 'https://youtu.be/dQw4w9WgXcQ', { publishedOn: '2026-05-01' }),
      ),
    )
    await idOf(
      actions.crearVideo(
        videoInput('Saludo', 'https://www.facebook.com/cachorros/videos/1/', { publishedOn: '2026-04-01' }),
      ),
    )
    await idOf(
      actions.crearVideo(videoInput('Borrador', 'https://youtu.be/dQw4w9WgXcQ', { isPublished: false })),
    )
    // Un video del seed con un marcador en vez de dirección no se muestra.
    await admin`insert into videos (title, provider, url, is_published) values
      ('Pendiente', 'youtube', '[COMPLETAR: URL del video]', true)`

    expect(await getVideos()).toEqual([
      expect.objectContaining({ title: 'Resumen', provider: 'youtube', youtubeId: 'dQw4w9WgXcQ' }),
      expect.objectContaining({ title: 'Saludo', provider: 'facebook', youtubeId: null }),
    ])
  })
})
