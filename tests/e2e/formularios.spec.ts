import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login, PASSWORD } from './support'

// Lo escrito antes de que la pantalla termine de cargar no debe perderse nunca. El HTML del panel llega
// antes que su JavaScript; aquí ese intervalo se alarga a propósito reteniendo los scripts de la página.

const PREPARING = 'Preparando el formulario…'

const SCRIPTS = /\/_next\/static\/.+\.js(\?.*)?$/
const gates = new WeakMap<Page, { wait: Promise<void> }>()

/**
 * Retiene el JavaScript de la página (la hidratación no ocurre) hasta llamar a la función que devuelve.
 * La intercepción se instala una vez por página; cada llamada vuelve a cerrar la compuerta.
 */
async function holdScripts(page: Page): Promise<() => void> {
  let gate = gates.get(page)
  if (!gate) {
    const created = { wait: Promise.resolve() }
    gate = created
    gates.set(page, created)
    await page.route(SCRIPTS, async (route) => {
      await created.wait
      await route.continue()
    })
  }
  let open: () => void = () => {}
  gate.wait = new Promise<void>((resolve) => {
    open = resolve
  })
  return () => open()
}

async function enter(page: Page) {
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}

test('formulario genérico: con la hidratación retrasada no se puede escribir nada que después se pierda', async ({
  page,
}, testInfo) => {
  const name = `E2E Hidratación ${testInfo.project.name} ${Date.now()}`
  await enter(page)
  await page.goto('/admin/rivales/nuevo')
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(name)
  await page.getByRole('textbox', { name: 'Nombre corto' }).fill('E2E Hidra')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/rivales$/)
  await page.getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { name: `Editar ${name}`, level: 1 })).toBeVisible()
  const editUrl = page.url()

  // Carga completa con el JavaScript retenido: el HTML ya está, React todavía no.
  const release = await holdScripts(page)
  await page.goto(editUrl, { waitUntil: 'domcontentloaded' })
  const commune = page.getByRole('textbox', { name: /^Comuna/ })
  const save = page.getByRole('button', { name: 'Guardar' })
  await expect(page.getByText(PREPARING)).toBeVisible()
  await expect(commune).toBeDisabled()
  await expect(save).toBeDisabled()

  // Aunque la persona toque el campo y escriba, o intente enviar, no pasa nada: no hay nada que perder.
  await commune.click({ force: true })
  await page.keyboard.type('texto que se perdería')
  await page.keyboard.press('Enter')
  await expect(commune).toHaveValue('')
  expect(page.url()).toBe(editUrl)

  release()
  await expect(page.getByText(PREPARING)).toBeHidden()
  await expect(commune).toBeEnabled()
  // Al quedar lista, la pantalla trae los valores guardados, sin restos de lo tecleado antes.
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(name)
  await expect(commune).toHaveValue('')

  await commune.fill('Sagrada Familia')
  await save.click()
  await expect(page).toHaveURL(/\/admin\/rivales$/)
  await page.goto(editUrl)
  await expect(page.getByRole('textbox', { name: /^Comuna/ })).toHaveValue('Sagrada Familia')
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toHaveValue(name)
})

test('escribir apenas carga la página guarda exactamente lo escrito', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name} ${Date.now()}`
  await enter(page)
  await page.goto('/admin/noticias/nueva')
  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(`E2E Noticia rápida ${stamp}`)
  await page.getByRole('button', { name: 'Guardar borrador' }).click()
  await expect(page).toHaveURL(/\/admin\/noticias\/[0-9a-f-]{36}$/)
  const editUrl = page.url()

  // Tres cargas completas seguidas, escribiendo sin esperar nada: el valor final es el tecleado, sin el
  // anterior pegado adelante ni letras de menos.
  for (const round of [1, 2, 3]) {
    const title = `E2E Noticia rápida ${stamp} v${round}`
    const release = await holdScripts(page)
    await page.goto(editUrl, { waitUntil: 'domcontentloaded' })
    // Se suelta el JavaScript mientras Playwright ya está intentando escribir.
    const titleField = page.getByRole('textbox', { name: 'Título', exact: true })
    const typing = titleField.fill(title)
    release()
    await typing
    // Uno después del otro: dos escrituras simultáneas de Playwright se quitarían el foco entre sí.
    await page.getByRole('textbox', { name: /^Resumen/ }).fill(`Resumen ${round}`)
    await expect(titleField).toHaveValue(title)
    await page.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(page.getByText('Noticia guardada.')).toBeVisible()
    await page.goto(editUrl)
    await expect(page.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(title)
    await expect(page.getByRole('textbox', { name: /^Resumen/ })).toHaveValue(`Resumen ${round}`)
  }
})

test('los demás formularios del panel también esperan: acceso, jornada, configuración, tabla y cuenta', async ({
  page,
}) => {
  // Login: con el JavaScript retenido no se puede enviar (la contraseña nunca viaja en la dirección).
  let release = await holdScripts(page)
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText(PREPARING)).toBeVisible()
  await expect(page.getByLabel('Correo')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  release()
  await page.getByLabel('Correo').fill(ADMIN.email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  expect(page.url()).not.toContain('password')

  for (const path of [
    '/admin/partidos/jornada',
    '/admin/configuracion/contacto',
    '/admin/posiciones/nueva',
    '/admin/cuenta',
  ]) {
    release = await holdScripts(page)
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(PREPARING).first(), `${path} avisa que se está preparando`).toBeVisible()
    const controls = page.locator('main fieldset').first().locator('input, select, textarea, button')
    expect(await controls.count(), `${path} tiene controles`).toBeGreaterThan(0)
    for (const control of await controls.all()) await expect(control).toBeDisabled()
    release()
    await expect(page.getByText(PREPARING)).toHaveCount(0)
    await expect(controls.first()).toBeEnabled()
  }
})
