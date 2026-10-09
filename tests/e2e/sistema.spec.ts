import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { totpCode } from '../totp'
import { ADMIN, deleteMailFor, formAlert, login, PASSWORD, twoFactorUser, waitForMail } from './support'

async function enter(page: Page, email = ADMIN.email, password = PASSWORD) {
  await login(page, email, password)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
}

test('configuración: cambiar el WhatsApp del club se ve en el sitio en la carga siguiente', async ({
  page,
}, testInfo) => {
  // Un número distinto por proyecto: el celular y el escritorio comparten la misma configuración.
  const digits = testInfo.project.name === 'celular' ? '21' : '22'
  await enter(page)
  await page.goto('/admin/configuracion')
  await expect(page.getByRole('heading', { name: 'Configuración', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Contacto y avisos' }).click()
  await expect(page.getByRole('heading', { name: 'Contacto y avisos', level: 1 })).toBeVisible()

  const whatsapp = page.getByRole('textbox', { name: /^WhatsApp del club/ })
  await expect(whatsapp).toHaveValue(/^\+56/)
  await whatsapp.fill('12345')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe el teléfono con su código: +56 9 1234 5678.')).toBeVisible()

  await whatsapp.fill(`9 8765 43${digits}`)
  await page
    .getByRole('textbox', { name: /^Avisar los mensajes de contacto a/ })
    .fill('contacto@cachorros.test')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Configuración guardada.')).toBeVisible()

  await page.goto('/')
  await expect(page.locator(`footer a[href*="wa.me/569876543${digits}"]`).first()).toBeVisible()
  // Los destinatarios de los avisos son internos: nunca llegan al sitio.
  expect(await page.content()).not.toContain('contacto@cachorros.test')
})

test('configuración: el destino del botón de la portada debe ser seguro', async ({ page }) => {
  await enter(page)
  await page.goto('/admin/configuracion/portada')
  await expect(page.getByRole('heading', { name: 'Portada', level: 1 })).toBeVisible()
  const target = page.getByRole('textbox', { name: /^A dónde lleva el botón/ })
  await expect(target).toHaveValue('/socios')
  await target.fill('javascript:alert(1)')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/Escribe una página del sitio/)).toBeVisible()
})

test('usuarios: invitar, crear la contraseña desde el correo, entrar y desactivar la cuenta', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90_000)
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const invited = { name: `E2E Invitada ${stamp}`, email: `e2e-invitada-${stamp}@cachorros.test` }
  const password = `clave-invitada-${stamp}`
  await deleteMailFor(request, invited.email)

  await enter(page)
  await page.goto('/admin/usuarios')
  await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('textbox', { name: 'Nombre' }).fill(invited.name)
  await page.getByRole('textbox', { name: 'Correo' }).fill(invited.email)
  await page.getByRole('button', { name: 'Enviar invitación' }).click()
  await expect(page.getByText('Invitación enviada. El enlace vale por 1 hora.')).toBeVisible()
  const row = page.getByRole('listitem').filter({ hasText: invited.email })
  await expect(row.getByText('Sin dos pasos')).toBeVisible()

  // El correo es una invitación (no «restablece tu contraseña») y trae el enlace.
  const text = await waitForMail(request, invited.email)
  expect(text).toContain('Te dieron acceso al panel del sitio del club.')
  const link = text.match(/https?:\/\/\S+\/admin\/restablecer\?token=\S+/)?.[0]
  expect(link, 'el correo trae el enlace para crear la contraseña').toBeTruthy()
  await logout(page)

  await page.goto(new URL(link ?? '').pathname + new URL(link ?? '').search)
  await page.getByLabel('Contraseña nueva').fill(password)
  await page.getByLabel('Repite la contraseña').fill(password)
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByRole('status')).toContainText('tu contraseña cambió')

  await enter(page, invited.email, password)
  await expect(page.getByText(invited.name)).toBeVisible()
  await logout(page)

  // Al desactivarla pierde el acceso de inmediato.
  await enter(page)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: `Desactivar la cuenta de ${invited.name}` }).click()
  await page.getByRole('button', { name: 'Sí, desactivar' }).click()
  await expect(page.getByText('Cuenta desactivada.')).toBeVisible()
  await expect(row.getByText('Desactivada', { exact: true })).toBeVisible()
  await logout(page)
  await login(page, invited.email, password)
  await expect(formAlert(page)).toHaveText('Tu cuenta está desactivada. Habla con la directiva del club.')
})

