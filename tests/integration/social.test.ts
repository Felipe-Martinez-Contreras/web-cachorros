import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const actions = await import('@/features/social/actions')
const { socialFeed } = await import('@/features/social/provider')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let imageId = ''

const postInput = (extra: Record<string, unknown> = {}) => ({
  permalink: 'https://www.instagram.com/p/C0d1g0/?igsh=seguimiento',
  platform: 'facebook',
  imageMediaId: imageId,
  excerpt: 'Así se vivió la fecha',
  postedOn: '2026-10-18',
  sortOrder: '0',
  isPinned: false,
  embedEnabled: true,
  isPublished: true,
  ...extra,
})

async function idOf(result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>) {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

beforeAll(async () => {
  await admin`delete from social_posts`
  await ensureTestUsers()
  const [media] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, width, height, variants, alt_text)
    values ('imagen', ${randomUUID()}, 'image/jpeg', 1000, 800, 800,
      ${admin.json({ master: 'x/master.jpg', webp: [{ width: 320, height: 320, path: 'x/w320.webp' }] })},
      'Foto de una publicación') returning id`
  imageId = media?.id ?? ''
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await admin`delete from social_posts`
  await admin`delete from media_assets where id = ${imageId}`
  await admin.end()
  await sql.end()
})

describe('feed curado de redes', () => {
  it('la red sale del enlace, que se guarda normalizado; el sitio recibe el embed tras la fachada', async () => {
    const id = await idOf(actions.crearPublicacion(postInput()))
    expect(invalidatedTags()).toEqual(['social'])
    const [row] = await admin<{ platform: string; permalink: string }[]>`
      select platform, permalink from social_posts where id = ${id}`
    expect(row).toEqual({ platform: 'instagram', permalink: 'https://www.instagram.com/p/C0d1g0/' })

    const [post] = await socialFeed().latest(6)
    expect(post).toMatchObject({
      id,
      platform: 'instagram',
      permalink: 'https://www.instagram.com/p/C0d1g0/',
      embedUrl: 'https://www.instagram.com/p/C0d1g0/embed/',
    })
  })

  it('un marcador pendiente conserva la red elegida y nunca tiene embed', async () => {
    const id = await idOf(
      actions.crearPublicacion(
        postInput({ permalink: '[COMPLETAR: URL de la publicación]', embedEnabled: false, sortOrder: '5' }),
      ),
    )
    const [row] = await admin<{ platform: string; embed_enabled: boolean }[]>`
      select platform, embed_enabled from social_posts where id = ${id}`
    expect(row).toEqual({ platform: 'facebook', embed_enabled: false })
    const feed = await socialFeed().latest(6)
    expect(feed.find((post) => post.id === id)).toMatchObject({ permalink: null, embedUrl: null })
  })

  it('edita, oculta y elimina; sin permiso no hace nada', async () => {
    const id = await idOf(actions.crearPublicacion(postInput({ excerpt: 'Para editar' })))
    await idOf(actions.actualizarPublicacion(id, postInput({ excerpt: 'Oculta', isPublished: false })))
    expect((await socialFeed().latest(6)).some((post) => post.id === id)).toBe(false)

    await actAs('nadie')
    expect((await actions.eliminarPublicacion(id)).ok).toBe(false)
    await actAs('admin')
    await idOf(actions.eliminarPublicacion(id))
    expect(await admin`select 1 from social_posts where id = ${id}`).toHaveLength(0)
    expect((await actions.eliminarPublicacion(id)).ok).toBe(false)
  })

  it('una imagen con menores no se puede usar', async () => {
    await admin`update media_assets set contains_minors = true, minors_consent_confirmed_at = now() where id = ${imageId}`
    const result = await actions.crearPublicacion(postInput())
    await admin`update media_assets set contains_minors = false, minors_consent_confirmed_at = null where id = ${imageId}`
    expect(result.ok).toBe(false)
  })
})
