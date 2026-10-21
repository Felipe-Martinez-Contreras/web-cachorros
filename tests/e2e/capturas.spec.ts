// Capturas para el reporte de fase (360 px y 1280 px). playwright.config.ts las excluye de las pruebas normales:
//   PowerShell:  $env:CAPTURAS = 'fase-2b'; pnpm test:e2e capturas; Remove-Item Env:CAPTURAS
import { expect, type Page, test } from '@playwright/test'
import { ADMIN, login, waitForTurnstile } from './support'

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
    test.skip(/^fase-[2-9]/.test(fase), 'Estas capturas son de las fases 0 y 1.')
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

  test('fase 3a: socios, auspiciadores, contacto, privacidad y bandejas del panel', async ({
    page,
  }, testInfo) => {
    test.skip(fase !== 'fase-3a', 'Estas capturas son de la Fase 3a.')
    test.setTimeout(240_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    const shot = async (name: string) => {
      await loadLazyImages(page)
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true })
    }
    await page.goto('/privacidad')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await shot('privacidad')
    // Con Turnstile la red nunca queda en reposo: se espera su token en vez de `networkidle`.
    for (const [path, name] of [
      ['/socios', 'socios'],
      ['/auspiciadores', 'auspiciadores'],
      ['/contacto', 'contacto'],
    ] as const) {
      await page.goto(path)
      await waitForTurnstile(page)
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y)
          await new Promise((resolve) => setTimeout(resolve, 120))
        }
        window.scrollTo(0, 0)
      })
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true })
    }

    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    for (const [path, heading, name] of [
      ['/admin/socios', 'Socios', 'panel-socios-solicitudes'],
      ['/admin/socios/padron', 'Padrón de socios', 'panel-socios-padron'],
      ['/admin/socios/planes', 'Planes de socio', 'panel-socios-planes'],
      ['/admin/mensajes', 'Mensajes', 'panel-mensajes'],
      ['/admin/auspiciadores', 'Auspiciadores', 'panel-auspiciadores'],
      ['/admin/auspiciadores/reporte', 'Reporte de clics', 'panel-auspiciadores-reporte'],
      ['/admin/datos-personales', 'Datos personales', 'panel-datos-personales'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await shot(name)
    }
    // El detalle de una solicitud, con sus datos, respuesta con un toque y aprobación.
    await page.goto('/admin/socios')
    await page.getByRole('list', { name: 'Solicitudes de socio' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Alta en el padrón' })).toBeVisible()
    await shot('panel-socios-solicitud')
  })

  test('fase 3b: tienda, eventos, club, formativas, la cancha, donaciones, galería y su panel', async ({
    page,
  }, testInfo) => {
    test.skip(fase !== 'fase-3b', 'Estas capturas son de la Fase 3b.')
    test.setTimeout(300_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    const shot = async (name: string) => {
      await loadLazyImages(page)
      await page.screenshot({ path: `${dir}/${name}-${width}.png`, fullPage: true })
    }
    for (const [path, name] of [
      ['/tienda', 'tienda'],
      ['/tienda/camiseta-oficial-local', 'tienda-producto'],
      ['/eventos', 'eventos'],
      ['/eventos/completada-a-beneficio', 'evento'],
      ['/club/directiva', 'directiva'],
      ['/club/transparencia', 'transparencia'],
      ['/formativas', 'formativas'],
      ['/club/la-cancha', 'la-cancha'],
      ['/apoya-al-club', 'apoya-al-club'],
      ['/galeria', 'galeria'],
      ['/videos', 'videos'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await shot(name)
    }
    await page.goto('/galeria')
    await page.getByRole('link', { name: /^Aniversario \d+ del club$/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: /^Aniversario/ })).toBeVisible()
    await shot('galeria-album')
    // El visor abierto (la captura de pantalla completa no aplica a un <dialog> modal).
    await page.getByRole('link', { name: /^Ver foto 1 de/ }).click()
    await expect(page.getByRole('dialog', { name: /visor de fotos$/ })).toBeVisible()
    await page.screenshot({ path: `${dir}/galeria-visor-${width}.png` })
    await page.keyboard.press('Escape')

    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    for (const [path, heading, name] of [
      ['/admin/tienda', 'Tienda', 'panel-tienda'],
      ['/admin/eventos', 'Eventos', 'panel-eventos'],
      ['/admin/club', 'Club', 'panel-club-directiva'],
      ['/admin/club/documentos', 'Documentos', 'panel-club-documentos'],
      ['/admin/club/horarios', 'Horarios de entrenamiento', 'panel-club-horarios'],
      ['/admin/galeria', 'Galería y videos', 'panel-galeria'],
      ['/admin/galeria/videos', 'Videos', 'panel-videos'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await shot(name)
    }
    // La ficha de un producto en el panel, con tallas y fotos.
    await page.goto('/admin/tienda')
    await page.getByRole('list', { name: 'Productos' }).getByRole('link').first().click()
    await expect(page.getByRole('heading', { name: 'Tallas', level: 2 })).toBeVisible()
    await shot('panel-tienda-producto')
  })

  test('fase 4a: consola en vivo, franja de la portada y detalle en vivo', async ({
    page,
    browser,
  }, testInfo) => {
    test.skip(fase !== 'fase-4a', 'Estas capturas son de la Fase 4a.')
    test.setTimeout(240_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    // Un partido propio (fecha 54/55, 00:01: `e2e-clean` lo borra) que se juega en la consola y se cierra.
    const round = testInfo.project.name === 'celular' ? 54 : 55
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
    await page.getByRole('button', { name: 'Usar nómina del partido anterior' }).click()
    await expect(page.getByText('Nómina copiada del partido anterior.')).toBeVisible()
    await page.screenshot({ path: `${dir}/panel-consola-previa-${width}.png`, fullPage: true })

    await page.getByRole('button', { name: 'Iniciar 1.er tiempo', exact: true }).click()
    await page.getByRole('button', { name: /^Gol de / }).click()
    await page.getByRole('group', { name: 'Jugador' }).getByRole('button').first().click()
    await page.screenshot({ path: `${dir}/panel-consola-gol-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Registrar' }).click()
    await expect(page.getByRole('status', { name: 'Marcador' })).toHaveText(/1 – 0/)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${dir}/panel-consola-en-vivo-${width}.png`, fullPage: true })

    const visitor = await browser.newContext({ viewport: page.viewportSize() ?? undefined })
    const site = await visitor.newPage()
    await site.goto('/')
    await expect(site.getByRole('region', { name: 'Partidos en vivo' })).toBeVisible()
    await site.screenshot({ path: `${dir}/portada-en-vivo-${width}.png` })
    await site.getByRole('link', { name: 'Seguir el partido' }).click()
    await expect(site.getByText('En vivo', { exact: true }).filter({ visible: true })).toBeVisible()
    await site.waitForTimeout(1500)
    await site.screenshot({ path: `${dir}/partido-en-vivo-${width}.png`, fullPage: true })
    await visitor.close()

    // Se cierra el partido: no queda nada en vivo.
    await page.getByRole('button', { name: 'Fin del 1.er tiempo', exact: true }).click()
    await page.getByRole('button', { name: 'Iniciar 2.º tiempo', exact: true }).click()
    await page.getByRole('button', { name: 'Finalizar partido' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Sí, finalizar' }).click()
    await expect(page.getByText(/^Finalizado/)).toBeVisible()
  })

  test('fase 4b: tarjetas para redes, feed curado y página sin conexión', async ({ page }, testInfo) => {
    test.skip(fase !== 'fase-4b', 'Estas capturas son de la Fase 4b.')
    test.setTimeout(180_000)
    const width = page.viewportSize()?.width ?? testInfo.project.name
    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()

    // Un partido jugado del seed: su ficha ofrece las tarjetas para descargar y compartir.
    await page.goto('/admin/partidos?vista=jugados')
    await page
      .getByRole('main')
      .getByRole('link')
      .filter({ hasText: /Cachorros|Honor/ })
      .first()
      .click()
    await expect(page.getByRole('heading', { name: 'Tarjetas para redes', level: 2 })).toBeVisible()
    await page.getByRole('heading', { name: 'Tarjetas para redes', level: 2 }).scrollIntoViewIfNeeded()
    await loadLazyImages(page)
    await page.screenshot({ path: `${dir}/panel-tarjetas-${width}.png`, fullPage: true })

    await page.goto('/admin/redes')
    await page.screenshot({ path: `${dir}/panel-redes-${width}.png`, fullPage: true })
    await page.goto('/admin/redes/nueva')
    await page.screenshot({ path: `${dir}/panel-redes-nueva-${width}.png`, fullPage: true })

    await page.goto('/')
    const feed = page.getByRole('region', { name: 'Redes sociales' })
    await feed.scrollIntoViewIfNeeded()
    await loadLazyImages(page)
    await feed.screenshot({ path: `${dir}/portada-redes-${width}.png` })

    await page.goto('/offline')
    await page.screenshot({ path: `${dir}/offline-${width}.png` })
  })
})
