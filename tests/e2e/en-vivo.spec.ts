import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import { ADMIN, expectAccessible, login } from './support'

// Los partidos que crean estas pruebas usan las fechas 50 a 53 (`e2e-clean` borra desde la 40) y la hora
// 00:01: al finalizarlos no pasan a ser el último resultado de Honor que verifica `resultados.spec.ts`.
// El servidor de las e2e corre con LIVE_POLL_MS=2000: el polling sondea cada 2 s (en vivo) o 6 s (por comenzar).

/** Programa un partido de Honor hoy y abre su consola en vivo (la hora no importa: se inicia a mano). */
async function openConsole(page: Page, round: number): Promise<string> {
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/partidos/nuevo')
  await page.getByRole('combobox', { name: 'Serie' }).selectOption({ label: 'Honor' })
  await page.getByRole('combobox', { name: 'Visita' }).selectOption({ label: 'Deportivo Los Litres' })
  await page.getByLabel('Hora', { exact: true }).fill('00:01')
  await page.getByRole('spinbutton', { name: /^Número de fecha/ }).fill(String(round))
  await page.getByRole('button', { name: 'Programar partido' }).click()
  await expect(page.getByText('Partido programado.')).toBeVisible()
  await page
    .getByRole('listitem')
    .filter({ hasText: `Fecha ${round}` })
    .getByRole('link')
    .first()
    .click()
  await page.getByRole('link', { name: 'Iniciar en vivo' }).click()
  await expect(page.getByRole('heading', { level: 1, name: /^En vivo:/ })).toBeVisible()
  const id = new URL(page.url()).pathname.split('/')[3] ?? ''
  // Nómina: la del partido anterior.
  await page.getByRole('button', { name: 'Usar nómina del partido anterior' }).click()
  await expect(page.getByText('Nómina copiada del partido anterior.')).toBeVisible()
  return id
}

function consoleOf(page: Page) {
  return {
    score: page.getByRole('status', { name: 'Marcador' }),
    async step(name: string) {
      await page.getByRole('button', { name, exact: true }).click()
    },
    async clubGoal() {
      await page.getByRole('button', { name: /^Gol de / }).click()
      await page.getByRole('group', { name: 'Jugador' }).getByRole('button').first().click()
      await page.getByRole('button', { name: 'Registrar' }).click()
      await expect(page.getByRole('button', { name: 'Registrar' })).toBeHidden()
    },
    async rivalGoal() {
      await page.getByRole('button', { name: 'Gol rival', exact: true }).click()
      await page.getByRole('button', { name: 'Registrar' }).click()
      await expect(page.getByRole('button', { name: 'Registrar' })).toBeHidden()
    },
    async clubCard() {
      await page.getByRole('button', { name: 'Tarjeta', exact: true }).click()
      await page.getByRole('group', { name: 'Jugador' }).getByRole('button').first().click()
      await page.getByRole('button', { name: 'Registrar' }).click()
      await expect(page.getByRole('button', { name: 'Registrar' })).toBeHidden()
    },
  }
}

