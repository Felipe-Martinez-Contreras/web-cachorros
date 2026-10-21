import postgres from 'postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { actAs, ensureTestUsers, invalidatedTags } from './session'

const { sql } = await import('@/db/client')
const { proxySql } = await import('@/db/proxy-client')
const actions = await import('@/features/store/actions')
const { getProductDetail, getStoreCatalog, resolveProductRedirect } = await import('@/features/store/queries')
const { productSlugStatus } = await import('@/features/store/slug')
const orderRoute = await import('@/app/(public)/tienda/[slug]/pedido/route')

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })

const productInput = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  categoryId: '',
  description: 'Descripción de prueba.',
  priceClp: '18000',
  compareAtPriceClp: '',
  trackStock: false,
  isActive: true,
  sortOrder: '0',
  ...extra,
})

const variantInput = (sizeLabel: string, extra: Record<string, unknown> = {}) => ({
  sizeLabel,
  stock: '',
  isAvailable: true,
  sortOrder: '0',
  ...extra,
})

async function idOf(
  result: Promise<{ ok: boolean; data?: { id: string }; message?: string }>,
): Promise<string> {
  const value = await result
  expect(value, value.message).toMatchObject({ ok: true })
  return value.data?.id ?? ''
}

async function insertMedia(key: string, containsMinors = false): Promise<string> {
  const [row] = await admin<{ id: string }[]>`
    insert into media_assets (kind, storage_key, mime, bytes, alt_text, contains_minors, width, height, variants)
    values ('imagen', ${key}, 'image/jpeg', 10, ${`Foto ${key}`}, ${containsMinors}, 1000, 1000,
      ${admin.json({ master: `${key}.jpg`, webp: [{ width: 640, path: `${key}-640.webp` }] })})
    returning id`
  return row?.id ?? ''
}

function order(slug: string, query: string) {
  return orderRoute.GET(new Request(`http://localhost:3000/tienda/${slug}/pedido?${query}`), {
    params: Promise.resolve({ slug }),
  })
}

async function wipe() {
  await admin`delete from products`
  await admin`delete from product_categories`
  await admin`delete from slug_redirects where entity_type = 'product'`
  await admin`delete from media_assets where storage_key like 'tienda-%'`
}

beforeAll(async () => {
  await wipe()
  await ensureTestUsers()
  await admin`update site_settings set whatsapp_e164 = '+56912345678'`
})

beforeEach(() => actAs('admin'))

afterAll(async () => {
  await wipe()
  await admin.end()
  await sql.end()
  await proxySql.end()
})

