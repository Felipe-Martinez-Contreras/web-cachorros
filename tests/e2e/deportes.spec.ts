import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { adminSql } from './db'
import { ADMIN, login } from './support'

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'la página no debe tener scroll horizontal').toBeLessThanOrEqual(0)
}

function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

const NOT_FOUND = 'Este balón se fue fuera de la cancha'

// Direcciones de detalle que no existen: el proxy las responde con 404 real (ADR 0008).
const MISSING_PATHS = [
  '/partidos/no-existe-este-partido',
  '/jugadores/no-existe-este-jugador',
  '/plantel/no-existe',
  '/noticias/no-existe-esta-noticia',
]

/** Un juvenil del seed que solo está inscrito en la serie juvenil (el celular y el escritorio usan uno distinto). */
async function seedJuveniles() {
  // Su «nombre apellido» no coincide con el de ningún adulto ni del cuerpo técnico: así se puede buscar en
  // el HTML completo de cada página (incluidos los datos que viajan al navegador).
  const sql = adminSql()
  const candidates = await sql<{ id: string; first_name: string; last_name: string; slug: string }[]>`
    select p.id, p.first_name, p.last_name, p.slug
    from players p
    join squad_registrations r on r.player_id = p.id
    join series s on s.id = r.series_id and s.slug = 'juvenil'
    where not exists (
      select 1 from players other
      where other.id <> p.id
        and other.first_name || ' ' || other.last_name like '%' || p.first_name || ' ' || split_part(p.last_name, ' ', 1) || '%'
    )
    and not exists (
      select 1 from staff_members staff
      where staff.full_name like '%' || p.first_name || ' ' || split_part(p.last_name, ' ', 1) || '%'
    )
    and not exists (
      select 1 from squad_registrations elsewhere
      join series es on es.id = elsewhere.series_id
      where elsewhere.player_id = p.id and es.slug <> 'juvenil'
    )
    order by p.slug`
  await sql.end()
  return candidates
}

