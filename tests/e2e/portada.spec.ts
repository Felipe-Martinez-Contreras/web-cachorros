import { spawnSync } from 'node:child_process'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/** Errores de consola y de página: un error de hidratación de React aparece aquí. */
function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, 'la página no debe tener scroll horizontal').toBeLessThanOrEqual(0)
}

test.describe('portada', () => {
  test('muestra las capas con los datos del seed, sin errores de hidratación', async ({ page }) => {
    const errors = collectErrors(page)
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'es-CL')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Los Cachorros')
    await expect(page.getByText('Club Deportivo Los Cachorros · Desde 1934')).toBeVisible()

    // Franja matchday: próximo partido de Honor, con la cuenta regresiva ya calculada en el cliente.
    const matchday = page.getByRole('region', { name: 'Próximo partido' })
    await expect(matchday.getByText('Próximo partido')).toBeVisible()
    await expect(matchday.getByText(/^Honor · /)).toBeVisible()
    await expect(matchday.getByText(/^Comienza el \w+ \d+ de \w+ de \d{4}, \d{2}:\d{2} h\.$/)).toBeAttached()
    await expect(matchday.locator('[aria-hidden="true"] >> text=/^\\d{2}$/').first()).toBeVisible()
    await expect(matchday.getByText(/^Cancha /)).toBeVisible()
    // «Cómo llegar» solo aparece si la cancha del partido tiene coordenadas (la del club las tiene).
    for (const link of await matchday.getByRole('link', { name: /Cómo llegar/ }).all()) {
      await expect(link).toHaveAttribute('href', /^https:\/\/www\.google\.com\/maps\/dir\//)
    }

    for (const name of ['Últimos resultados', 'Noticias', 'Accesos rápidos', 'Tabla de posiciones']) {
      await expect(page.getByRole('region', { name, exact: true })).toBeVisible()
    }
    await expect(page.getByRole('region', { name: 'Últimos resultados' }).getByRole('listitem')).toHaveCount(
      7,
    )
    await expect(page.getByRole('region', { name: 'Noticias' }).getByRole('article')).toHaveCount(6)
    await expect(page.getByRole('region', { name: 'Redes sociales' }).getByRole('listitem')).toHaveCount(6)
    // Los logos están bajo el pliegue y son `loading="lazy"`: se cargan al acercarse.
    const sponsors = page.getByRole('region', { name: 'Auspiciadores' })
    await sponsors.scrollIntoViewIfNeeded()
    await expect(sponsors.getByRole('img', { name: /Ferretería El Roble/ })).toBeVisible()

    // La fila del club está en la mini-tabla.
    const table = page.getByRole('table')
    await expect(table.getByRole('row', { name: /Cachorros/ })).toHaveAttribute('aria-current', 'true')

    // Lo no confirmado se ve marcado, nunca inventado.
    await expect(
      page.getByRole('contentinfo').getByText(/\[COMPLETAR: dirección de la cancha\]/),
    ).toBeVisible()

    expect(errors).toEqual([])
  })

  for (const width of [360, 768, 1280]) {
    test(`no tiene scroll horizontal ni saltos de layout a ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.addInitScript(() => {
        // Suma los desplazamientos de layout que no vienen de una interacción (CLS).
        ;(window as unknown as { __cls: number }).__cls = 0
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number
            hadRecentInput: boolean
          })[]) {
            if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value
          }
        }).observe({ type: 'layout-shift', buffered: true })
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await expectNoHorizontalScroll(page)
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
      expect(cls, 'CLS de la portada').toBeLessThanOrEqual(0.1)
    })
  }

  test('no se mueve cuando la fuente llega tarde', async ({ page }) => {
    // En una red lenta, Archivo llega después del primer pintado. Las fuentes de respaldo ajustadas
    // (src/styles/fonts.css) ocupan el mismo ancho, así que los titulares no cambian de línea.
    await page.setViewportSize({ width: 412, height: 823 })
    await page.route('**/*.woff2', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      await route.continue()
    })
    await page.addInitScript(() => {
      ;(window as unknown as { __cls: number }).__cls = 0
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number
          hadRecentInput: boolean
        })[]) {
          if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value
        }
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/')
    const display = page.getByRole('heading', { level: 1 })
    const before = await display.boundingBox()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    const after = await display.boundingBox()

    // El titular ocupa las mismas líneas con la fuente de respaldo que con la definitiva.
    expect(after?.height).toBe(before?.height)
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls)
    expect(cls, 'CLS con la fuente retrasada').toBeLessThanOrEqual(0.05)
  })

  test('no tiene violaciones de accesibilidad serias ni críticas', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const { violations } = await new AxeBuilder({ page }).analyze()
    expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  })

  test('se navega completa con el teclado y el foco siempre se ve', async ({ page }, testInfo) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Saltar al contenido' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#contenido')).toBeFocused()

    // Cada elemento que recibe el foco con Tab tiene un contorno visible.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      const outline = await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement ?? document.body)
        return { tag: document.activeElement?.tagName, style: style.outlineStyle, width: style.outlineWidth }
      })
      expect(outline.style, `foco visible en ${outline.tag}`).not.toBe('none')
      expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
    }

    if (testInfo.project.name === 'escritorio') {
      // El desplegable «Club» se abre con el teclado.
      const club = page.getByRole('banner').locator('summary')
      await club.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('banner').getByRole('link', { name: 'Directiva' })).toBeVisible()
    } else {
      // La hoja «Más» se abre desde la barra inferior y se cierra con Escape.
      await page.getByRole('button', { name: 'Más' }).click()
      const sheet = page.getByRole('dialog', { name: 'Más secciones' })
      await expect(sheet.getByRole('link', { name: 'Tienda' })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(sheet).toBeHidden()
    }
  })

  test('las secciones aún no construidas muestran «Próximamente» y lo inexistente es un 404', async ({
    page,
  }) => {
    const soon = await page.goto('/noticias')
    expect(soon?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Noticias' })).toBeVisible()
    await expect(page.getByText('Próximamente')).toBeVisible()

    const missing = await page.goto('/no-existe')
    expect(missing?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Este balón se fue fuera de la cancha' })).toBeVisible()
  })

  test('las imágenes se sirven procesadas y fuera de la carpeta de subidas no hay nada', async ({
    request,
  }) => {
    const image = await request.get('/media/seed-escudo/w96.webp')
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toBe('image/webp')
    expect((await request.get('/media/..%2F..%2F.env')).status()).toBe(404)
    expect((await request.get('/media/seed-escudo/no-existe.webp')).status()).toBe(404)
  })
})

test.describe('portada sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('muestra su contenido y la navegación funciona', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Los Cachorros')
    await expect(page.getByRole('region', { name: 'Noticias' }).getByRole('article')).toHaveCount(6)
    // Sin JavaScript la cuenta regresiva queda en su texto estático equivalente.
    await expect(page.getByText(/^Comienza el /)).toBeAttached()
    await page.getByRole('contentinfo').getByRole('link', { name: 'Contacto' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible()
  })
})

test.describe('portada con un partido en vivo', () => {
  const seed = (args: string[]) => {
    const result = spawnSync(process.execPath, ['scripts/run.mjs', 'seed', ...args], { encoding: 'utf8' })
    if (result.status !== 0) throw new Error(`Falló el seed:\n${result.stdout}${result.stderr}`)
  }

  test.beforeAll(() => {
    test.setTimeout(180_000)
    seed(['--en-vivo'])
  })
  test.afterAll(() => {
    test.setTimeout(180_000)
    seed([])
  })

  test('la franja muestra el marcador EN VIVO renderizado en el servidor', async ({ page }) => {
    // La franja se cachea 30 s: se espera a que el servidor entregue el estado en vivo.
    await expect(async () => {
      await page.goto('/')
      await expect(page.getByRole('region', { name: 'Partidos en vivo' })).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 90_000 })

    const live = page.getByRole('region', { name: 'Partidos en vivo' })
    await expect(live.getByText('En vivo', { exact: true })).toBeVisible()
    await expect(live.getByText('1.er tiempo')).toBeVisible()
    await expect(live.getByText(/Cachorros 1, .+ 0|.+ 0, Cachorros 1/)).toBeAttached()
    await expect(live.getByRole('link', { name: 'Seguir el partido' })).toBeVisible()
  })
})
