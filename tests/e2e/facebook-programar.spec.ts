import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

// Programar en Facebook la tarjeta de una jornada y cancelarla. No se publica nada: la tarea `tick` no corre
// en las e2e y la programada se cancela antes de su hora. Los partidos usan fechas desde la 40 (`e2e-clean`).

/** Fecha `AAAA-MM-DD` en Santiago dentro de `days` días (como la escribe el panel). */
const santiagoDate = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(Date.now() + days * 86_400_000)

test('programar una jornada en Facebook y cancelarla', async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  const round = isMobile ? 48 : 49
  // Un día propio por proyecto (y distinto de jornada.spec): si no, sería la misma jornada.
  const offset = isMobile ? 140 : 141
  const day = santiagoDate(offset)
  const dayBefore = santiagoDate(offset - 1)

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()

  // 1. Una jornada de dos series contra el mismo rival.
  await page.goto('/admin/partidos/jornada')
  await page.getByLabel('Día', { exact: true }).fill(day)
  await page.getByRole('combobox', { name: 'Rival' }).selectOption({ label: 'Deportivo Los Litres' })
  await page.getByRole('combobox', { name: 'El club juega de' }).selectOption({ label: 'Local' })
  for (const [serie, time] of [
    ['Segunda', '12:00'],
    ['Honor', '15:30'],
  ] as const) {
    await page.getByRole('checkbox', { name: serie, exact: true }).check()
    await page.getByLabel(`Hora de ${serie}`).fill(time)
    await page.getByRole('spinbutton', { name: new RegExp(`^Fecha n.º de ${serie}`) }).fill(String(round))
  }
  await page.getByRole('button', { name: 'Programar 2 partidos' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Se programaron 2 partidos' }).first(),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Ver tarjeta de la jornada' }).click()
  await expect(page.getByRole('heading', { name: 'Tarjeta de la jornada', level: 1 })).toBeVisible()
  const jornadaUrl = page.url()

  // 2. La sección de Facebook sugiere programarla el día anterior a las 10:00 de Chile.
  const facebook = page.getByRole('region', { name: 'Publicar en Facebook' })
  const when = facebook.getByRole('combobox', { name: 'Cuándo' })
  await expect(when).toBeEnabled()
  await expect(when).toHaveValue('programar')
  await expect(facebook.getByLabel('Día', { exact: true })).toHaveValue(dayBefore)
  await expect(facebook.getByLabel('Hora de Chile')).toHaveValue('10:00')
  await expect(
    facebook.getByText('Puede publicarse hasta 5 minutos después de la hora elegida.'),
  ).toBeVisible()
  await expect(facebook.getByRole('textbox', { name: 'Texto de la publicación' })).toHaveValue(/Jornada/)
  await expectAccessible(page)

  // Una hora después del primer partido (12:00) no se acepta.
  await facebook.getByLabel('Día', { exact: true }).fill(day)
  await facebook.getByLabel('Hora de Chile').fill('13:00')
  await facebook.getByRole('button', { name: 'Programar' }).click()
  await expect(facebook.getByText(/Elige una hora anterior al inicio del partido/).first()).toBeVisible()

  await facebook.getByLabel('Día', { exact: true }).fill(dayBefore)
  await facebook.getByLabel('Hora de Chile').fill('10:00')
  await facebook.getByRole('button', { name: 'Programar' }).click()
  await expect(page.getByText('Publicación programada.')).toBeVisible()
  await expect(facebook.getByText(/^Se publicará el .+, 10:00 h$/)).toBeVisible()
  await expect(facebook.getByRole('button', { name: 'Programar' })).toHaveCount(0)

  // 3. Aparece en Facebook → Programadas, con su hora.
  await openModule(page, 'Facebook', isMobile)
  await expect(page.getByRole('heading', { name: 'Facebook', level: 1 })).toBeVisible()
  // La de este proyecto (la otra corrida programa otra jornada): por el enlace a su página.
  const jornadaPath = new URL(jornadaUrl).pathname
  const scheduled = page
    .getByRole('list', { name: 'Publicaciones programadas en Facebook' })
    .getByRole('listitem')
    .filter({ has: page.locator(`a[href="${jornadaPath}"]`) })
  await expect(scheduled).toBeVisible()
  await expect(scheduled.getByText(/Se publicará el .+, 10:00 h/)).toBeVisible()
  // La miniatura no se dibuja al abrir la lista: si no está en caché, se ofrece «Ver imagen».
  await expect(
    scheduled
      .getByRole('img', { name: /^Tarjeta: Jornada/ })
      .or(scheduled.getByRole('link', { name: /^Ver imagen/ })),
  ).toBeVisible()
  await expectAccessible(page)

  // 4. Cancelarla: sale de la lista y la jornada vuelve a ofrecer el formulario.
  await scheduled.getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar la publicación' }).click()
  await expect(page.getByText('Publicación cancelada.')).toBeVisible()
  await expect(scheduled).toHaveCount(0)

  await page.goto(jornadaUrl)
  await expect(
    page.getByRole('region', { name: 'Publicar en Facebook' }).getByRole('combobox', { name: 'Cuándo' }),
  ).toBeVisible()
})
