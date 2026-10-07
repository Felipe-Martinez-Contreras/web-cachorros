import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('GET /api/health responde ok con la base de datos arriba', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', db: 'ok' })
  expect(response.headers()['cache-control']).toBe('no-store')
})

test('la portada provisional carga en español, sin scroll horizontal ni problemas de accesibilidad', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-CL')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Club Deportivo Los Cachorros')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)

  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('una ruta inexistente muestra el 404 del club', async ({ page }) => {
  const response = await page.goto('/no-existe')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Este balón se fue fuera de la cancha' })).toBeVisible()
})
