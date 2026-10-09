// Capturas para el reporte de fase (360 px y 1280 px). playwright.config.ts las excluye de las pruebas normales:
//   PowerShell:  $env:CAPTURAS = 'fase-2b'; pnpm test:e2e capturas; Remove-Item Env:CAPTURAS
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login } from './support'

const fase = process.env.CAPTURAS ?? ''
const dir = `docs/fases/capturas/${fase}`

/** Las imágenes bajo el pliegue son `loading="lazy"`: se recorre la página para que carguen. */
async function loadLazyImages(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

test.describe('capturas del reporte de fase', () => {
  test('fases 0 y 1: portada, sección provisional, login, panel y sistema de diseño', async ({
    page,
  }, testInfo) => {
    test.skip(fase.startsWith('fase-2'), 'Estas capturas son de las fases 0 y 1.')
    test.setTimeout(120_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name

    await page.goto('/')
    // La cuenta regresiva cambia cada segundo: se espera a que aparezca para que la captura sea la final.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${dir}/portada-${width}.png` })
    await loadLazyImages(page)
    await page.screenshot({ path: `${dir}/portada-completa-${width}.png`, fullPage: true })

    await page.goto('/noticias')
    await page.screenshot({ path: `${dir}/proximamente-${width}.png` })

    await page.goto('/admin/login')
    await page.screenshot({ path: `${dir}/login-${width}.png` })

    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    await page.screenshot({ path: `${dir}/panel-${width}.png`, fullPage: true })

    await page.goto('/admin/sistema-de-diseno')
    await expect(page.getByRole('heading', { name: 'Sistema de diseño', level: 1 })).toBeVisible()
    await page.screenshot({ path: `${dir}/sistema-de-diseno-${width}.png`, fullPage: true })
  })

  test('fase 2a: secciones deportivas públicas y panel deportivo', async ({ page }, testInfo) => {
    test.skip(fase !== 'fase-2a', 'Estas capturas son de la Fase 2a.')
    test.setTimeout(180_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    const shot = async (name: string, fullPage = true) => {
      await loadLazyImages(page)
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage })
    }

    // Sitio público.
    await page.goto('/partidos')
    await expect(page.getByRole('heading', { level: 1, name: 'Partidos' })).toBeVisible()
    await shot('partidos')
    await page.getByRole('region', { name: 'Resultados' }).getByRole('link').last().click()
    await expect(page.getByRole('heading', { name: 'Cronología' })).toBeVisible()
    await shot('partido-detalle')
    await page.goto('/partidos/posiciones')
    await expect(page.getByRole('table')).toBeVisible()
    await shot('posiciones')
    await page.goto('/partidos/goleadores')
    await expect(page.getByRole('table')).toBeVisible()
    await shot('goleadores')
    await page.goto('/plantel/honor')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot('plantel')
    await page.getByRole('region', { name: 'Delanteros' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Estadísticas' })).toBeVisible()
    await shot('jugador')
    await page.goto('/plantel/juvenil')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot('plantel-juvenil')

    // Panel.
    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    for (const [path, heading, name] of [
      ['/admin/partidos?vista=jugados', 'Partidos', 'panel-partidos'],
      ['/admin/partidos/jornada', 'Programar jornada', 'panel-jornada'],
      ['/admin/posiciones', 'Tabla de posiciones', 'panel-posiciones'],
      ['/admin/jugadores', 'Jugadores', 'panel-jugadores'],
      ['/admin/series', 'Series', 'panel-series'],
      ['/admin/rivales', 'Rivales', 'panel-rivales'],
      ['/admin/medios', 'Biblioteca de medios', 'panel-medios'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await shot(name)
    }
    await page.goto('/admin/partidos?vista=jugados')
    // Un partido del club (los partidos entre rivales solo llevan el marcador final).
    await page
      .getByRole('listitem')
      .filter({ hasText: 'Club Deportivo Los Cachorros' })
      .first()
      .getByRole('link', { name: 'Corregir resultado' })
      .click()
    await expect(page.getByRole('heading', { name: 'Corregir resultado', level: 1 })).toBeVisible()
    await shot('panel-resultado')
    await page.goto('/admin/posiciones')
    await page.getByRole('link', { name: 'Segunda' }).click()
    await expect(page.getByRole('heading', { name: 'Tabla de Segunda', level: 1 })).toBeVisible()
    await shot('panel-tabla')
    if ((page.viewportSize()?.width ?? 0) < 1024) {
      await page.goto('/admin')
      await page.getByRole('button', { name: 'Más' }).click()
      await expect(page.getByRole('heading', { name: 'Todos los módulos' })).toBeVisible()
      await page.screenshot({ path: `${dir}/panel-menu-${width}.png` })
    }
  })
  test('fase 2b: noticias, historia, 404, y panel de contenido y sistema', async ({ page }, testInfo) => {
    test.skip(fase !== 'fase-2b', 'Estas capturas son de la Fase 2b.')
    test.setTimeout(240_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    const shot = async (name: string, fullPage = true) => {
      await loadLazyImages(page)
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage })
    }

    // Sitio público.
    for (const [path, name] of [
      ['/noticias', 'noticias'],
      ['/noticias/cronica-honor', 'noticia-detalle'],
      ['/historia', 'historia'],
      ['/historia/salon-de-la-fama', 'salon-de-la-fama'],
      ['/partidos/no-existe-este-partido', 'pagina-404'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await shot(name)
    }

    // Panel.
    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    await shot('panel-inicio')
    for (const [path, heading, name] of [
      ['/admin/noticias', 'Noticias', 'panel-noticias'],
      ['/admin/historia/hitos', 'Historia', 'panel-historia'],
      ['/admin/textos', 'Textos de páginas', 'panel-textos'],
      ['/admin/configuracion', 'Configuración', 'panel-configuracion'],
      ['/admin/configuracion/contacto', 'Contacto y avisos', 'panel-configuracion-contacto'],
      ['/admin/usuarios', 'Usuarios', 'panel-usuarios'],
      ['/admin/cuenta', 'Mi cuenta', 'panel-cuenta'],
      ['/admin/actividad', 'Actividad', 'panel-actividad'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await shot(name)
    }
    // El editor de una noticia ya publicada.
    await page.goto('/admin/noticias')
    await page.getByRole('list', { name: 'Noticias' }).getByRole('link').first().click()
    await expect(page.getByRole('textbox', { name: 'Texto de la noticia' })).toBeVisible()
    await shot('panel-noticia-editor')
  })
})
