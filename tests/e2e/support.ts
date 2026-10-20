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
