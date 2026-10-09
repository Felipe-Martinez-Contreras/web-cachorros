import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport } from './fixtures'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { db, sql } = await import('@/db/client')
const { auditLog, mediaAssets, teams } = await import('@/db/schema')
const { actualizarMedio, eliminarMedio } = await import('@/features/media/actions')
const { getMediaUsage, listMedia } = await import('@/features/media/queries')
const { storeUploadedImage, uploadsDir } = await import('@/features/media/store')
const { GET, POST } = await import('@/app/api/admin/media/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
let adminId: string

/** Foto como la de un celular: con EXIF y coordenadas GPS. */
function phonePhoto(width = 1600, height = 1200): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 30, g: 120, b: 60 } } })
    .withExif({
      IFD0: { Make: 'Celular de prueba', Copyright: 'Dato privado' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '35/1 0/1 0/1' },
    })
    .jpeg()
    .toBuffer()
}

const photoBlob = (bytes: Buffer) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })

function uploadRequest(file: Blob | null, fields: Record<string, string>, name = 'foto.jpg'): Request {
  const body = new FormData()
  if (file) body.set('file', file, name)
  for (const [key, value] of Object.entries(fields)) body.set(key, value)
  return new Request('http://localhost:3000/api/admin/media', { method: 'POST', body })
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  )

beforeAll(async () => {
  await cleanSport(admin)
  await admin`delete from media_assets`
  adminId = (await ensureTestUsers()).adminId
})

afterAll(async () => {
  await cleanSport(admin)
  await admin`delete from media_assets`
  await admin.end()
  await sql.end()
})

describe('POST /api/admin/media', () => {
  it('sin sesión responde 401 y no guarda nada', async () => {
    await actAs('nadie')
    const response = await POST(uploadRequest(photoBlob(await phonePhoto()), { altText: 'Foto' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ ok: false, message: 'Debes iniciar sesión para continuar.' })
    expect((await listMedia({})).total).toBe(0)
  })

  it('con sesión pero sin permiso responde 403', async () => {
    await actAs('prensa')
    const response = await POST(uploadRequest(photoBlob(await phonePhoto()), { altText: 'Foto' }))
    expect(response.status).toBe(403)
  })

  it('exige el texto alternativo', async () => {
    await actAs('admin')
    const response = await POST(uploadRequest(photoBlob(await phonePhoto()), { altText: '  ' }))
    expect(response.status).toBe(400)
    expect((await response.json()).message).toMatch(/Describe la imagen/)
  })

  it('rechaza por firma lo que no es una imagen, aunque diga llamarse .jpg', async () => {
    await actAs('admin')
    const pdf = new Blob([Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')], { type: 'image/jpeg' })
    const response = await POST(uploadRequest(pdf, { altText: 'Falsa foto' }, 'foto.jpg'))
    expect(response.status).toBe(415)
    expect((await listMedia({})).total).toBe(0)
  })

  it('rechaza una petición que viene de otro origen', async () => {
    await actAs('admin')
    const request = uploadRequest(photoBlob(await phonePhoto()), { altText: 'Foto' })
    request.headers.set('origin', 'https://sitio-malicioso.example')
    expect((await POST(request)).status).toBe(403)
  })

  it('guarda la foto sin EXIF ni GPS, con variantes WebP, auditoría e invalidación', async () => {
    await actAs('admin')
    const response = await POST(
      uploadRequest(photoBlob(await phonePhoto()), { altText: 'Plantel de Honor', credit: 'Foto: club' }),
    )
    expect(response.status).toBe(201)
    const { data } = (await response.json()) as { data: { id: string; thumb: string; alt: string } }
    expect(data.alt).toBe('Plantel de Honor')
    expect(data.thumb).toMatch(/^\/media\/.+\/w320\.webp$/)
    expect(invalidatedTags()).toEqual(['media'])

    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, data.id))
    expect(row).toMatchObject({
      kind: 'imagen',
      mime: 'image/jpeg',
      width: 1600,
      height: 1200,
      credit: 'Foto: club',
      uploadedBy: adminId,
      originalFilename: 'foto.jpg',
    })
    expect(row?.variants?.webp.map((v) => v.width)).toEqual([320, 480, 768, 1024, 1440, 1600])

    // El master re-codificado no conserva metadatos de la cámara ni la ubicación.
    const master = await readFile(path.join(uploadsDir(), row?.variants?.master ?? ''))
    const metadata = await sharp(master).metadata()
    expect(metadata.exif).toBeUndefined()
    expect(master.includes(Buffer.from('Celular de prueba'))).toBe(false)

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, data.id))
    expect(entry).toMatchObject({ action: 'media.create', userId: adminId })
  })

  it('GET lista las miniaturas solo con sesión', async () => {
    await actAs('nadie')
    expect((await GET(new Request('http://localhost:3000/api/admin/media'))).status).toBe(401)
    await actAs('admin')
    const response = await GET(new Request('http://localhost:3000/api/admin/media?q=plantel'))
    const body = (await response.json()) as { data: { items: { alt: string }[] } }
    expect(body.data.items.map((item) => item.alt)).toEqual(['Plantel de Honor'])
  })
})

