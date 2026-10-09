import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import sharp from 'sharp'
import { ADMIN, login } from './support'

let dir: string
let photos: string[]

// Fotos de 12 MP con ruido (pesan varios MB, como las de un celular) y con datos de la cámara.
test.beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'cachorros-e2e-fotos-'))
  photos = await Promise.all(
    [0, 1, 2].map(async (n) => {
      const file = path.join(dir, `foto-12mp-${n}.jpg`)
      await sharp({
        create: {
          width: 4000,
          height: 3000,
          channels: 3,
          background: { r: 40 + n * 60, g: 110, b: 60 },
          noise: { type: 'gaussian', mean: 128, sigma: 25 },
        },
      })
        .withExif({
          IFD0: { Make: 'Celular E2E' },
          IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '35/1 0/1 0/1' },
        })
        .jpeg({ quality: 90 })
        .toFile(file)
      return file
    }),
  )
})

test.afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

test('subir fotos de 12 MP: se achican en el navegador y suben de a una', async ({ page }, testInfo) => {
  // 30 fotos seguidas desde el celular (criterio de la Fase 2); en escritorio basta una muestra.
  const total = testInfo.project.name === 'celular' ? 30 : 3
  test.setTimeout(240_000)
  const description = `E2E fotos ${testInfo.project.name} ${Date.now()}`

  const sizes: number[] = []
  let inFlight = 0
  let maxInFlight = 0
  page.on('request', (request) => {
    if (request.method() !== 'POST' || !request.url().endsWith('/api/admin/media')) return
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    sizes.push(request.postDataBuffer()?.byteLength ?? 0)
  })
  page.on('requestfinished', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/admin/media')) inFlight -= 1
  })

  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/medios')
  await expect(page.getByRole('heading', { name: 'Biblioteca de medios', level: 1 })).toBeVisible()
  // Con la biblioteca ya poblada por el seed, la sección de subida viene cerrada.
  const uploadSection = page.locator('details', { hasText: 'Subir fotos' })
  if (!(await uploadSection.getAttribute('open'))) await uploadSection.locator('summary').click()

  // Sin descripción no se sube nada: el texto alternativo es obligatorio.
  await page
    .locator('input[type="file"]')
    .setInputFiles(Array.from({ length: total }, (_, index) => photos[index % photos.length] ?? ''))
  await page.getByRole('button', { name: `Subir ${total} imágenes` }).click()
  await expect(page.getByText('Describe las fotos antes de subirlas.')).toBeVisible()
  expect(sizes).toHaveLength(0)

  await page.getByLabel('Descripción de las fotos').fill(description)
  await page.getByRole('button', { name: `Subir ${total} imágenes` }).click()
  await expect(page.getByText(/^Subiendo \d+ de \d+…$/)).toBeVisible()
  await expect(page.getByText(`${total} de ${total} imágenes listas.`)).toBeVisible({ timeout: 200_000 })

  expect(sizes).toHaveLength(total)
  expect(maxInFlight, 'las subidas van de a una').toBe(1)
  // El original pesa varios MB; lo que viaja ya viene reducido a 2560 px.
  expect(Math.max(...sizes)).toBeLessThan(4 * 1024 * 1024)

  // Quedan en la biblioteca, con su descripción, y se pueden editar.
  await page.goto(`/admin/medios?q=${encodeURIComponent(description)}`)
  await expect(page.getByText(`${total} imágenes con`)).toBeVisible()
  await page.getByRole('link', { name: description }).first().click()
  await expect(page.getByRole('heading', { name: 'Editar imagen', level: 1 })).toBeVisible()
  await expect(page.getByText('2560 × 1920 px')).toBeVisible()
  await expect(page.getByText('Esta imagen no se usa en ninguna parte del sitio.')).toBeVisible()

  // Next conserva oculta la pantalla anterior (con su propio campo «Crédito»): se busca por rol, que
  // ignora lo que no está visible.
  await page.getByRole('textbox', { name: /^Crédito/ }).fill('Foto: prueba E2E')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Guardado.')).toBeVisible()

  // Eliminar pide confirmación.
  await page.getByRole('button', { name: 'Eliminar imagen' }).click()
  await expect(page.getByRole('heading', { name: '¿Eliminar esta imagen?' })).toBeVisible()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page).toHaveURL(/\/admin\/medios$/)
  await page.goto(`/admin/medios?q=${encodeURIComponent(description)}`)
  await expect(page.getByText(`${total - 1} imágenes con`)).toBeVisible()
})

test('la biblioteca es accesible', async ({ page }) => {
  const { default: AxeBuilder } = await import('@axe-core/playwright')
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/medios')
  await expect(page.getByRole('heading', { name: 'Biblioteca de medios', level: 1 })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})
