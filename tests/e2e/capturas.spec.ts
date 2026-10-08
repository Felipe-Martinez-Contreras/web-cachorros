// Capturas para el reporte de fase (360 px y 1280 px). playwright.config.ts las excluye de las pruebas normales:
//   PowerShell:  $env:CAPTURAS = 'fase-1'; pnpm test:e2e capturas; Remove-Item Env:CAPTURAS
import { expect, test } from '@playwright/test'
import { ADMIN, login } from './support'

const fase = process.env.CAPTURAS

test.describe('capturas del reporte de fase', () => {
  test('portada, sección provisional, login, panel y sistema de diseño', async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const dir = `docs/fases/capturas/${fase}`
    const width = page.viewportSize()?.width ?? testInfo.project.name

    await page.goto('/')
    // La cuenta regresiva cambia cada segundo: se espera a que aparezca para que la captura sea la final.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${dir}/portada-${width}.png` })
    // Las imágenes bajo el pliegue son `loading="lazy"`: se recorre la página para que carguen.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y)
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForLoadState('networkidle')
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
})