describe('acciones de la tienda', () => {
  it('crea categoría y producto, e invalida la tienda', async () => {
    const categoryId = await idOf(actions.crearCategoriaTienda({ name: 'Indumentaria', sortOrder: '1' }))
    await idOf(actions.crearProducto(productInput('Camiseta Ñandú', { categoryId })))
    expect(invalidatedTags()).toContain('store')
    const catalog = await getStoreCatalog()
    expect(catalog).toEqual([
      {
        slug: 'indumentaria',
        name: 'Indumentaria',
        products: [expect.objectContaining({ slug: 'camiseta-nandu', priceClp: 18000, soldOut: false })],
      },
    ])
  })

  it('al renombrar cambia el slug y el anterior redirige (301)', async () => {
    const id = await idOf(actions.crearProducto(productInput('Jockey')))
    await idOf(actions.actualizarProducto(id, productInput('Jockey del club')))
    expect(await resolveProductRedirect('jockey')).toBe('jockey-del-club')
    expect(await productSlugStatus('jockey')).toEqual({ kind: 'moved', slug: 'jockey-del-club' })
    expect(await productSlugStatus('jockey-del-club')).toEqual({ kind: 'found' })

    // Oculto: deja de existir, ni siquiera por la dirección antigua.
    await idOf(actions.actualizarProducto(id, productInput('Jockey del club', { isActive: false })))
    expect(await productSlugStatus('jockey-del-club')).toEqual({ kind: 'missing' })
    expect(await productSlugStatus('jockey')).toEqual({ kind: 'missing' })
    expect(await getProductDetail('jockey-del-club')).toBeNull()
  })

  it('no repite una talla ni elimina una categoría con productos', async () => {
    const categoryId = await idOf(actions.crearCategoriaTienda({ name: 'Accesorios', sortOrder: '2' }))
    const id = await idOf(actions.crearProducto(productInput('Bufanda', { categoryId })))
    await idOf(actions.agregarTalla(id, variantInput('Única')))
    expect(await actions.agregarTalla(id, variantInput('Única'))).toMatchObject({
      ok: false,
      fieldErrors: { sizeLabel: ['Este producto ya tiene esa talla.'] },
    })
    expect(await actions.eliminarCategoriaTienda(categoryId)).toEqual({
      ok: false,
      message: 'Esta categoría tiene productos: muévelos a otra antes de eliminarla.',
    })
  })

  it('una talla sin stock queda agotada y el producto sin tallas disponibles, agotado', async () => {
    const id = await idOf(actions.crearProducto(productInput('Polerón', { trackStock: true })))
    const m = await idOf(actions.agregarTalla(id, variantInput('M', { stock: '0' })))
    const l = await idOf(actions.agregarTalla(id, variantInput('L', { stock: '', sortOrder: '1' })))
    let detail = await getProductDetail('poleron')
    expect(detail?.sizes).toEqual([
      { label: 'M', orderable: false },
      { label: 'L', orderable: true },
    ])
    expect(detail?.soldOut).toBe(false)

    await idOf(actions.actualizarTalla(m, variantInput('M', { stock: '4' })))
    await idOf(actions.actualizarTalla(l, variantInput('L', { isAvailable: false })))
    await idOf(actions.actualizarTalla(m, variantInput('M', { stock: '0' })))
    detail = await getProductDetail('poleron')
    expect(detail?.soldOut).toBe(true)
  })

  it('las fotos: una con menores no se asigna y no se repite la misma', async () => {
    const id = await idOf(actions.crearProducto(productInput('Camiseta alternativa')))
    const photo = await insertMedia('tienda-foto')
    const minors = await insertMedia('tienda-menores', true)
    await idOf(actions.agregarFotoProducto(id, { mediaId: photo, sortOrder: '0' }))
    expect(await actions.agregarFotoProducto(id, { mediaId: photo, sortOrder: '1' })).toMatchObject({
      ok: false,
      fieldErrors: { mediaId: ['Esa foto ya está en el producto.'] },
    })
    expect(await actions.agregarFotoProducto(id, { mediaId: minors, sortOrder: '1' })).toMatchObject({
      ok: false,
      fieldErrors: {
        mediaId: ['Esa imagen está marcada con menores de edad y todavía no se puede publicar.'],
      },
    })
    const detail = await getProductDetail('camiseta-alternativa')
    expect(detail?.images).toHaveLength(1)
    expect(detail?.images[0]?.alt).toBe('Foto tienda-foto')

    const [image] = await admin<{ id: string }[]>`select id from product_images where product_id = ${id}`
    await idOf(actions.quitarFotoProducto(id, image?.id ?? ''))
    expect((await getProductDetail('camiseta-alternativa'))?.images).toEqual([])
  })

  it('sin permiso no escribe', async () => {
    actAs('nadie')
    expect(await actions.crearProducto(productInput('No'))).toMatchObject({ ok: false })
    const [{ n } = { n: 0 }] = await admin<{ n: number }[]>`
      select count(*)::int as n from products where name = 'No'`
    expect(n).toBe(0)
  })
})

describe('pedido por WhatsApp', () => {
  it('redirige a WhatsApp con el mensaje y valida talla y cantidad', async () => {
    const id = await idOf(actions.crearProducto(productInput('Camiseta oficial (local)')))
    await idOf(actions.agregarTalla(id, variantInput('M')))
    await idOf(actions.agregarTalla(id, variantInput('XXL', { isAvailable: false, sortOrder: '1' })))

    const ok = await order('camiseta-oficial-local', 'talla=M&cantidad=2')
    expect(ok.status).toBe(302)
    const location = ok.headers.get('location') ?? ''
    expect(location.startsWith('https://wa.me/56912345678?text=')).toBe(true)
    const text = new URL(location).searchParams.get('text')
    expect(text).toContain('• Producto: Camiseta oficial (local)\n• Talla: M\n• Cantidad: 2')
    expect(text).toContain('Total referencial: $36.000')
    expect(text).toContain('Enlace: http://localhost:3000/tienda/camiseta-oficial-local')

    const back = (response: Response) => response.headers.get('location')
    expect(back(await order('camiseta-oficial-local', 'talla=XXL&cantidad=1'))).toBe(
      '/tienda/camiseta-oficial-local?error=talla#pedido',
    )
    expect(back(await order('camiseta-oficial-local', 'talla=S&cantidad=1'))).toBe(
      '/tienda/camiseta-oficial-local?error=talla#pedido',
    )
    expect(back(await order('camiseta-oficial-local', 'talla=M&cantidad=50'))).toBe(
      '/tienda/camiseta-oficial-local?error=cantidad#pedido',
    )
    expect(back(await order('no-existe', 'talla=M&cantidad=1'))).toBe('/tienda')
  })

  it('sin WhatsApp en Configuración vuelve a la ficha con el aviso', async () => {
    await admin`update site_settings set whatsapp_e164 = null`
    try {
      const response = await order('camiseta-oficial-local', 'talla=M&cantidad=1')
      expect(response.headers.get('location')).toBe('/tienda/camiseta-oficial-local?error=whatsapp#pedido')
    } finally {
      await admin`update site_settings set whatsapp_e164 = '+56912345678'`
    }
  })
})
