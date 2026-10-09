import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import sharp from 'sharp'
import { ADMIN, login } from './support'

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'la página no debe tener scroll horizontal').toBeLessThanOrEqual(0)
}

const NOT_FOUND = 'Este balón se fue fuera de la cancha'

let dir: string
let photo: string

test.beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cachorros-e2e-noticias-'))
  photo = path.join(dir, 'foto-noticia.jpg')
  await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 90, b: 20 } } })
    .jpeg({ quality: 85 })
    .toFile(photo)
})

test.afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('crear una noticia con foto desde el panel: se ve en el sitio en la carga siguiente', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000)
  const stamp = `${testInfo.project.name} ${Date.now()}`
  const title = `E2E Noticia ${stamp}`
  const slug = `e2e-noticia-${stamp.replace(/\s+/g, '-')}`
  const bodyText = `Texto de la noticia de prueba ${stamp}.`

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/noticias')
  await expect(page.getByRole('heading', { name: 'Noticias', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Nueva noticia' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva noticia', level: 1 })).toBeVisible()

  // Sin título no se guarda.
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page.getByText('Escribe el título.')).toBeVisible()

  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(title)

  // Foto principal: se sube desde el mismo formulario.
  await page.getByRole('button', { name: 'Elegir imagen' }).first().click()
  const library = page.getByRole('dialog', { name: 'Elegir imagen' })
  await library.getByText('Subir una imagen nueva').click()
  await library.locator('input[type="file"]').setInputFiles(photo)
  await library
    .getByRole('textbox', { name: 'Descripción de la imagen' })
    .fill(`E2E foto de la noticia ${stamp}`)
  await library.getByRole('button', { name: 'Subir 1 imagen' }).click()
  await expect(library).toBeHidden({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Cambiar imagen' })).toBeVisible()

  // El editor carga aparte; se escribe como en cualquier campo de texto.
  const editor = page.getByRole('textbox', { name: 'Texto de la noticia' })
  await editor.click()
  await page.keyboard.type(bodyText)
  await page.getByRole('button', { name: 'Negrita' }).click()
  await page.keyboard.type(' Importante.')
  await expectNoHorizontalScroll(page)

  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page).toHaveURL(/\/admin\/noticias\/[0-9a-f-]{36}$/)
  await expect(page.getByText('Borrador guardado.')).toBeVisible()
  const editUrl = page.url()

  // Un borrador no existe para el sitio.
  expect((await request.get(`/noticias/${slug}`, { maxRedirects: 0 })).status()).toBe(404)

  // La vista previa muestra lo guardado.
  await page.getByRole('link', { name: 'Vista previa' }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
  await expect(page.getByText(bodyText)).toBeVisible()
  await expect(page.getByText('Todavía no está publicada.')).toBeVisible()
  await page.goto(editUrl)

  await page.getByRole('button', { name: 'Publicar ahora' }).click()
  await page.getByRole('button', { name: 'Sí, publicar' }).click()
  await expect(page.getByText('Noticia publicada.')).toBeVisible()

  // En la carga siguiente está en la portada, en el listado y en su página.
  await page.goto('/')
  await expect(page.getByRole('link', { name: title })).toBeVisible()
  await page.goto('/noticias')
  await page.getByRole('link', { name: title }).click()
  await expect(page).toHaveURL(new RegExp(`/noticias/${slug}$`))
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
  // Next conserva oculta la pantalla anterior (el listado, con el resumen): se busca dentro del texto.
  await expect(page.locator('article .rich-text').getByText(bodyText)).toBeVisible()
  await expect(page.locator('article strong', { hasText: 'Importante.' })).toBeVisible()
  await expect(page.getByRole('img', { name: `E2E foto de la noticia ${stamp}` })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page)

  // Corregir el título no cambia la dirección; el cambio se ve en la carga siguiente.
  await page.goto(editUrl)
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`${title} corregida`)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Noticia guardada.')).toBeVisible()
  await page.goto(`/noticias/${slug}`)
  await expect(page.getByRole('heading', { name: `${title} corregida`, level: 1, exact: true })).toBeVisible()

  // Cambiar la dirección deja una redirección 301 desde la antigua.
  await page.goto(editUrl)
  await page.getByRole('textbox', { name: /^Dirección en el sitio/ }).fill(`${slug}-nueva`)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Noticia guardada.')).toBeVisible()
  const moved = await request.get(`/noticias/${slug}`, { maxRedirects: 0 })
  expect(moved.status()).toBe(301)
  expect(moved.headers().location).toContain(`/noticias/${slug}-nueva`)

  // Al volver a borrador deja de existir en el sitio.
  await page.getByRole('button', { name: 'Volver a borrador' }).click()
  await page.getByRole('button', { name: 'Sí, despublicar' }).click()
  await expect(page.getByText('La noticia volvió a borrador.')).toBeVisible()
  expect((await page.goto(`/noticias/${slug}-nueva`))?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
})

