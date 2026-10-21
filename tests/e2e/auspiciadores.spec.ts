import { expect, type Page, test } from '@playwright/test'
import {
  ADMIN,
  expectAccessible,
  login,
  uniqueIp,
  useOwnIp,
  waitForMail,
  waitForMailMatching,
  waitForTurnstile,
} from './support'

async function openModule(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Más' }).click()
    await page.getByRole('navigation', { name: 'Todos los módulos' }).getByRole('link', { name }).click()
  } else {
    await page.getByRole('navigation', { name: 'Módulos del panel' }).getByRole('link', { name }).click()
  }
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

test('vitrina por nivel con enlaces que cuentan clics, y reporte del mes en el panel', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/auspiciadores')
  await expect(page.getByRole('heading', { level: 1, name: 'Auspiciadores' })).toBeVisible()
  await expect(page.locator('#nivel-principal')).toBeVisible()
  const web = page.getByRole('link', { name: /^Sitio web de Ferretería El Roble/ })
  await expect(web).toHaveAttribute('href', '/r/auspiciador/ferreteria-el-roble?a=web')
  await expect(web).toHaveAttribute('rel', 'noopener sponsored')
  await expectAccessible(page)

  // El enlace cuenta y redirige; no se sigue la redirección (example.com no es parte de la prueba).
  const response = await request.get('/r/auspiciador/ferreteria-el-roble?a=web', { maxRedirects: 0 })
  expect(response.status()).toBe(302)
  expect(response.headers().location).toBe('https://example.com/ferreteria-el-roble')

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Auspiciadores', testInfo.project.name === 'celular')
  await page
    .getByRole('navigation', { name: 'Secciones de Auspiciadores' })
    .getByRole('link', { name: 'Reporte de clics' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Reporte de clics' })).toBeVisible()
  await expect(
    page.getByRole('heading', { level: 3, name: /^Ferretería El Roble \(ejemplo\): \d+ clics$/ }),
  ).toBeVisible()
  await expectAccessible(page)

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Exportar CSV' }).click()
  expect((await download).suggestedFilename()).toMatch(/^clics-auspiciadores-\d{4}-\d{2}\.csv$/)
})

test('crear un auspiciador lo muestra en la vitrina; uno vencido se oculta solo', async ({
  page,
}, testInfo) => {
  const stamp = `${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Auspiciadores', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Nuevo auspiciador' }).click()
  await page.getByRole('textbox', { name: 'Nombre' }).fill(`E2E Auspiciador ${stamp}`)
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption('colaborador')
  await page.getByRole('textbox', { name: /^Sitio web/ }).fill('https://example.com/e2e')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/auspiciadores$/)

  await page.goto('/auspiciadores')
  await expect(page.getByRole('heading', { level: 3, name: `E2E Auspiciador ${stamp}` })).toBeVisible()

  // Con una vigencia ya terminada, desaparece de la vitrina.
  await page.goto('/admin/auspiciadores')
  await page.getByRole('link', { name: `E2E Auspiciador ${stamp}` }).click()
  await page.getByRole('textbox', { name: /^Vigente hasta/ }).fill('2020-12-31')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: `E2E Auspiciador ${stamp}` })
      .getByText('Vencido'),
  ).toBeVisible()
  await page.goto('/auspiciadores')
  await expect(page.getByRole('heading', { level: 3, name: `E2E Auspiciador ${stamp}` })).toHaveCount(0)
})

test('el formulario de interés llega a la bandeja de auspicios', async ({ page, request }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const sender = { business: `E2E Comercio ${stamp}`, email: `e2e-auspicio-${stamp}@cachorros.test` }
  await useOwnIp(page, uniqueIp(testInfo.project.name))
  await page.goto('/auspiciadores')
  const form = page.getByRole('main')
  await form.getByRole('textbox', { name: 'Comercio o empresa' }).fill(sender.business)
  await form.getByRole('textbox', { name: 'Tu nombre' }).fill('Rosa Díaz')
  await form.getByRole('textbox', { name: 'Correo' }).fill(sender.email)
  await form.getByRole('combobox', { name: /^Nivel que te interesa/ }).selectOption('oficial')
  await form.getByRole('checkbox', { name: /Acepto la política de privacidad/ }).check()
  await waitForTurnstile(page)
  // El servidor exige al menos 3 s desde que se dibujó el formulario.
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Enviar interés' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Gracias por tu interés!' })).toBeVisible()

  expect(await waitForMail(request, sender.email)).toContain(`el auspicio de ${sender.business}`)
  expect(await waitForMailMatching(request, `to:auspicios@cachorros.test "${sender.business}"`)).toContain(
    'Nivel de interés: Auspiciador oficial',
  )

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/auspiciadores/solicitudes')
  await page.getByRole('link', { name: sender.business }).click()
  await expect(page.getByRole('heading', { level: 1, name: sender.business })).toBeVisible()
  await expectAccessible(page)
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la vitrina muestra los auspiciadores con sus enlaces', async ({ page }) => {
    await page.goto('/auspiciadores')
    await expect(page.getByRole('heading', { level: 3, name: 'Ferretería El Roble (ejemplo)' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^WhatsApp de Minimarket Don Tito/ })).toHaveAttribute(
      'href',
      '/r/auspiciador/minimarket-don-tito?a=whatsapp',
    )
  })
})
