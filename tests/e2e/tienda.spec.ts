import { expect, type Page, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

const PRODUCT = '/tienda/camiseta-oficial-local'

/** WhatsApp no es parte de la prueba: se intercepta la navegación y se devuelve el texto del pedido. */
async function captureWhatsapp(page: Page) {
  await page.route('https://wa.me/**', (route) =>
    route.fulfill({ contentType: 'text/plain', body: 'WhatsApp' }),
  )
  const request = page.waitForRequest(/^https:\/\/wa\.me\//)
  return async () => {
    const url = new URL((await request).url())
    return { number: url.pathname, text: url.searchParams.get('text') }
  }
}

async function orderTwoM(page: Page) {
  await page.getByRole('radio', { name: 'M', exact: true }).check({ force: true })
  await page.getByRole('spinbutton', { name: 'Cantidad' }).fill('2')
  await page.getByRole('button', { name: 'Pedir por WhatsApp' }).click()
}

const EXPECTED_ORDER = [
  '• Producto: Camiseta oficial (local)',
  '• Talla: M',
  '• Cantidad: 2',
  '• Precio unitario: $18.000 · Total referencial: $36.000',
].join('\n')

test('catálogo por categoría, ficha con tallas agotadas y pedido por WhatsApp', async ({ page }) => {
  await page.goto('/tienda')
  await expect(page.getByRole('heading', { level: 1, name: 'Tienda' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Categorías de la tienda' })
    .getByRole('link', { name: 'Accesorios' })
    .click()
  await expect(page.getByRole('heading', { level: 2, name: 'Accesorios' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Indumentaria' })).toHaveCount(0)
  await expectAccessible(page)

  await page.goto('/tienda?categoria=indumentaria')
  await page.getByRole('link', { name: 'Camiseta oficial (local)' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Camiseta oficial (local)' })).toBeVisible()
  // La XXL del seed está agotada: se ve tachada y no se puede elegir.
  await expect(page.getByRole('radio', { name: 'XXL (agotada)' })).toBeDisabled()
  await expect(page.getByText('Guía de tallas')).toBeVisible()
  await expectAccessible(page)

  const order = await captureWhatsapp(page)
  await orderTwoM(page)
  const { number, text } = await order()
  // El número es el de Configuración (otra prueba lo cambia): se revisa su forma, no su valor.
  expect(number).toMatch(/^\/569\d{8}$/)
  expect(text).toContain('¡Hola! Quiero hacer un pedido en la tienda del Club Deportivo Los Cachorros:')
  expect(text).toContain(EXPECTED_ORDER)
  expect(text).toMatch(/Enlace: https?:\/\/[^/]+\/tienda\/camiseta-oficial-local$/)
})

test('un producto nuevo del panel aparece en la tienda; al renombrarlo, su dirección antigua redirige', async ({
  page,
  request,
}, testInfo) => {
  const stamp = `${testInfo.project.name} ${Date.now()}`
  const name = `E2E Producto ${stamp}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Tienda', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await page.getByRole('textbox', { name: 'Nombre' }).fill(name)
  await page.getByRole('spinbutton', { name: 'Precio en pesos' }).fill('7500')
  await page.getByRole('button', { name: 'Crear y seguir con tallas y fotos' }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

  await page.getByRole('textbox', { name: 'Talla' }).fill('Única')
  await page.getByRole('button', { name: 'Agregar talla' }).click()
  await expect(page.getByRole('list', { name: 'Tallas' }).getByText('Única', { exact: true })).toBeVisible()
  await expectAccessible(page)

  const slug = new URL(
    await page.getByRole('link', { name: /^\/tienda\// }).evaluate((a) => (a as HTMLAnchorElement).href),
  ).pathname
  await page.goto(slug)
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  await expect(page.getByText('$7.500')).toBeVisible()

  await page.goBack()
  await page.getByRole('textbox', { name: 'Nombre' }).first().fill(`${name} renombrado`)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/tienda$/)
  const moved = await request.get(slug, { maxRedirects: 0 })
  expect(moved.status()).toBe(301)
  expect(moved.headers().location).toMatch(new RegExp(`${slug}-renombrado$`))
})

test('un producto que no existe responde 404', async ({ request }) => {
  const response = await request.get('/tienda/no-existe-este-producto', { maxRedirects: 0 })
  expect(response.status()).toBe(404)
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('el pedido por WhatsApp funciona con el formulario', async ({ page }) => {
    await page.goto(PRODUCT)
    const order = await captureWhatsapp(page)
    await orderTwoM(page)
    expect((await order()).text).toContain(EXPECTED_ORDER)
  })

  test('sin talla elegida vuelve a la ficha con el aviso', async ({ page }) => {
    await page.goto(`${PRODUCT}/pedido?cantidad=1`)
    await expect(page).toHaveURL(/\?error=talla#pedido$/)
    await expect(page.getByText('Elige una talla disponible.')).toBeVisible()
  })
})
