import AxeBuilder from '@axe-core/playwright'
import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Sin violaciones serias ni críticas de axe. Antes espera el `<title>`: tras una navegación en el cliente,
 * Next 16 envía los metadatos por streaming y axe podía revisar la página sin título (`document-title`).
 */
export async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/\S/)
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

export const PASSWORD = 'clave-e2e-de-pruebas-2026'
export const ADMIN = { name: 'Admin E2E', email: 'e2e-admin@cachorros.test' }

/** Cada proyecto (celular / escritorio) recupera la contraseña de un usuario propio. */
export function recoveryUser(project: string) {
  return { name: `Recuperación ${project}`, email: `e2e-recuperar-${project}@cachorros.test` }
}

/** Cada proyecto activa los dos pasos en una cuenta propia (cambia cómo se entra). */
export function twoFactorUser(project: string) {
  return { name: `Dos Pasos ${project}`, email: `e2e-dos-pasos-${project}@cachorros.test` }
}

export const E2E_USERS = [
  ADMIN,
  recoveryUser('celular'),
  recoveryUser('escritorio'),
  twoFactorUser('celular'),
  twoFactorUser('escritorio'),
]

const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/admin/login')
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

/** El mensaje de error del formulario (Next agrega su propio role="alert" para anunciar rutas). */
export function formAlert(page: Page) {
  return page.getByRole('main').getByRole('alert')
}

export async function deleteMailFor(request: APIRequestContext, email: string) {
  await request.delete(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } })
}

/** Espera el correo más reciente para esa dirección en Mailpit y devuelve su texto. */
export function waitForMail(request: APIRequestContext, email: string): Promise<string> {
  return waitForMailMatching(request, `to:${email}`)
}

/** Espera el correo más reciente que cumple la búsqueda de Mailpit (`to:… "frase"`) y devuelve su texto. */
export async function waitForMailMatching(request: APIRequestContext, query: string): Promise<string> {
  let text = ''
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query } })
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    const latest = messages[0]
    expect(latest, `todavía no llega el correo (${query})`).toBeTruthy()
    const message = await request.get(`${MAILPIT}/api/v1/message/${latest?.ID}`)
    text = ((await message.json()) as { Text: string }).Text
  }).toPass({ timeout: 15_000 })
  return text
}

/**
 * El rate limit cuenta por IP y aquí todas las peticiones llegan desde la misma máquina: cada prueba envía
 * su propia IP simulada (`x-e2e-client-ip`, que el servidor solo acepta con SITE_ENV=development). Se agrega
 * solo a `/api/forms/*`: en las peticiones a Cloudflare (Turnstile) rompería CORS.
 */
export async function useOwnIp(page: Page, ip: string) {
  await page.route('**/api/forms/**', (route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-e2e-client-ip': ip } }),
  )
}

export const uniqueIp = (project: string) =>
  `e2e-${project}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

/** El widget de prueba de Turnstile («siempre pasa») deja su token en el formulario. */
export async function waitForTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, { timeout: 20_000 })
}

/** Abre un módulo desde la navegación del panel: en el celular está dentro de «Más». */
export async function openModule(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Más' }).click()
    await page.getByRole('navigation', { name: 'Todos los módulos' }).getByRole('link', { name }).click()
  } else {
    await page.getByRole('navigation', { name: 'Módulos del panel' }).getByRole('link', { name }).click()
  }
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Las tarjetas del panel no se dibujan al abrir la página: si todavía no existe, aparece «Ver imagen».
 * Se pide (así se dibuja y queda en caché) y se recarga: la vista previa queda como imagen de 1080 px.
 */
export async function drawCardPreview(page: Page, altPrefix: string) {
  const image = page.getByRole('img', { name: new RegExp(`^${escapeRegExp(altPrefix)}`) })
  // El nombre es «Ver imagen» y, solo para lectores de pantalla, de qué tarjeta es.
  const link = page.getByRole('link', {
    name: new RegExp(`^Ver imagen\\s*:\\s*${escapeRegExp(altPrefix)}`),
  })
  await expect(image.or(link).first()).toBeVisible()
  if ((await link.count()) > 0) {
    const href = await link.first().getAttribute('href')
    const response = await page.request.get(href ?? '')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
    await page.reload()
  }
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080)
  return image
}
