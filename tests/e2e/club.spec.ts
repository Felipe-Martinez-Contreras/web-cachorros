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

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('los filtros de transparencia funcionan con el formulario', async ({ page }) => {
    await page.goto('/club/transparencia')
    await page.getByRole('combobox', { name: 'Categoría' }).selectOption('balance')
    await page.getByRole('button', { name: 'Ver' }).click()
    await expect(page).toHaveURL(/categoria=balance/)
    await expect(page.getByRole('heading', { level: 3, name: 'Balance anual (ejemplo)' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Estatutos del club (ejemplo)' })).toHaveCount(0)
  })
})
