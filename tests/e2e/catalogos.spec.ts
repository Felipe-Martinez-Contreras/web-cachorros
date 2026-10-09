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

test('crear un rival y una cancha, con errores claros y sin datos a medias', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const stamp = `${testInfo.project.name} ${Date.now()}`
  await enter(page)

  await openModule(page, 'Rivales', isMobile)
  await page.getByRole('link', { name: 'Nuevo rival' }).click()
  await expect(page.getByRole('heading', { name: 'Nuevo rival', level: 1 })).toBeVisible()
  await expectAccessible(page)

  // Enviar vacío: errores junto a cada campo y foco en el primero.
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Escribe el nombre del club.')).toBeVisible()
  await expect(page.getByText('Escribe el nombre corto.')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Nombre', exact: true })).toBeFocused()

  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(`E2E Rival ${stamp}`)
  await page.getByRole('textbox', { name: 'Nombre corto' }).fill('E2E Rival')
  await page.getByRole('textbox', { name: /^Comuna/ }).fill('Sagrada Familia')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/rivales$/)
  await expect(page.getByText('Guardado.')).toBeVisible()
  await expect(page.getByRole('link', { name: `E2E Rival ${stamp}` })).toBeVisible()

  await openModule(page, 'Canchas', isMobile)
  await page.getByRole('link', { name: 'Nueva cancha' }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill(`E2E Cancha ${stamp}`)
  // Un enlace corto no trae coordenadas: se explica qué pegar.
  await page.getByRole('textbox', { name: /^Ubicación en el mapa/ }).fill('https://maps.app.goo.gl/abc123')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(/No encontramos las coordenadas/)).toBeVisible()
  await page
    .getByRole('textbox', { name: /^Ubicación en el mapa/ })
    .fill('https://www.google.com/maps/@-35.0123,-71.4567,17z')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/canchas$/)

  // Al volver a abrirla, la ubicación quedó como coordenadas.
  await page.getByRole('link', { name: `E2E Cancha ${stamp}` }).click()
  await expect(page.getByRole('textbox', { name: /^Ubicación en el mapa/ })).toHaveValue('-35.0123, -71.4567')
})

test('crear un jugador inscrito en una serie y editar su inscripción', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const lastName = `Prueba${Date.now()}`
  // Números altos y distintos por proyecto para no chocar con el plantel del seed.
  const shirt = isMobile ? '97' : '98'
  await enter(page)

  await openModule(page, 'Jugadores', isMobile)
  await expectAccessible(page)
  await page.getByRole('link', { name: 'Nuevo jugador' }).click()
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('E2E Jugador')
  await page.getByRole('textbox', { name: 'Apellido' }).fill(lastName)
  await page.getByRole('combobox', { name: 'Posición', exact: true }).selectOption({ label: 'Delantero' })
  await page.getByRole('combobox', { name: /^Inscribir en la serie/ }).selectOption({ label: 'Honor' })
  await page.getByRole('spinbutton', { name: /^Número de camiseta/ }).fill(shirt)
  await page.getByRole('button', { name: 'Crear jugador' }).click()

  // Queda en la ficha, ya inscrito.
  await expect(page.getByRole('heading', { name: `E2E Jugador ${lastName}`, level: 1 })).toBeVisible()
  await expect(page.getByText('Jugador creado.')).toBeVisible()
  const registrations = page.getByRole('list', { name: 'Inscripciones' })
  await expect(registrations.getByText(/^Honor · /)).toBeVisible()
  await expect(registrations.getByText(`Camiseta ${shirt}`)).toBeVisible()

  // Inscribirlo otra vez en la misma serie se rechaza con un mensaje claro.
  await page.getByText('Inscribir en una serie').click()
  const addForm = page.locator('details', { hasText: 'Inscribir en una serie' })
  await addForm.getByRole('combobox', { name: 'Serie' }).selectOption({ label: 'Honor' })
  await addForm.getByRole('button', { name: 'Inscribir' }).click()
  await expect(addForm.getByText('Ya está inscrito en esa serie y temporada.')).toBeVisible()

  // Aparece en la lista filtrada por su serie.
  await page.goto(`/admin/jugadores?q=${lastName}`)
  await expect(page.getByRole('link', { name: new RegExp(`${lastName}, E2E Jugador`) })).toBeVisible()
  await expect(page.getByText(`Honor #${shirt}`)).toBeVisible()
})
