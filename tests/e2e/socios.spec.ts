import { readFile } from 'node:fs/promises'
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

/** En el celular los módulos están en la hoja «Más»; en escritorio, en el menú lateral. */
async function openModule(page: Page, name: string, isMobile: boolean) {
  if (isMobile) {
    await page.getByRole('button', { name: 'Más' }).click()
    await page.getByRole('navigation', { name: 'Todos los módulos' }).getByRole('link', { name }).click()
  } else {
    await page.getByRole('navigation', { name: 'Módulos del panel' }).getByRole('link', { name }).click()
  }
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

test('hacerse socio: solicitud con aviso y acuse, aprobación con número y padrón en CSV', async ({
  page,
  request,
}, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const sender = { name: `E2E Socio ${stamp}`, email: `e2e-socio-${stamp}@cachorros.test` }
  await useOwnIp(page, uniqueIp(testInfo.project.name))

  // 1. La página pública: planes con su cuota y el formulario con el plan elegido.
  await page.goto('/socios')
  await expect(page.getByRole('heading', { level: 1, name: 'Hazte socio' })).toBeVisible()
  await page.getByRole('link', { name: 'Elegir Socio cooperador' }).click()
  await expect(page).toHaveURL(/\/socios\?plan=.+#formulario$/)
  const form = page.getByRole('main')
  await expect(form.getByRole('combobox', { name: 'Plan' })).toHaveValue(/.+/)
  await expect(form.getByRole('combobox', { name: 'Plan' }).locator('option:checked')).toHaveText(
    /^Socio cooperador · \$5\.000 al mes$/,
  )
  await form.getByRole('textbox', { name: 'Nombre completo' }).fill(sender.name)
  await form.getByRole('textbox', { name: 'Correo' }).fill(sender.email)
  await form.getByRole('textbox', { name: 'Celular' }).fill('9 8765 4321')
  await form.getByRole('textbox', { name: 'Comuna' }).fill('Sagrada Familia')
  // Un RUT con el dígito verificador equivocado se marca junto al campo.
  await form.getByRole('textbox', { name: /^RUT/ }).fill('12.345.678-9')
  await form.getByRole('checkbox', { name: /Acepto la política de privacidad/ }).check()
  await waitForTurnstile(page)
  await expectAccessible(page)
  // El servidor exige al menos 3 s desde que se dibujó el formulario.
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(form.getByText('Revisa el RUT: el dígito verificador no coincide.')).toBeVisible()

  await form.getByRole('textbox', { name: /^RUT/ }).fill('12.345.678-5')
  // Tras cada envío el widget se reinicia (un token sirve una vez): se espera el token nuevo.
  await page.waitForTimeout(1000)
  await waitForTurnstile(page)
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Solicitud enviada!' })).toBeVisible()

  const ack = await waitForMail(request, sender.email)
  expect(ack).toContain('Recibimos tu solicitud para hacerte socio (plan Socio cooperador)')
  const staff = await waitForMailMatching(request, `to:socios@cachorros.test "${sender.name}"`)
  expect(staff).toContain('RUT: 12.345.678-5')

  // 2. El panel: la solicitud en la bandeja, aprobación con confirmación y alta en el padrón.
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Socios', isMobile)
  await page.getByRole('link', { name: sender.name }).click()
  await expect(page.getByRole('heading', { level: 1, name: sender.name })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Responder por correo' })).toHaveAttribute(
    'href',
    new RegExp(`^mailto:${sender.email}\\?subject=`),
  )
  await expect(page.getByRole('link', { name: 'Responder por WhatsApp' })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/56987654321\?text=/,
  )
  await expectAccessible(page)

  await page.getByRole('button', { name: 'Aprobar y dar de alta' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Aprobar y dar de alta' }).click()
  await expect(page.getByText('Socio dado de alta en el padrón.')).toBeVisible()
  const memberLink = page.getByRole('link', { name: /^socio N\.º \d+$/ })
  await expect(memberLink).toBeVisible()
  const number = (await memberLink.textContent())?.match(/\d+/)?.[0]

  await page.getByRole('link', { name: '← Solicitudes' }).click()
  await page
    .getByRole('navigation', { name: 'Secciones de Socios' })
    .getByRole('link', { name: 'Padrón' })
    .click()
  await expect(page.getByRole('heading', { level: 1, name: 'Padrón de socios' })).toBeVisible()
  await page.getByRole('searchbox').fill(sender.name)
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page.getByRole('link', { name: `N.º ${number} · ${sender.name}` })).toBeVisible()

  const download = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Exportar CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^padron-de-socios-\d{4}-\d{2}-\d{2}\.csv$/)
  const csv = await readFile(await file.path(), 'utf8')
  expect(csv).toContain(
    `${number};${sender.name};12.345.678-5;${sender.email};+56987654321;Socio cooperador;Activo;`,
  )
})

test('la bandeja de mensajes cambia el estado de un mensaje', async ({ page }, testInfo) => {
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Mensajes', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Contacto Ejemplo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Contacto Ejemplo' })).toBeVisible()
  // Next deja la lista anterior oculta en la página, con su propio «Estado»: se elige el del formulario.
  const status = page.locator('select[name="status"]')
  await status.selectOption('en_revision')
  await expect(status).toHaveValue('en_revision')
  await page.getByRole('textbox', { name: /^Notas internas/ }).fill(`Revisado por ${testInfo.project.name}`)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/mensajes$/)
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Contacto Ejemplo' }).getByText('En revisión'),
  ).toBeVisible()
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la política de privacidad muestra su versión y Hazte socio sus planes', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacidad' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible()
    await expect(page.getByText(/^Versión vigente del .+ \d{1,2} de .+ de \d{4}/)).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Tus derechos' })).toBeVisible()

    await page.goto('/socios')
    await expect(page.getByRole('heading', { level: 3, name: 'Socio activo' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Preguntas frecuentes' })).toBeVisible()
  })
})

test('la política de privacidad es accesible y está enlazada desde cada formulario', async ({ page }) => {
  for (const path of ['/contacto', '/socios']) {
    await page.goto(path)
    await expect(
      page.getByRole('main').getByRole('link', { name: 'política de privacidad' }),
    ).toHaveAttribute('href', '/privacidad')
  }
  await page.goto('/privacidad')
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad' })).toBeVisible()
  await expectAccessible(page)
})