test('un borrador se guarda solo mientras se escribe', async ({ page }, testInfo) => {
  const title = `E2E Borrador ${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/noticias/nueva')
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(title)
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page).toHaveURL(/\/admin\/noticias\/[0-9a-f-]{36}$/)

  await page.getByRole('textbox', { name: /^Resumen/ }).fill('Resumen escrito sin tocar Guardar.')
  await expect(page.getByText(/^Borrador guardado a las /)).toBeVisible({ timeout: 15_000 })
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Resumen/ })).toHaveValue(
    'Resumen escrito sin tocar Guardar.',
  )
})

test('las categorías se administran desde el panel', async ({ page }, testInfo) => {
  const name = `E2E Categoría ${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/noticias/categorias')
  await expect(page.getByRole('heading', { name: 'Categorías de noticias', level: 1 })).toBeVisible()
  await page.getByRole('textbox', { name: 'Nombre' }).fill(name)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Categoría guardada.')).toBeVisible()
  await page.getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Eliminar categoría' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page).toHaveURL(/\/admin\/noticias\/categorias$/)
  await expect(page.getByRole('link', { name })).toHaveCount(0)
})

test.describe('noticias sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('el listado, los filtros y el detalle muestran su contenido', async ({ page }) => {
    expect((await page.goto('/noticias'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Noticias', level: 1 })).toBeVisible()
    const cards = page.getByRole('main').getByRole('article')
    await expect(cards.first()).toBeVisible()
    const total = await cards.count()
    expect(total).toBeGreaterThanOrEqual(6)

    // Los filtros son un formulario GET.
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Formativas' })
    await page.getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(/categoria=formativas/)
    await expect(cards).toHaveCount(1)
    await expect(page.getByRole('link', { name: /convocatoria a las divisiones formativas/ })).toBeVisible()

    await page.goto('/noticias?serie=honor')
    await expect(page.getByRole('combobox', { name: 'Serie' })).toHaveValue('honor')
    await expect(cards).toHaveCount(1)

    // La crónica abre con el marcador de su partido y enlaza a él.
    await cards.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/noticias\/cronica-honor$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Honor se impuso')
    await expect(page.getByRole('link', { name: 'Ver el detalle del partido' })).toBeVisible()
    await expect(page.getByText(/Los Cachorros se quedaron con los tres puntos/)).toBeVisible()
    await expect(page.getByRole('link', { name: /Compartir en WhatsApp/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Más noticias' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Series de esta noticia' }).getByRole('link')).toHaveText(
      'Honor',
    )
  })

  test('un filtro que no existe se ignora y una página fuera de rango muestra la última', async ({
    page,
  }) => {
    expect((await page.goto('/noticias?categoria=no-existe&pagina=999'))?.status()).toBe(200)
    await expect(page.getByRole('main').getByRole('article').first()).toBeVisible()
  })
})

test('el feed RSS lista las noticias con direcciones absolutas', async ({ request, baseURL }) => {
  const response = await request.get('/noticias/rss.xml')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/rss+xml')
  const xml = await response.text()
  expect(xml).toContain('<rss version="2.0"')
  expect(xml).toContain(`<link>${baseURL}/noticias/cronica-honor</link>`)
  expect(xml).not.toContain('<script')
})

test('el listado de noticias es accesible y no desborda', async ({ page }) => {
  await page.goto('/noticias')
  await expect(page.getByRole('heading', { name: 'Noticias', level: 1 })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page)
  await page.goto('/noticias/cronica-honor')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page)
})
