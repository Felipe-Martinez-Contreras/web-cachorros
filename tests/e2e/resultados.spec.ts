import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login } from './support'

// Los partidos que crean estas pruebas usan fechas desde la 40: `e2e-clean` los borra antes de cada corrida.

async function enter(page: Page) {
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
}

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

const year = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric' }).format(
  new Date(),
)

test('programar un partido, cargar su resultado completo y verlo en el sitio en la siguiente carga', async ({
  page,
}, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  // El de escritorio queda más tarde el mismo día: así cada corrida ve el suyo como último resultado.
  const round = isMobile ? 40 : 41
  const time = isMobile ? '00:05' : '00:10'
  const slug = `honor-${year}-fecha-${round}-cachorros-vs-los-litres`
  await enter(page)

  // 1. Programar (los valores por defecto ya traen la serie, el club de local, su cancha y el día de hoy).
  await page.goto('/admin/partidos/nuevo')
  await expect(page.getByRole('heading', { name: 'Programar un partido', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('combobox', { name: 'Serie' }).selectOption({ label: 'Honor' })
  await page.getByRole('combobox', { name: 'Visita' }).selectOption({ label: 'Deportivo Los Litres' })
  await page.getByLabel('Hora', { exact: true }).fill(time)
  await page.getByRole('spinbutton', { name: /^Número de fecha/ }).fill(String(round))
  await page.getByRole('button', { name: 'Programar partido' }).click()
  await expect(page).toHaveURL(/\/admin\/partidos$/)
  await expect(page.getByText('Partido programado.')).toBeVisible()

  const row = page.getByRole('listitem').filter({ hasText: `Fecha ${round}` })
  await expect(row.getByText('Falta el resultado')).toBeVisible()

  // 2. Cargar el resultado completo: nómina, goleadores, tarjeta y cierre. Meta: ≤ 3 minutos.
  const startedAt = Date.now()
  await row.getByRole('link', { name: 'Cargar resultado' }).click()
  await expect(page.getByRole('heading', { name: 'Cargar resultado', level: 1 })).toBeVisible()
  const scoreboard = page.getByRole('status', { name: 'Marcador actual' })
  await expect(scoreboard).toHaveText(/Cachorros 0 – 0 Los Litres/)

  await page.getByRole('button', { name: 'Usar nómina del partido anterior' }).click()
  await expect(page.getByText('Nómina copiada del partido anterior.')).toBeVisible()
  await expect(page.getByText(/^\d+ citados · 11 titulares$/)).toBeVisible()
  await expectAccessible(page)

  const register = async (button: string, fill: () => Promise<void>) => {
    await page.getByRole('button', { name: button, exact: true }).click()
    await fill()
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('button', { name: 'Registrar' })).toBeHidden()
  }
  await register('Gol nuestro', async () => {
    await page.getByRole('combobox', { name: 'Jugador', exact: true }).selectOption({ index: 9 })
    await page.getByRole('spinbutton', { name: /^Minuto/ }).fill('23')
  })
  await expect(scoreboard).toHaveText(/Cachorros 1 – 0 Los Litres/)
  await register('Gol rival', async () => {
    await page.getByRole('textbox', { name: /^Nombre del jugador rival/ }).fill('Delantero de ejemplo')
    await page.getByRole('spinbutton', { name: /^Minuto/ }).fill('60')
  })
  await register('Gol nuestro', async () => {
    await page.getByRole('combobox', { name: 'Tipo' }).selectOption({ label: 'Gol de penal' })
    await page.getByRole('combobox', { name: 'Jugador', exact: true }).selectOption({ index: 10 })
    await page.getByRole('spinbutton', { name: /^Minuto/ }).fill('45')
    await page.getByRole('spinbutton', { name: /^Adición/ }).fill('2')
  })
  await register('Tarjeta', async () => {
    await page.getByRole('combobox', { name: 'Jugador', exact: true }).selectOption({ index: 3 })
    await page.getByRole('spinbutton', { name: /^Minuto/ }).fill('77')
  })
  await expect(scoreboard).toHaveText(/Cachorros 2 – 1 Los Litres/)
  const events = page.getByRole('list', { name: 'Eventos registrados' })
  await expect(events.getByRole('listitem')).toHaveCount(4)
  await expect(events.getByText(/^45\+2' Gol de penal/)).toBeVisible()

  // Sin elegir jugador, un gol nuestro no se registra.
  await page.getByRole('button', { name: 'Gol nuestro', exact: true }).click()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByText('Elige al jugador.')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: 'Finalizar partido' }).click()
  const confirm = page.getByRole('dialog')
  await expect(confirm.getByText('Cachorros 2 – 1 Los Litres')).toBeVisible()
  await confirm.getByRole('button', { name: 'Sí, finalizar' }).click()
  await expect(page.getByText('Partido finalizado.')).toBeVisible()
  const seconds = (Date.now() - startedAt) / 1000
  expect(seconds, 'cargar un resultado completo toma menos de 3 minutos').toBeLessThan(180)
  testInfo.annotations.push({ type: 'tiempo', description: `Resultado completo en ${seconds.toFixed(1)} s` })

  // 3. El sitio lo muestra en la siguiente carga, sin esperar a que venza ninguna caché.
  await page.goto('/')
  const card = page.getByRole('listitem').filter({ has: page.locator(`a[href="/partidos/${slug}"]`) })
  await expect(card).toBeVisible()
  await expect(card).toContainText(`Fecha ${round}`)
  await expect(card.locator(`a[href="/partidos/${slug}"]`)).toContainText('2')

  // 4. Corregir: eliminar el gol rival vuelve a calcular el marcador también en el sitio.
  await page.goto('/admin/partidos?vista=jugados')
  const played = page.getByRole('listitem').filter({ hasText: `Fecha ${round}` })
  await expect(played.getByText('Club Deportivo Los Cachorros 2 – 1 Deportivo Los Litres')).toBeVisible()
  await played.getByRole('link', { name: 'Corregir resultado' }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: /^Eliminar: 60' Gol/ }).click()
  await expect(page.getByText('Evento eliminado.')).toBeVisible()
  await expect(page.getByRole('status', { name: 'Marcador actual' })).toHaveText(/Cachorros 2 – 0 Los Litres/)
})

test('programar una jornada crea un partido por serie con su hora', async ({ page }, testInfo) => {
  const round = testInfo.project.name === 'celular' ? 44 : 45
  await enter(page)
  await page.goto('/admin/partidos/jornada')
  await expect(page.getByRole('heading', { name: 'Programar jornada', level: 1 })).toBeVisible()
  await expectAccessible(page)

  // Sin series marcadas no se programa nada.
  await page.getByRole('button', { name: 'Programar 0 partidos' }).click()
  await expect(page.getByText('Marca al menos una serie que juegue ese día.')).toBeVisible()

  // Lejos en el calendario: así no pasa a ser el «próximo partido» de la portada para las demás pruebas.
  const farDate = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
  await page.getByLabel('Día', { exact: true }).fill(farDate)
  await page.getByRole('combobox', { name: 'Rival' }).selectOption({ label: 'Unión El Boldo' })
  await page.getByRole('combobox', { name: 'El club juega de' }).selectOption({ label: 'Visita' })
  for (const [serie, time] of [
    ['Honor', '16:00'],
    ['Segunda', '14:00'],
  ] as const) {
    await page.getByRole('checkbox', { name: serie, exact: true }).check()
    await page.getByLabel(`Hora de ${serie}`).fill(time)
    await page.getByRole('spinbutton', { name: new RegExp(`^Fecha n.º de ${serie}`) }).fill(String(round))
  }
  await page.getByRole('button', { name: 'Programar 2 partidos' }).click()
  await expect(page).toHaveURL(/\/admin\/partidos$/)
  await expect(page.getByText('Se programaron 2 partidos.')).toBeVisible()
  // La lista viene paginada: se filtra por serie para encontrar cada partido creado.
  for (const [serie, time] of [
    ['Honor', '16:00'],
    ['Segunda', '14:00'],
  ] as const) {
    await page.getByRole('combobox', { name: 'Serie' }).selectOption({ label: serie })
    await page.getByRole('button', { name: 'Filtrar' }).click()
    const created = page.getByRole('listitem').filter({ hasText: `Fecha ${round}` })
    await expect(created).toHaveCount(1)
    await expect(created).toContainText(time)
    await expect(created).toContainText('Unión El Boldo vs Club Deportivo Los Cachorros')
  }
})

test('la tabla de posiciones se edita y muestra su vista previa', async ({ page }) => {
  await enter(page)
  await page.goto('/admin/posiciones')
  await expect(page.getByRole('heading', { name: 'Tabla de posiciones', level: 1 })).toBeVisible()
  // Una tabla manual del seed (Honor es calculada).
  await page.getByRole('link', { name: 'Segunda' }).click()
  await expect(page.getByRole('heading', { name: 'Tabla de Segunda', level: 1 })).toBeVisible()
  await expectAccessible(page)
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('textbox', { name: /^Fuente/ }).fill('Boletín de la asociación (prueba)')
  await page.getByRole('button', { name: 'Guardar tabla' }).click()
  await expect(page.getByText('Tabla guardada.')).toBeVisible()
})
