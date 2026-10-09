import type { APIRequestContext, Page } from '@playwright/test'
import { expect } from '@playwright/test'

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
export async function waitForMail(request: APIRequestContext, email: string): Promise<string> {
  let text = ''
  await expect(async () => {
    const search = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:${email}` } })
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    const latest = messages[0]
    expect(latest, `todavía no llega el correo para ${email}`).toBeTruthy()
    const message = await request.get(`${MAILPIT}/api/v1/message/${latest?.ID}`)
    text = ((await message.json()) as { Text: string }).Text
  }).toPass({ timeout: 15_000 })
  return text
}
