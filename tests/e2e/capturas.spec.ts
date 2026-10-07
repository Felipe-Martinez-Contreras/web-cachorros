// Capturas para el reporte de fase (360 px y 1280 px). No corre con las pruebas normales:
//   PowerShell:  $env:CAPTURAS = 'fase-0'; pnpm test:e2e capturas; Remove-Item Env:CAPTURAS
import { expect, test } from '@playwright/test'
import { ADMIN, login } from './support'

const fase = process.env.CAPTURAS

test.describe('capturas del reporte de fase', () => {
  test.skip(!fase, 'solo con la variable CAPTURAS')

  test('portada, login y panel', async ({ page }, testInfo) => {
    const dir = `docs/fases/capturas/${fase}`
    const width = page.viewportSize()?.width ?? testInfo.project.name

    await page.goto('/')
    await page.screenshot({ path: `${dir}/portada-${width}.png` })

    await page.goto('/admin/login')
    await page.screenshot({ path: `${dir}/login-${width}.png` })

    await login(page, ADMIN.email)
    await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
    await page.screenshot({ path: `${dir}/panel-${width}.png`, fullPage: true })
  })
})
