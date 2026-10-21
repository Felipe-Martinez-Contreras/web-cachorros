import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
  'latin1',
)

test('directiva vigente y documentos de transparencia servidos con sandbox', async ({ page, request }) => {
  await page.goto('/club/directiva')
  await expect(page.getByRole('heading', { level: 1, name: 'Directiva' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'María Fernanda Soto (ejemplo)' })).toBeVisible()
  await expectAccessible(page)

  await page.goto('/club/transparencia')
  await expect(page.getByRole('heading', { level: 3, name: 'Estatutos del club (ejemplo)' })).toBeVisible()
  await expectAccessible(page)
  const href = await page
    .getByRole('link', { name: /^Abrir PDF de Balance anual \(ejemplo\)/ })
    .getAttribute('href')
  const pdf = await request.get(href ?? '')
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()['content-type']).toBe('application/pdf')
  expect(pdf.headers()['content-security-policy']).toBe('sandbox')
})

test('subir un documento PDF desde el panel lo publica; otro archivo se rechaza', async ({
  page,
}, testInfo) => {
  const title = `E2E Documento ${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Club', testInfo.project.name === 'celular')
  await page
    .getByRole('navigation', { name: 'Secciones de Club' })
    .getByRole('link', { name: 'Documentos' })
    .click()
  await page.getByRole('link', { name: 'Nuevo documento' }).click()
  await page.getByRole('textbox', { name: 'Título' }).fill(title)
  await page.getByRole('combobox', { name: 'Categoría' }).selectOption('rendicion')

  const file = page.getByLabel('Archivo PDF')
  await file.setInputFiles({
    name: 'e2e-no-es-pdf.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('<html></html>'),
  })
  await expect(page.getByText('Ese archivo no es un PDF. Los documentos se suben solo en PDF.')).toBeVisible()
  await file.setInputFiles({
    name: `e2e-rendicion-${testInfo.project.name}.pdf`,
    mimeType: 'application/pdf',
    buffer: PDF,
  })
  await expect(page.getByText(`e2e-rendicion-${testInfo.project.name}.pdf`)).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/club\/documentos$/)

  await page.goto('/club/transparencia?categoria=rendicion')
  await expect(page.getByRole('heading', { level: 3, name: title })).toBeVisible()
})

test('la cancha: el mapa no carga nada de terceros antes del clic', async ({ page, baseURL }) => {
  const outside: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL ?? '') && !request.url().startsWith('data:'))
      outside.push(request.url())
  })
  // OpenStreetMap no es parte de la prueba: se responde aquí, sin salir a internet.
  await page.route('https://www.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Mapa</title>' }),
  )

  await page.goto('/club/la-cancha')
  await expect(page.getByRole('heading', { level: 1, name: 'La cancha' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Horarios de entrenamiento' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Waze/ })).toHaveAttribute(
    'href',
    /^https:\/\/waze\.com\/ul\?ll=/,
  )
  await expectAccessible(page)
  expect(outside).toEqual([])

  await page.getByRole('link', { name: 'Ver el mapa' }).click()
  await expect(page.locator('iframe[title^="Mapa"]')).toBeVisible()
  await expect
    .poll(() => outside.some((url) => url.startsWith('https://www.openstreetmap.org/export/embed.html')))
    .toBe(true)
})

test('formativas y apoya al club: horarios, contacto sin datos de niños y «Copiar datos»', async ({
  page,
  context,
}) => {
  await page.goto('/formativas')
  await expect(page.getByRole('heading', { level: 1, name: 'Divisiones formativas' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Categorías y horarios' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Escribir desde Contacto' })).toHaveAttribute(
    'href',
    '/contacto?tema=formativas',
  )
  // Ningún formulario en la página: no se recolectan datos de niños.
  await expect(page.getByRole('main').locator('form')).toHaveCount(0)
  await expectAccessible(page)

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/apoya-al-club')
  await expect(page.getByRole('heading', { level: 1, name: 'Apoya al club' })).toBeVisible()
  await page.getByRole('button', { name: 'Copiar datos' }).click()
  await expect(page.getByText('Datos copiados: pégalos en la app de tu banco.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^Titular: .+\r?\nRUT: /)
  await expect(page.getByRole('link', { name: 'Ver las rendiciones' })).toHaveAttribute(
    'href',
    '/club/transparencia?categoria=rendicion',
  )
  await expectAccessible(page)
})

test('un horario agregado en el panel aparece en La cancha', async ({ page }, testInfo) => {
  // Cada proyecto usa su propia hora para no chocar con el otro.
  const startsAt = testInfo.project.name === 'celular' ? '06:05' : '06:35'
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/club/horarios')
  await expect(page.getByRole('heading', { level: 1, name: 'Horarios de entrenamiento' })).toBeVisible()
  const add = page.locator('details').filter({ hasText: 'Agregar un horario' })
  await add.getByText('Agregar un horario').click()
  await add.getByRole('combobox', { name: 'Día' }).selectOption('7')
  await add.getByLabel('Desde').fill(startsAt)
  await add.getByLabel('Hasta').fill('07:00')
  await add.getByRole('textbox', { name: /^Nota/ }).fill('E2E horario de prueba')
  await add.getByRole('button', { name: 'Agregar horario' }).click()
  await expect(page.getByText('Horario agregado.')).toBeVisible()
  await expectAccessible(page)

  await page.goto('/club/la-cancha')
  await expect(page.getByText(`${startsAt} a 07:00`).first()).toBeVisible()
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('el mapa es un enlace y los datos de transferencia se pueden seleccionar', async ({ page }) => {
    await page.goto('/club/la-cancha')
    await expect(page.getByRole('link', { name: 'Ver el mapa' })).toHaveAttribute(
      'href',
      /^https:\/\/www\.openstreetmap\.org\/\?mlat=/,
    )
    await page.goto('/apoya-al-club')
    await expect(page.getByText(/^Titular: /)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar datos' })).toHaveCount(0)
  })

  test('los filtros de transparencia funcionan con el formulario', async ({ page }) => {
    await page.goto('/club/transparencia')
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption('balance')
    await page.getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(/categoria=balance/)
    await expect(page.getByRole('heading', { level: 3, name: 'Balance anual (ejemplo)' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Estatutos del club (ejemplo)' })).toHaveCount(0)
  })
})