test.describe('partidos', () => {
  test('fixture y resultados por serie y temporada, y detalle de un partido jugado', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/partidos')
    await expect(page.getByRole('heading', { level: 1, name: 'Partidos' })).toBeVisible()
    // Por defecto: la serie destacada (Honor) en la temporada actual.
    const tabs = page.getByRole('navigation', { name: 'Series' })
    await expect(tabs.getByRole('link', { name: 'Honor', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const upcoming = page.getByRole('region', { name: 'Próximos partidos' })
    const results = page.getByRole('region', { name: 'Resultados' })
    await expect(upcoming.getByRole('listitem').first()).toBeVisible()
    await expect(results.getByRole('listitem').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page)

    // Cambiar de serie es un enlace: la vista queda en la URL.
    await tabs.getByRole('link', { name: 'Segunda', exact: true }).click()
    await expect(page).toHaveURL(/\/partidos\?serie=segunda$/)
    await expect(tabs.getByRole('link', { name: 'Segunda', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(
      page
        .getByRole('region', { name: 'Resultados' })
        .getByText(/^Segunda/)
        .first(),
    ).toBeVisible()

    // La temporada se cambia con un formulario GET.
    await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(/serie=segunda&temporada=\d{4}$/)
    await expect(page.getByText(/todavía no tiene partidos en la Temporada/)).toBeVisible()

    // Detalle de un partido jugado: marcador, cronología y nómina.
    await page.goto('/partidos?serie=honor')
    await page.getByRole('region', { name: 'Resultados' }).getByRole('link').last().click()
    await expect(page).toHaveURL(/\/partidos\/honor-\d{4}-fecha-\d+-/)
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()
    await expect(page.getByRole('heading', { name: 'Cronología' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Nómina de / })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Titulares' })).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Compartir y calendario' }).getByRole('link', { name: 'WhatsApp' }),
    ).toHaveAttribute('href', /^https:\/\/wa\.me\//)
    await expectNoHorizontalScroll(page)
    await expectAccessible(page)
    expect(errors).toEqual([])
  })

  test('un partido por jugar ofrece cómo llegar y agregarlo al calendario', async ({ page, request }) => {
    await page.goto('/partidos?serie=honor')
    await page.getByRole('region', { name: 'Próximos partidos' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Cancha' })).toBeVisible()
    const calendar = page.getByRole('link', { name: 'Agregar al calendario' })
    const href = await calendar.getAttribute('href')
    expect(href).toMatch(/^\/api\/ics\/partido\/[0-9a-f-]{36}$/)
    const response = await request.get(href ?? '')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8')
    const ics = await response.text()
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toMatch(/SUMMARY:Honor: .+ vs .+/)
    expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  })

  test('posiciones, goleadores y la ficha de un jugador con sus estadísticas', async ({ page }) => {
    await page.goto('/partidos/posiciones')
    await expect(page.getByRole('heading', { level: 1, name: 'Tabla de posiciones' })).toBeVisible()
    const table = page.getByRole('table')
    await expect(table.getByRole('row', { name: /Cachorros/ })).toHaveAttribute('aria-current', 'true')
    await expect(table.getByRole('columnheader', { name: /PTS|Puntos/ })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page)

    await page.getByRole('link', { name: 'Goleadores', exact: true }).click()
    await expect(page).toHaveURL(/\/partidos\/goleadores\?serie=honor$/)
    const scorers = page.getByRole('table')
    await expect(scorers.getByRole('row')).not.toHaveCount(1)
    await expect(scorers.getByRole('row').nth(1).getByRole('cell').first()).toHaveText('1')
    await expectAccessible(page)

    const name = await scorers.getByRole('row').nth(1).getByRole('link').innerText()
    await scorers.getByRole('row').nth(1).getByRole('link').click()
    await expect(page).toHaveURL(/\/jugadores\/[a-z0-9-]+$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible()
    await expect(page.getByRole('table').getByRole('columnheader', { name: /Temporada/ })).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectAccessible(page)
  })

  test('una dirección de partido o de jugador que no existe muestra la página 404 del club', async ({
    page,
  }) => {
    for (const path of MISSING_PATHS) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} responde 404`).toBe(404)
      await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
    }
  })
})

test('plantel: /plantel lleva a la serie destacada, agrupada por línea y con cuerpo técnico', async ({
  page,
}) => {
  await page.goto('/plantel')
  await expect(page).toHaveURL(/\/plantel\/honor$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Plantel Honor' })).toBeVisible()
  for (const group of ['Arqueros', 'Defensas', 'Mediocampistas', 'Delanteros', 'Cuerpo técnico']) {
    await expect(page.getByRole('heading', { level: 2, name: group })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Arqueros' }).getByRole('listitem')).toHaveCount(2)
  await expect(page.getByText('Director técnico')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expectAccessible(page)

  await page.getByRole('navigation', { name: 'Series' }).getByRole('link', { name: 'Senior 45' }).click()
  await expect(page).toHaveURL(/\/plantel\/senior-45$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Plantel Senior 45' })).toBeVisible()
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('las páginas deportivas muestran su contenido y los filtros funcionan', async ({ page }) => {
    await page.goto('/partidos')
    await expect(page.getByRole('region', { name: 'Resultados' }).getByRole('listitem').first()).toBeVisible()
    await page.getByRole('navigation', { name: 'Series' }).getByRole('link', { name: 'Tercera' }).click()
    await expect(page).toHaveURL(/\/partidos\?serie=tercera$/)
    await page.getByRole('combobox', { name: 'Temporada' }).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(/serie=tercera&temporada=\d{4}$/)

    await page.goto('/partidos/posiciones?serie=honor')
    await expect(page.getByRole('table').getByRole('row', { name: /Cachorros/ })).toBeVisible()
    await page.goto('/partidos/goleadores?serie=honor')
    await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible()

    await page.goto('/partidos?serie=honor')
    await page.getByRole('region', { name: 'Resultados' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Cronología' })).toBeVisible()

    await page.goto('/plantel/honor')
    await expect(page.getByRole('region', { name: 'Delanteros' }).getByRole('listitem').first()).toBeVisible()
    await page.getByRole('region', { name: 'Delanteros' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible()
  })

  // ADR 0008: el estado HTTP lo decide el proxy antes del render, así que no depende de JavaScript.
  test('un slug que no existe y la ficha de un menor responden 404', async ({ page }, testInfo) => {
    for (const path of MISSING_PATHS) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} responde 404`).toBe(404)
      await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
    }

    const juvenile = (await seedJuveniles())[testInfo.project.name === 'celular' ? 0 : 1]
    expect(juvenile, 'el seed trae juveniles').toBeTruthy()
    if (!juvenile) return
    const response = await page.goto(`/jugadores/${juvenile.slug}`)
    expect(response?.status(), 'la ficha de un menor responde 404').toBe(404)
    await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
    expect(await page.content()).not.toContain(`${juvenile.first_name} ${juvenile.last_name}`)

    // Las rutas fijas que comparten el prefijo siguen respondiendo.
    for (const path of ['/partidos/posiciones', '/partidos/goleadores', '/plantel/honor']) {
      expect((await page.goto(path))?.status(), `${path} responde 200`).toBe(200)
    }
  })

  test('un slug que cambió responde 301 hacia la dirección vigente', async ({
    page,
    browser,
    request,
    baseURL,
  }, testInfo) => {
    const stamp = Date.now()
    const oldPath = `/jugadores/e2e-jugador-antes${stamp}`
    const newPath = `/jugadores/e2e-jugador-despues${stamp}`

    // El cambio de nombre se hace por el panel (que necesita JavaScript), en un contexto aparte.
    const panelContext = await browser.newContext({ baseURL, locale: 'es-CL', javaScriptEnabled: true })
    const panel = await panelContext.newPage()
    await login(panel, ADMIN.email)
    await expect(panel.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    await panel.goto('/admin/jugadores/nuevo')
    await panel.getByRole('textbox', { name: 'Nombre', exact: true }).fill('E2E Jugador')
    await panel.getByRole('textbox', { name: 'Apellido' }).fill(`Antes${stamp}`)
    await panel.getByRole('combobox', { name: 'Posición', exact: true }).selectOption({ label: 'Delantero' })
    await panel.getByRole('combobox', { name: /^Inscribir en la serie/ }).selectOption({ label: 'Honor' })
    await panel
      .getByRole('spinbutton', { name: /^Número de camiseta/ })
      .fill(testInfo.project.name === 'celular' ? '93' : '94')
    await panel.getByRole('button', { name: 'Crear jugador' }).click()
    await expect(panel.getByRole('heading', { name: `E2E Jugador Antes${stamp}`, level: 1 })).toBeVisible()

    expect((await page.goto(oldPath))?.status()).toBe(200)

    await panel.getByRole('textbox', { name: 'Apellido' }).fill(`Despues${stamp}`)
    await panel.getByRole('button', { name: 'Guardar', exact: true }).click()
    await expect(panel.getByRole('heading', { name: `E2E Jugador Despues${stamp}`, level: 1 })).toBeVisible()
    await panelContext.close()

    // Sin seguir la redirección: el estado es 301 y `Location` apunta al slug vigente, con su consulta.
    const moved = await request.get(`${oldPath}?desde=prueba`, { maxRedirects: 0 })
    expect(moved.status()).toBe(301)
    expect(new URL(moved.headers().location ?? '', baseURL).pathname).toBe(newPath)
    expect(new URL(moved.headers().location ?? '', baseURL).search).toBe('?desde=prueba')

    // Y el navegador, sin JavaScript, llega a la ficha.
    const response = await page.goto(oldPath)
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(new RegExp(`${newPath}$`))
    await expect(page.getByRole('heading', { level: 1, name: `E2E Jugador Despues${stamp}` })).toBeVisible()
  })
})

test('menores de edad: sin apellido, sin ficha y sin enlaces, también el juvenil inscrito en una serie adulta', async ({
  page,
}, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const juvenile = (await seedJuveniles())[isMobile ? 0 : 1]
  expect(juvenile, 'el seed trae juveniles con nombre y apellido únicos').toBeTruthy()
  if (!juvenile) return
  const surname = `${juvenile.first_name} ${juvenile.last_name.split(' ')[0] ?? juvenile.last_name}`
  const publicName = `${juvenile.first_name} ${juvenile.last_name.charAt(0)}.`
  const shirt = isMobile ? '96' : '95'

  const expectHidden = async (path: string) => {
    await page.goto(path)
    const html = await page.content()
    expect(html, `${path} no debe traer el nombre con apellido`).not.toContain(surname)
    expect(html, `${path} no debe enlazar a su ficha`).not.toContain(`/jugadores/${juvenile.slug}`)
  }

  // En su serie aparece solo con nombre e inicial, sin enlace.
  await expectHidden('/plantel/juvenil')
  await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${publicName}`) })).toBeVisible()
  await expect(page.locator('main a[href^="/jugadores/"]')).toHaveCount(0)

  // Su ficha no existe.
  expect((await page.goto(`/jugadores/${juvenile.slug}`))?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
  expect(await page.content()).not.toContain(surname)

  // Goleadores y partidos de la serie juvenil: nadie con apellido ni ficha.
  await expectHidden('/partidos/goleadores?serie=juvenil')
  await expect(page.locator('main a[href^="/jugadores/"]')).toHaveCount(0)
  await page.goto('/partidos?serie=juvenil')
  await page.getByRole('region', { name: 'Resultados' }).getByRole('link').first().click()
  await expect(page.getByRole('heading', { name: /^Nómina de / })).toBeVisible()
  await expect(page.locator('main a[href^="/jugadores/"]')).toHaveCount(0)
  expect(await page.content()).not.toContain(surname)

  // Se inscribe además en Honor desde el panel: sigue siendo menor en la serie adulta.
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto(`/admin/jugadores/${juvenile.id}`)
  await expect(page.getByText('Es menor de edad', { exact: true })).toBeVisible()
  await page.getByText('Inscribir en una serie').click()
  const form = page.locator('details', { hasText: 'Inscribir en una serie' })
  await form.getByRole('combobox', { name: 'Serie' }).selectOption({ label: 'Honor' })
  await form.getByRole('spinbutton', { name: /^Número de camiseta/ }).fill(shirt)
  await form.getByRole('button', { name: 'Inscribir' }).click()
  await expect(page.getByText('Jugador inscrito.')).toBeVisible()

  // El cambio se ve en la carga siguiente del sitio, y sin exponer al menor.
  await expectHidden('/plantel/honor')
  const card = page.getByRole('listitem').filter({ hasText: publicName }).filter({ hasText: shirt })
  await expect(card).toBeVisible()
  await expect(card.getByRole('link')).toHaveCount(0)
  await page.goto(`/jugadores/${juvenile.slug}`)
  await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible()
})
