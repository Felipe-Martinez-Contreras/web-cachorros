import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login } from './support'

async function enter(page: Page) {
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'la página no debe tener scroll horizontal').toBeLessThanOrEqual(0)
}

test('un hito creado en el panel aparece en la línea de tiempo, se edita y se elimina', async ({
  page,
}, testInfo) => {
  const title = `E2E Hito ${testInfo.project.name} ${Date.now()}`
  await enter(page)
  await page.goto('/admin/historia')
  await expect(page).toHaveURL(/\/admin\/historia\/hitos$/)
  await expect(page.getByRole('heading', { name: 'Historia', level: 1 })).toBeVisible()
  await expectAccessible(page)

  await page.getByRole('link', { name: 'Nuevo hito' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo hito', level: 1 })).toBeVisible()
  // Un día sin mes no dice nada: se explica junto al campo.
  await page.getByRole('textbox', { name: 'Título' }).fill(title)
  await page.getByRole('spinbutton', { name: 'Año' }).fill('1999')
  await page.getByRole('spinbutton', { name: /^Día/ }).fill('12')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Para indicar el día, elige también el mes.')).toBeVisible()
  await page.getByRole('combobox', { name: /^Mes/ }).selectOption({ label: 'Agosto' })
  await page.getByRole('textbox', { name: /^Relato/ }).fill('Relato del hito de prueba.')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/historia\/hitos$/)
  await expect(page.getByRole('link', { name: title })).toBeVisible()

  // En la carga siguiente está en el sitio, con su fecha completa.
  await page.goto('/historia')
  const item = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) })
  await expect(item).toBeVisible()
  await expect(item.getByText('12 de agosto de 1999')).toBeVisible()
  await expect(item.getByText('Relato del hito de prueba.')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.goto('/admin/historia/hitos')
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByRole('heading', { name: 'Editar hito', level: 1 })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Dato por confirmar' }).check()
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/historia\/hitos$/)
  await page.goto('/historia?decada=1990')
  await expect(item.getByText('Por confirmar', { exact: true })).toBeVisible()

  await page.goto('/admin/historia/hitos')
  await page.getByRole('link', { name: title }).click()
  await page.getByRole('button', { name: 'Eliminar hito' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page).toHaveURL(/\/admin\/historia\/hitos$/)
  await page.goto('/historia')
  await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
})

test('el salón de la fama se ordena desde el panel', async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name} ${Date.now()}`
  await enter(page)
  for (const name of [`E2E Ídolo A ${stamp}`, `E2E Ídolo B ${stamp}`]) {
    await page.goto('/admin/historia/salon-de-la-fama/nuevo')
    await expect(page.getByRole('heading', { name: 'Nuevo ídolo', level: 1 })).toBeVisible()
    await page.getByRole('textbox', { name: 'Nombre' }).fill(name)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page).toHaveURL(/\/admin\/historia\/salon-de-la-fama$/)
  }
  // Lo nuevo queda al final; «subir» lo adelanta y el sitio sigue ese orden.
  await page.getByRole('button', { name: `Subir E2E Ídolo B ${stamp}` }).click()
  await expect(page.getByRole('button', { name: `Bajar E2E Ídolo B ${stamp}` })).toBeEnabled()
  await page.goto('/historia/salon-de-la-fama')
  const names = await page.getByRole('main').getByRole('heading', { level: 2 }).allTextContents()
  expect(names.indexOf(`E2E Ídolo B ${stamp}`)).toBeLessThan(names.indexOf(`E2E Ídolo A ${stamp}`))
  expect(names.indexOf(`E2E Ídolo B ${stamp}`)).toBeGreaterThanOrEqual(0)
})

test('el relato de la historia se edita en «Textos de páginas»', async ({ page }, testInfo) => {
  const phrase = `E2E relato ${testInfo.project.name} ${Date.now()}.`
  await enter(page)
  await page.goto('/admin/textos')
  await expect(page.getByRole('heading', { name: 'Textos de páginas', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Historia · relato del club' }).click()
  const editor = page.getByRole('textbox', { name: 'Texto', exact: true })
  await editor.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(phrase)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Texto guardado.')).toBeVisible()

  await page.goto('/historia')
  await expect(page.getByText(phrase)).toBeVisible()
})

test.describe('historia sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('el relato, la línea de tiempo, el filtro por década y las subpáginas funcionan', async ({ page }) => {
    expect((await page.goto('/historia'))?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Historia', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nuestra historia', level: 2 })).toBeVisible()

    const timeline = page.getByRole('region', { name: 'Hitos del club en orden cronológico' })
    const founding = timeline.getByRole('listitem').filter({ hasText: 'Fundación del club' })
    await expect(founding.getByText('1 de abril de 1934', { exact: true })).toBeVisible()
    // Ancla por año: /historia#1934.
    await expect(page.locator('[id="1934"]')).toHaveCount(1)
    // Lo que el club no ha confirmado se muestra marcado, nunca inventado.
    await expect(timeline.getByText('Por confirmar', { exact: true }).first()).toBeVisible()

    await page
      .getByRole('navigation', { name: 'Filtrar por década' })
      .getByRole('link', { name: '1980–1989' })
      .click()
    await expect(page).toHaveURL(/decada=1980/)
    await expect(timeline.getByRole('heading', { name: '50 años del club' })).toBeVisible()
    await expect(timeline.getByText('Fundación del club')).toHaveCount(0)

    await expect(page.getByRole('link', { name: 'Compartir mis fotos' })).toHaveAttribute(
      'href',
      '/contacto?tema=historia',
    )

    const sections = page.getByRole('navigation', { name: 'Secciones de Historia' })
    for (const [link, heading] of [
      ['Títulos', 'Títulos'],
      ['Salón de la fama', 'Salón de la fama'],
      ['Camisetas', 'Camisetas históricas'],
    ] as const) {
      await sections.getByRole('link', { name: link }).click()
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expect(page.getByRole('main').getByRole('listitem').first()).toBeVisible()
    }
  })
})

test('las páginas de historia son accesibles y no desbordan', async ({ page }) => {
  for (const path of [
    '/historia',
    '/historia/titulos',
    '/historia/salon-de-la-fama',
    '/historia/camisetas',
  ]) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page)
  }
})