/** Cuenta las peticiones a /api/live mientras corre `during`. */
async function liveRequests(page: Page, during: () => Promise<void>): Promise<number> {
  let count = 0
  const listener = (request: { url: () => string }) => {
    if (new URL(request.url()).pathname.startsWith('/api/live')) count += 1
  }
  page.on('request', listener)
  await during()
  page.off('request', listener)
  return count
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      value: value ? 'hidden' : 'visible',
      configurable: true,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

test('el admin juega el partido en vivo y el visitante lo ve sin recargar', async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(240_000)
  const round = testInfo.project.name === 'celular' ? 50 : 51
  await openConsole(page, round)
  const admin = consoleOf(page)
  await admin.step('Iniciar 1.er tiempo')
  await expect(page.getByText(/^1\.er tiempo/)).toBeVisible()
  await expectAccessible(page)

  const visitorContext: BrowserContext = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  })
  const visitor = await visitorContext.newPage()
  await visitor.goto('/')
  const strip = visitor.getByRole('region', { name: 'Partidos en vivo' })
  await expect(strip.getByText('Cachorros 0, Los Litres 0')).toBeVisible()

  // Gol del club: la portada lo muestra sin recargar (≤ 30 s).
  await admin.clubGoal()
  await expect(admin.score).toHaveText(/Cachorros 1 – 0 Los Litres/)
  await expect(strip.getByText('Cachorros 1, Los Litres 0')).toBeVisible({ timeout: 30_000 })

  // El detalle del partido, también sin recargar.
  await strip.getByRole('link', { name: 'Seguir el partido' }).click()
  await expect(visitor.getByText('Cachorros 1, Los Litres 0').first()).toBeVisible()
  const timeline = visitor.getByRole('region', { name: 'Cronología' })
  await admin.rivalGoal()
  await expect(visitor.getByText('Cachorros 1, Los Litres 1').first()).toBeVisible({ timeout: 30_000 })
  await admin.clubCard()
  await expect(timeline.getByText('Tarjeta amarilla')).toBeVisible({ timeout: 30_000 })

  // Pestaña oculta: no se consulta. Al volver, sí.
  await setHidden(visitor, true)
  expect(await liveRequests(visitor, () => visitor.waitForTimeout(5_000))).toBe(0)
  await setHidden(visitor, false)
  expect(await liveRequests(visitor, () => visitor.waitForTimeout(5_000))).toBeGreaterThan(0)

  // Deshacer el último (la tarjeta).
  await page.getByRole('button', { name: 'Deshacer último' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, deshacer' }).click()
  await expect(timeline.getByText('Tarjeta amarilla')).toHaveCount(0, { timeout: 30_000 })

  // Fin del partido: el visitante ve el final y el polling se detiene.
  await admin.step('Fin del 1.er tiempo')
  await admin.step('Iniciar 2.º tiempo')
  await page.getByRole('button', { name: 'Finalizar partido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, finalizar' }).click()
  await expect(page.getByText(/^Finalizado/)).toBeVisible()
  // Next conserva oculta la portada anterior (con su insignia): solo cuenta lo visible.
  await expect(visitor.getByText('En vivo', { exact: true }).filter({ visible: true })).toHaveCount(0, {
    timeout: 30_000,
  })
  await expect(visitor.getByText('Cachorros 1, Los Litres 1').first()).toBeVisible()
  expect(await liveRequests(visitor, () => visitor.waitForTimeout(5_000))).toBe(0)

  // La imagen para compartir del detalle es la tarjeta del resultado, en su versión vigente.
  await visitor.reload()
  const ogImage = await visitor.locator('meta[property="og:image"]').getAttribute('content')
  expect(ogImage).toMatch(/\/api\/share\/resultado\/[0-9a-f-]{36}\/og\?v=\d+e1$/)
  await visitorContext.close()

  // Al finalizar, la consola lleva a las tarjetas para redes: se descargan en los tres formatos.
  await page.getByRole('link', { name: 'Descargar y compartir tarjetas' }).click()
  await expect(page.getByRole('heading', { name: 'Tarjetas para redes', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '¡Gol!', level: 3 })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Descargar Resultado final 4:5' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^resultado-.+-vertical\.png$/)
  await expectAccessible(page)
})

test('sin conexión: las acciones se encolan, sobreviven a una recarga y no se duplican', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180_000)
  const round = testInfo.project.name === 'celular' ? 52 : 53
  const id = await openConsole(page, round)
  const admin = consoleOf(page)
  await admin.step('Iniciar 1.er tiempo')
  await expect(page.getByText(/^1\.er tiempo/)).toBeVisible()
  await page.waitForLoadState('networkidle')

  await context.setOffline(true)
  await admin.clubGoal()
  await admin.clubGoal()
  await expect(page.getByText('Sin conexión · 2 acciones pendientes')).toBeVisible()
  // UI optimista: el marcador ya muestra los goles.
  await expect(admin.score).toHaveText(/Cachorros 2 – 0 Los Litres/)
  const stored = await page.evaluate((key) => localStorage.getItem(key), `cachorros:consola:${id}`)
  expect(JSON.parse(stored ?? '[]')).toHaveLength(2)

  // Vuelve la señal y se recarga: lo pendiente se envía una sola vez.
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText(/acciones? pendientes?/)).toHaveCount(0, { timeout: 30_000 })
  await expect(admin.score).toHaveText(/Cachorros 2 – 0 Los Litres/)
  await expect(page.getByRole('list', { name: 'Eventos del partido' }).getByRole('listitem')).toHaveCount(2)

  // Una acción que el servidor rechaza no se descarta en silencio: se muestra hasta decidir.
  await page.evaluate(([key, queued]) => localStorage.setItem(key, queued), <[string, string]>[
    `cachorros:consola:${id}`,
    JSON.stringify([
      {
        id: '018f0000-0000-7000-8000-00000000e2e1',
        kind: 'period',
        input: { transition: 'iniciar_penales' },
        label: 'Ir a penales',
        createdAt: Date.now(),
        attempts: 0,
        status: 'pending',
      },
    ]),
  ])
  await page.reload()
  const failed = page.getByRole('region', { name: 'Acciones que no se pudieron guardar' })
  await expect(failed.getByText('No se guardó: Ir a penales')).toBeVisible()
  await expect(
    failed.getByText('Ese paso no corresponde al momento del partido. Recarga la consola.'),
  ).toBeVisible()
  await expectAccessible(page)
  await failed.getByRole('button', { name: 'Descartar' }).click()
  await expect(failed).toHaveCount(0)

  // Se cierra para no dejar un partido en vivo.
  await admin.step('Fin del 1.er tiempo')
  await admin.step('Iniciar 2.º tiempo')
  await page.getByRole('button', { name: 'Finalizar partido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sí, finalizar' }).click()
  await expect(page.getByText(/^Finalizado/)).toBeVisible()
})

test('sin partidos en vivo ni por comenzar, la portada no consulta /api/live', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await liveRequests(page, () => page.waitForTimeout(7_000))).toBe(0)
})
