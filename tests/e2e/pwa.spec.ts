import { expect, test } from '@playwright/test'
import { SECOND_SITE } from './second-site'
import { expectAccessible } from './support'

// La PWA se prueba en la segunda instancia (SITE_ENV=production): en desarrollo no se registra el
// service worker. 127.0.0.1 cuenta como origen seguro, así que el navegador lo acepta sin HTTPS.
const base = SECOND_SITE.url

test('manifest instalable con nombre, idioma, íconos y accesos directos', async ({ request }) => {
  const response = await request.get(`${base}/manifest.webmanifest`)
  expect(response.ok()).toBe(true)
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    short_name: 'Cachorros',
    start_url: '/',
    display: 'standalone',
    lang: 'es-CL',
  })
  expect(manifest.shortcuts.map((shortcut: { url: string }) => shortcut.url)).toEqual([
    '/partidos',
    '/noticias',
    '/tienda',
  ])
  const purposes = manifest.icons.map(
    (icon: { sizes: string; purpose: string }) => `${icon.sizes} ${icon.purpose}`,
  )
  expect(purposes).toEqual(['192x192 any', '512x512 any', '512x512 maskable'])
  for (const icon of manifest.icons as { src: string }[]) {
    const image = await request.get(`${base}${icon.src}`)
    expect(image.headers()['content-type'], icon.src).toBe('image/png')
  }
  const home = await (await request.get(`${base}/`)).text()
  expect(home).toContain('<link rel="manifest" href="/manifest.webmanifest"')
  expect(home).toContain('/icons/apple-touch-icon.png')
  // Con CF_WEB_ANALYTICS_TOKEN, el beacon de Cloudflare Web Analytics (diferido); sin token, nada.
  expect(home).toMatch(/<script defer="" src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js"/)
  expect(home).toContain('token-e2e-de-analitica')
  expect(await (await request.get('/')).text()).not.toContain('cloudflareinsights')
})

test('service worker: página offline sin red y nunca guarda el panel ni la API', async ({
  page,
  context,
}) => {
  await page.goto(`${base}/`)
  await page.evaluate(() => navigator.serviceWorker.ready)
  // Con el SW ya activo, la recarga queda controlada por él.
  await page.reload()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  // Lo que el SW nunca debe guardar: el panel y la API.
  await page.goto(`${base}/admin/login`)
  await page.evaluate(() => fetch('/api/live/current').then((response) => response.status))
  await page.goto(`${base}/partidos`)
  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(new URL(request.url).pathname)
    }
    return urls
  })
  expect(cached).toContain('/offline')
  expect(cached.some((url) => url.startsWith('/_next/static/'))).toBe(true)
  expect(cached.filter((url) => url.startsWith('/admin') || url.startsWith('/api'))).toEqual([])
  // El HTML de las páginas no se guarda (podría quedar viejo): solo el respaldo /offline.
  expect(cached).not.toContain('/partidos')

  // Sin red, una página responde con el respaldo.
  await context.setOffline(true)
  await page.goto(`${base}/noticias`).catch(() => undefined)
  await expect(page.getByRole('heading', { level: 1, name: 'Sin conexión' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Volver a intentar' })).toHaveAttribute('href', '/')
  await context.setOffline(false)
  await page.goto(`${base}/offline`)
  await expectAccessible(page)
})
