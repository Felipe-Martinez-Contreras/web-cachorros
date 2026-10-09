import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { ADMIN, deleteMailFor, formAlert, login, PASSWORD, recoveryUser, waitForMail } from './support'

test.describe('acceso al panel', () => {
  test('sin sesión, /admin redirige al login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: 'Entrar al panel' })).toBeVisible()
  })

  test('una cookie inventada pasa el proxy pero el layout la rechaza en el servidor', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: 'better-auth.session_token',
        value: 'inventada.firma',
        url: baseURL ?? 'http://localhost:3000',
      },
    ])
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('el login es accesible y no se indexa', async ({ page }) => {
    const response = await page.goto('/admin/login')
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })

  test('credenciales incorrectas muestran el error en español', async ({ page }) => {
    await login(page, ADMIN.email, 'contraseña-equivocada')
    await expect(formAlert(page)).toHaveText('El correo o la contraseña no son correctos.')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })

  test('entrar, guardar un dato del club y cerrar sesión', async ({ page }) => {
    await login(page, ADMIN.email)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    await expect(page.getByText(ADMIN.name)).toBeVisible()

    // Server Action protegida: guarda y confirma.
    await page.goto('/admin/configuracion/club')
    await expect(page.getByRole('heading', { name: 'Datos del club', level: 1 })).toBeVisible()
    const shortName = page.getByRole('textbox', { name: 'Nombre corto' })
    await expect(shortName).toHaveValue(/.+/)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Configuración guardada.')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)

    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
  })
})

test('recuperar la contraseña: el correo llega a Mailpit y el enlace permite crear una nueva', async ({
  page,
  request,
}, testInfo) => {
  const user = recoveryUser(testInfo.project.name)
  const newPassword = `nueva-${PASSWORD}`
  await deleteMailFor(request, user.email)

  await page.goto('/admin/login')
  await page.getByRole('link', { name: 'Olvidé mi contraseña' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible()
  await page.getByLabel('Correo').fill(user.email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByRole('status')).toContainText('te enviamos un enlace')

  const text = await waitForMail(request, user.email)
  const link = text.match(/https?:\/\/\S+\/admin\/restablecer\?token=\S+/)?.[0]
  expect(link, 'el correo trae el enlace para restablecer').toBeTruthy()

  await page.goto(new URL(link ?? '').pathname + new URL(link ?? '').search)
  await page.getByLabel('Contraseña nueva').fill(newPassword)
  await page.getByLabel('Repite la contraseña').fill(newPassword)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('tu contraseña cambió')

  // La contraseña anterior ya no sirve; la nueva sí.
  await login(page, user.email, PASSWORD)
  await expect(formAlert(page)).toHaveText('El correo o la contraseña no son correctos.')
  await login(page, user.email, newPassword)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
})

test('un enlace de recuperación sin token lo explica', async ({ page }) => {
  await page.goto('/admin/restablecer')
  await expect(page.getByText('Este enlace no es válido.')).toBeVisible()
})
