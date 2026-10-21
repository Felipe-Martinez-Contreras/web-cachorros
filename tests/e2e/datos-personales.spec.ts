import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, uniqueIp, useOwnIp, waitForTurnstile } from './support'

test('exportar y eliminar los datos de una persona desde el panel', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const stamp = `${testInfo.project.name}-${Date.now()}`
  const email = `e2e-datos-${stamp}@cachorros.test`

  // La persona escribe por el formulario de contacto (las pruebas no escriben en la BD por fuera).
  await useOwnIp(page, uniqueIp(testInfo.project.name))
  await page.goto('/contacto')
  const form = page.getByRole('main')
  await form.getByRole('textbox', { name: 'Nombre' }).fill(`E2E Datos ${stamp}`)
  await form.getByRole('textbox', { name: 'Correo' }).fill(email)
  await form.getByRole('textbox', { name: 'Mensaje' }).fill('Quiero que borren mis datos.')
  await form.getByRole('checkbox', { name: /Acepto la política de privacidad/ }).check()
  await waitForTurnstile(page)
  await page.waitForTimeout(3000)
  await page.getByRole('button', { name: 'Enviar mensaje' }).click()
  await expect(page.getByRole('status').filter({ hasText: '¡Mensaje enviado!' })).toBeVisible()

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  if (isMobile) {
    await page.getByRole('button', { name: 'Más' }).click()
    await page
      .getByRole('navigation', { name: 'Todos los módulos' })
      .getByRole('link', { name: 'Datos personales' })
      .click()
  } else {
    await page
      .getByRole('navigation', { name: 'Módulos del panel' })
      .getByRole('link', { name: 'Datos personales' })
      .click()
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Datos personales' })).toBeVisible()

  // Un texto que no es correo, RUT ni celular se explica junto al campo.
  await page.getByRole('textbox', { name: /^Correo, RUT o celular/ }).fill('Juan')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText(/^Escribe un correo, un RUT con guion/)).toBeVisible()

  await page.getByRole('textbox', { name: /^Correo, RUT o celular/ }).fill(email.toUpperCase())
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByRole('heading', { level: 2, name: '1 registro con ese correo' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/datos-personales$/) // el correo no queda en la URL
  await expectAccessible(page)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar en JSON' }).click()
  const file = await download
  const json = JSON.parse(await readFile(await file.path(), 'utf8')) as {
    registros: { contactMessages: { email: string; message: string }[] }
  }
  expect(json.registros.contactMessages).toEqual([
    expect.objectContaining({ email, message: 'Quiero que borren mis datos.' }),
  ])

  await page.getByRole('button', { name: 'Eliminar sus datos' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar sus datos' }).click()
  await expect(page.getByText('Datos eliminados.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'No hay datos con ese correo' })).toBeVisible()
})
