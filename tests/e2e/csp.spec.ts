import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login, waitForTurnstile } from './support'

// CSP en modo Report-Only (especificación 9.3): el navegador no bloquea, pero dispara
// `securitypolicyviolation` por cada cosa que la política bloquearía. Ninguna página debe dispararlo.

type Violation = { directive: string; blocked: string; page: string }

async function watchViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: Violation[] = []
    Object.defineProperty(window, '__cspViolations', { value: seen })
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push({ directive: event.effectiveDirective, blocked: event.blockedURI, page: location.pathname })
    })
  })
  return () => page.evaluate(() => (window as unknown as { __cspViolations: Violation[] }).__cspViolations)
}

/** Los terceros no son parte de la prueba: se responden aquí, sin salir a internet. */
async function stubThirdParties(page: Page) {
  for (const host of ['https://www.youtube-nocookie.com/**', 'https://www.openstreetmap.org/**']) {
    await page.route(host, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Tercero</title>' }),
    )
  }
}

test('sitio público: CSP fija y sin violaciones en portada, formulario, visor, mapa y videos', async ({
  page,
}) => {
  const violations = await watchViolations(page)
  await stubThirdParties(page)

  const home = await page.goto('/')
  const csp = home?.headers()['content-security-policy-report-only'] ?? ''
  expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com")
  expect(csp).toContain('report-uri /api/csp-report')
  expect(csp).not.toContain('nonce-')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

  // Formulario con Turnstile (script e iframe de Cloudflare).
  await page.goto('/contacto')
  await waitForTurnstile(page)

  // Visor de la galería.
  await page.goto('/galeria')
  await page.getByRole('link', { name: /^Aniversario \d+ del club$/ }).click()
  await page.getByRole('link', { name: /^Ver foto 1 de / }).click()
  await expect(page.getByRole('dialog', { name: /visor de fotos$/ })).toBeVisible()

  // Mapa de la cancha (iframe de OpenStreetMap después del clic).
  await page.goto('/club/la-cancha')
  await page.getByRole('link', { name: 'Ver el mapa' }).click()
  await expect(page.locator('iframe[title^="Mapa"]')).toBeVisible()

  // Video detrás de su fachada (iframe de youtube-nocookie después del clic).
  await page.goto('/videos')
  const video = page.getByRole('link', { name: /^Ver el video:/ }).first()
  if ((await video.count()) > 0) {
    await video.click()
    await expect(page.locator('iframe[src*="youtube-nocookie"]')).toBeVisible()
  }

  expect(await violations()).toEqual([])
})

test('panel: CSP estricta con nonce en cada petición y sin violaciones', async ({ page }) => {
  const violations = await watchViolations(page)
  const responses: string[] = []
  page.on('response', (response) => {
    const header = response.headers()['content-security-policy-report-only']
    if (response.request().resourceType() === 'document' && header) responses.push(header)
  })
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/partidos')
  await expect(page.getByRole('heading', { name: 'Partidos', level: 1 })).toBeVisible()
  // El editor de noticias se carga con import(): 'strict-dynamic' lo permite.
  await page.goto('/admin/noticias/nueva')
  await expect(page.getByRole('textbox', { name: 'Texto de la noticia' })).toBeVisible()

  const nonces = responses.map((header) => /'nonce-([^']+)'/.exec(header)?.[1])
  expect(nonces.length).toBeGreaterThanOrEqual(2)
  expect(nonces.every(Boolean)).toBe(true)
  expect(new Set(nonces).size).toBe(nonces.length)
  // Los scripts de Next llevan el nonce de su respuesta. El navegador oculta el atributo en el DOM, así
  // que se revisa el HTML tal como llega.
  const raw = await page.request.get('/admin/partidos')
  const nonce = /'nonce-([^']+)'/.exec(raw.headers()['content-security-policy-report-only'] ?? '')?.[1]
  const html = await raw.text()
  expect(html).toContain(`<script nonce="${nonce}"`)
  expect(html.match(/<script(?![^>]*nonce=)[^>]*>/g) ?? []).toEqual([])
  expect(await violations()).toEqual([])
})
