import { expect, test } from '@playwright/test'
import { HIDDEN_SECTIONS, isHiddenPath, SECTION_PATHS } from '../../src/config/secciones'
import { expectAccessible } from './support'

// Simplificación del sitio: secciones ocultas (`src/config/secciones.ts`) y secciones fusionadas.
const hiddenPaths = [...HIDDEN_SECTIONS].map((key) => SECTION_PATHS[key])

test('las secciones ocultas responden 404 real y ningún enlace del sitio las nombra', async ({
  page,
  request,
}) => {
  for (const path of hiddenPaths) {
    const response = await request.get(path, { maxRedirects: 0 })
    expect(response.status(), `${path} responde 404`).toBe(404)
  }

  for (const path of ['/', '/partidos/posiciones', '/club/la-cancha', '/socios', '/historia']) {
    await page.goto(path)
    const hrefs = await page
      .locator('a[href]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    expect(
      hrefs.filter((href) => isHiddenPath(href)),
      `${path} no enlaza secciones ocultas`,
    ).toEqual([])
  }

  const sitemap = await (await request.get('/sitemap.xml')).text()
  for (const path of hiddenPaths) expect(sitemap, `${path} fuera del sitemap`).not.toContain(`${path}<`)
})

test('/videos y /apoya-al-club redirigen con 301 a su nueva página', async ({ request }) => {
  for (const [from, to] of [
    ['/videos', '/galeria?vista=videos'],
    ['/apoya-al-club', '/socios'],
  ] as const) {
    const response = await request.get(from, { maxRedirects: 0 })
    expect(response.status(), from).toBe(301)
    const location = new URL(response.headers().location ?? '', 'http://localhost')
    expect(`${location.pathname}${location.search}`).toBe(to)
  }
})

test('la galería tiene pestañas Fotos y Videos que se usan con el teclado', async ({ page }) => {
  await page.goto('/galeria')
  const tabs = page.getByRole('navigation', { name: 'Secciones de la galería' })
  await expect(tabs.getByRole('link', { name: 'Fotos' })).toHaveAttribute('aria-current', 'page')

  await tabs.getByRole('link', { name: 'Videos' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/galeria\?vista=videos$/)
  await expect(tabs.getByRole('link', { name: 'Videos' })).toHaveAttribute('aria-current', 'page')
  await expectAccessible(page)
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('las pestañas de la galería son enlaces', async ({ page }) => {
    await page.goto('/galeria')
    await page
      .getByRole('navigation', { name: 'Secciones de la galería' })
      .getByRole('link', { name: 'Videos' })
      .click()
    await expect(page).toHaveURL(/\/galeria\?vista=videos$/)
  })
})