test('mi cuenta: activar los dos pasos con el código QR, entrar con el código y desactivarlos', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000)
  const user = twoFactorUser(testInfo.project.name)
  await enter(page, user.email)
  await page.goto('/admin/cuenta')
  await expect(page.getByRole('heading', { name: 'Mi cuenta', level: 1 })).toBeVisible()
  await expect(page.getByText('Sin activar')).toBeVisible()
  await expect(page.getByText('Esta sesión')).toBeVisible()
  await expectAccessible(page)

  // Con la contraseña equivocada no se muestra nada.
  const confirm = page.getByLabel('Tu contraseña, para activarla')
  await confirm.fill('no-es-mi-clave')
  await page.getByRole('button', { name: 'Activar los dos pasos' }).click()
  await expect(page.getByText('La contraseña no es correcta.')).toBeVisible()

  await confirm.fill(PASSWORD)
  await page.getByRole('button', { name: 'Activar los dos pasos' }).click()
  const qr = page.getByRole('img', { name: 'Código QR para configurar la app autenticadora' })
  await expect(qr).toBeVisible()
  // El QR es una imagen SVG generada en el servidor: no se pide nada a terceros.
  expect(await qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  const uri = await page.getByRole('link', { name: 'Abrir en la app autenticadora' }).getAttribute('href')
  expect(uri).toMatch(/^otpauth:\/\/totp\//)
  await expectAccessible(page)

  await page.getByLabel('Código de la app').fill('000000')
  await page.getByRole('button', { name: 'Activar', exact: true }).click()
  await expect(
    page.getByText('Ese código no es correcto. Revisa la app y vuelve a intentarlo.'),
  ).toBeVisible()
  await page.getByLabel('Código de la app').fill(totpCode(uri ?? ''))
  await page.getByRole('button', { name: 'Activar', exact: true }).click()
  await expect(page.getByText('Lista: tu cuenta ya pide el código al entrar')).toBeVisible()
  const codes = page.getByRole('list', { name: 'Códigos de respaldo' }).getByRole('listitem')
  expect(await codes.count()).toBeGreaterThanOrEqual(8)
  await page.getByRole('button', { name: 'Ya los guardé' }).click()
  await expect(page.getByText('Activada', { exact: true })).toBeVisible()

  // Queda anotado en Actividad.
  await page.goto('/admin/actividad?tipo=user')
  await expect(page.getByRole('heading', { name: 'Actividad', level: 1 })).toBeVisible()
  await expect(page.getByText('Activó la verificación en dos pasos').first()).toBeVisible()
  await expectAccessible(page)
  await logout(page)

  // Ahora la contraseña sola no alcanza.
  await login(page, user.email)
  await expect(page.getByText(/Tu cuenta tiene verificación en dos pasos/)).toBeVisible()
  await page.getByLabel('Código de la app').fill('111111')
  await page.getByRole('button', { name: 'Verificar y entrar' }).click()
  await expect(formAlert(page)).toHaveText('Ese código no es correcto. Revisa la app y vuelve a intentarlo.')
  await page.getByLabel('Código de la app').fill(totpCode(uri ?? ''))
  await page.getByRole('button', { name: 'Verificar y entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()

  await page.goto('/admin/cuenta')
  await page.getByLabel('Tu contraseña, para desactivarla').fill(PASSWORD)
  await page.getByRole('button', { name: 'Desactivar los dos pasos' }).click()
  await expect(page.getByText('Verificación en dos pasos desactivada.')).toBeVisible()
  await expect(page.getByText('Sin activar')).toBeVisible()
})

test('actividad: se filtra por tipo y por persona', async ({ page }) => {
  await enter(page)
  await page.goto('/admin/actividad')
  await expect(page.getByRole('heading', { name: 'Actividad', level: 1 })).toBeVisible()
  const list = page.getByRole('list', { name: 'Actividad' })
  await expect(list.getByRole('listitem').first()).toBeVisible()

  await page.getByRole('combobox', { name: 'Persona' }).selectOption({ label: 'El sistema' })
  await page.getByRole('button', { name: 'Filtrar' }).click()
  await expect(page).toHaveURL(/persona=sistema/)
  await expect(list.getByRole('listitem').first()).toContainText('El sistema')

  await page.goto('/admin/actividad?desde=2999-01-01')
  await expect(page.getByText('Sin actividad con esos filtros')).toBeVisible()
})

test('inicio del panel: accesos rápidos y partidos de la semana', async ({ page }) => {
  await enter(page)
  const quick = page.getByRole('navigation', { name: 'Accesos rápidos' })
  await expect(quick.getByRole('link', { name: 'Nueva noticia' })).toBeVisible()
  await expect(quick.getByRole('link', { name: 'Programar jornada' })).toBeVisible()
  await expect(quick.getByRole('link', { name: 'Subir fotos' })).toBeVisible()
  // El seed deja partidos por jugar el próximo fin de semana.
  await expect(page.getByRole('link', { name: 'Cargar resultado' }).first()).toBeVisible()
  await expect(page.getByText('Versión instalada:')).toBeVisible()
  await expect(page.getByText('todavía no hay respaldos registrados')).toBeVisible()
  await expectAccessible(page)
  await quick.getByRole('link', { name: 'Nueva noticia' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva noticia', level: 1 })).toBeVisible()
})
