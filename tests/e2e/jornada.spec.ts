import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login } from './support'

// Tarjeta «Jornada»: programar varias series contra el mismo rival y bajar una sola tarjeta con las series
// elegidas. Los partidos usan fechas desde la 40: `e2e-clean` los borra antes de cada corrida.

test('programar una jornada lleva a su tarjeta, con las series elegidas', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const round = isMobile ? 46 : 47
  // Un día distinto por proyecto: si no, las dos corridas serían la misma jornada.
  const day = new Date(Date.now() + (isMobile ? 120 : 121) * 86_400_000).toISOString().slice(0, 10)

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/partidos/jornada')
  await page.getByLabel('Día', { exact: true }).fill(day)
  await page.getByRole('combobox', { name: 'Rival' }).selectOption({ label: 'Real Los Espinos' })
  await page.getByRole('combobox', { name: 'El club juega de' }).selectOption({ label: 'Local' })
  for (const [serie, time] of [
    ['Tercera', '10:00'],
    ['Segunda', '12:00'],
    ['Honor', '15:30'],
  ] as const) {
    await page.getByRole('checkbox', { name: serie, exact: true }).check()
    await page.getByLabel(`Hora de ${serie}`).fill(time)
    await page.getByRole('spinbutton', { name: new RegExp(`^Fecha n.º de ${serie}`) }).fill(String(round))
  }
  await page.getByRole('button', { name: 'Programar 3 partidos' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Se programaron 3 partidos' }).first(),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Ver tarjeta de la jornada' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/partidos/jornadas/${day}_[0-9a-f-]{36}$`))
  await expect(page.getByRole('heading', { name: 'Tarjeta de la jornada', level: 1 })).toBeVisible()
  const preview = page.getByRole('img', { name: /^Tarjeta de la jornada:/ })
  await expect(preview).toHaveJSProperty('complete', true)
  expect(await preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080)
  await expectAccessible(page)

  // Sin la Tercera: la tarjeta lleva solo Segunda y Honor (y empieza a las 12:00).
  await page.getByRole('checkbox', { name: /^Tercera/ }).uncheck()
  await expect(page.getByRole('checkbox', { name: /^Segunda/ })).toBeChecked()
  await page.getByRole('button', { name: 'Ver la tarjeta así' }).click()
  await expect(page).toHaveURL(/[?&]series=[0-9a-f-]{36}%2C[0-9a-f-]{36}&/)
  await expect(page.getByRole('checkbox', { name: /^Tercera/ })).not.toBeChecked()
  await expect(preview).toHaveAttribute('src', /series=/)
  await expect(preview).toHaveJSProperty('complete', true)
  expect(await preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1080)

  // La descarga 4:5 sale de la ruta del panel con las mismas series.
  const download = page.getByRole('link', { name: 'Descargar Jornada 4:5' })
  const href = await download.getAttribute('href')
  expect(href).toMatch(/^\/api\/admin\/tarjetas\/jornada\/.+\/vertical\?series=.+&descargar=1$/)
  const response = await page.request.get(href ?? '')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toBe('image/png')
  expect(response.headers()['content-disposition']).toMatch(/^attachment; filename="jornada-/)

  // Sin sesión, la ruta del panel no entrega la tarjeta.
  const anonymous = await page.context().browser()?.newContext()
  if (anonymous) {
    expect((await anonymous.request.get(new URL(href ?? '', page.url()).toString())).status()).toBe(401)
    await anonymous.close()
  }
})