describe('storeUploadedImage', () => {
  it('rechaza archivos vacíos y los que superan el tope', async () => {
    const base = { filename: 'x.jpg', altText: 'x', credit: null, kind: 'photo' as const, userId: adminId }
    await expect(storeUploadedImage({ ...base, bytes: Buffer.alloc(0) })).rejects.toMatchObject({
      status: 400,
    })
    await expect(
      storeUploadedImage({ ...base, bytes: Buffer.alloc(12 * 1024 * 1024 + 1) }),
    ).rejects.toMatchObject({ status: 413 })
  })

  it('rasteriza los SVG: nunca se guarda el SVG original', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><script>alert(1)</script><circle cx="100" cy="100" r="80" fill="#f27604"/></svg>',
    )
    const media = await storeUploadedImage({
      bytes: svg,
      filename: 'escudo.svg',
      altText: 'Escudo de prueba',
      credit: null,
      kind: 'logo',
      userId: adminId,
    })
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, media.id))
    expect(row?.mime).toBe('image/png')
    expect(row?.variants?.png512).toBeDefined()
    const master = await readFile(path.join(uploadsDir(), row?.variants?.master ?? ''))
    expect(master.includes(Buffer.from('<script'))).toBe(false)
  })

  it('procesa varias subidas simultáneas de a una y todas terminan bien', async () => {
    const photo = await phonePhoto(800, 600)
    const base = { bytes: photo, filename: 'f.jpg', credit: null, kind: 'photo' as const, userId: adminId }
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => storeUploadedImage({ ...base, altText: `Simultánea ${n}` })),
    )
    expect(new Set(results.map((media) => media.id)).size).toBe(4)
  })
})

describe('acciones de la biblioteca', () => {
  async function upload(altText: string): Promise<string> {
    const media = await storeUploadedImage({
      bytes: await phonePhoto(640, 480),
      filename: 'a.jpg',
      altText,
      credit: null,
      kind: 'photo',
      userId: adminId,
    })
    return media.id
  }

  const valid = { altText: 'Nueva descripción', credit: '', focalX: 0.25, focalY: 0.75 }

  it('rechazan la llamada sin sesión', async () => {
    const id = await upload('Sin sesión')
    await actAs('nadie')
    expect(await actualizarMedio(id, valid)).toEqual({
      ok: false,
      message: 'Debes iniciar sesión para continuar.',
    })
    expect(await eliminarMedio(id)).toEqual({ ok: false, message: 'Debes iniciar sesión para continuar.' })
  })

  it('actualizan descripción y punto focal', async () => {
    const id = await upload('Antes')
    await actAs('admin')
    expect(await actualizarMedio(id, valid)).toEqual({ ok: true, data: { id } })
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id))
    expect(row).toMatchObject({ altText: 'Nueva descripción', credit: null, focalX: 0.25, focalY: 0.75 })
    expect(invalidatedTags()).toContain('media')
  })

  it('no permiten marcar menores sin confirmar la autorización', async () => {
    const id = await upload('Juveniles')
    await actAs('admin')
    const result = await actualizarMedio(id, { ...valid, containsMinors: true, minorsConsent: false })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.fieldErrors?.minorsConsent?.[0]).toMatch(/autorización del apoderado/)

    expect((await actualizarMedio(id, { ...valid, containsMinors: true, minorsConsent: true })).ok).toBe(true)
    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id))
    expect(row?.containsMinors).toBe(true)
    expect(row?.minorsConsentConfirmedAt).toBeInstanceOf(Date)
  })

  it('una imagen en uso no se puede eliminar ni marcar con menores; libre, se borra con sus archivos', async () => {
    const id = await upload('Escudo en uso')
    const [team] = await db
      .insert(teams)
      .values({ name: 'Con escudo', shortName: 'Escudo', slug: 'con-escudo', crestMediaId: id })
      .returning({ id: teams.id })
    await actAs('admin')

    expect(await getMediaUsage(id)).toEqual([{ label: 'Escudos de equipos', count: 1 }])
    const blocked = await eliminarMedio(id)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.message).toMatch(/está en uso en Escudos de equipos/)
    const minors = await actualizarMedio(id, { ...valid, containsMinors: true, minorsConsent: true })
    expect(minors.ok).toBe(false)

    const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id))
    const dir = path.join(uploadsDir(), row?.storageKey ?? '')
    expect(await exists(dir)).toBe(true)

    await db.delete(teams).where(eq(teams.id, team?.id ?? ''))
    expect(await eliminarMedio(id)).toEqual({ ok: true, data: null })
    expect(await db.select().from(mediaAssets).where(eq(mediaAssets.id, id))).toEqual([])
    expect(await exists(dir)).toBe(false)
  })
})
