import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

const COMPLETADA = 'Gran completada a beneficio de las series'

test('próximos y pasados, detalle con afiche ampliable, WhatsApp y calendario', async ({ page, request }) => {
  await page.goto('/eventos')
  await expect(page.getByRole('heading', { level: 1, name: 'Eventos' })).toBeVisible()
  const upcoming = page.getByRole('region', { name: 'Próximos eventos' })
  const past = page.getByRole('region', { name: 'Eventos pasados' })
  await expect(upcoming.getByRole('heading', { level: 3, name: COMPLETADA })).toBeVisible()
  await expect(past.getByRole('heading', { level: 3, name: /^Aniversario \d+ del club$/ })).toBeVisible()
  await expectAccessible(page)

  await upcoming.getByRole('link', { name: COMPLETADA }).click()
  await expect(page.getByRole('heading', { level: 1, name: COMPLETADA })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Consultar por WhatsApp/ })).toHaveAttribute(
    'href',
    /^https:\/\/wa\.me\/56900000000\?text=/,
  )
  await expectAccessible(page)

  await page.getByRole('button', { name: 'Ver el afiche ampliado' }).click()
  const close = page.getByRole('button', { name: 'Cerrar el afiche' })
  await expect(close).toBeVisible()
  await close.click()
  await expect(close).toBeHidden()

  const ics = await page.getByRole('link', { name: 'Agregar al calendario' }).getAttribute('href')
  const response = await request.get(ics ?? '')
  expect(response.headers()['content-type']).toBe('text/calendar; charset=utf-8')
  expect(await response.text()).toContain(`SUMMARY:${COMPLETADA}`)
})

test('un evento creado en el panel aparece en los próximos', async ({ page }, testInfo) => {
  const title = `E2E Evento ${testInfo.project.name} ${Date.now()}`
  const date = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Eventos', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Nuevo evento' }).click()
  await page.getByRole('textbox', { name: 'Nombre' }).fill(title)
  await page.getByRole('combobox', { name: 'Tipo' }).selectOption('rifa')
  await page.getByLabel('Día', { exact: true }).fill(date)
  await page.getByLabel('Hora de inicio').fill('18:30')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/eventos$/)
  await expectAccessible(page)

  await page.goto('/eventos')
  await page.getByRole('region', { name: 'Próximos eventos' }).getByRole('link', { name: title }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  const detail = page.locator('article').filter({ has: page.getByRole('heading', { level: 1, name: title }) })
  await expect(detail.locator('time')).toContainText('18:30')
})

test('un evento que no existe responde 404', async ({ request }) => {
  const response = await request.get('/eventos/no-existe-este-evento', { maxRedirects: 0 })
  expect(response.status()).toBe(404)
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('el afiche se amplía con el popover nativo', async ({ page }) => {
    await page.goto('/eventos/completada-a-beneficio')
    await page.getByRole('button', { name: 'Ver el afiche ampliado' }).click()
    await expect(page.getByRole('button', { name: 'Cerrar el afiche' })).toBeVisible()
  })
})
