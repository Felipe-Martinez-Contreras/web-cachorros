import { expect, type Page, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

const ANIVERSARIO = /^Aniversario \d+ del club$/

async function openAnniversary(page: Page) {
  await page.goto('/galeria')
  await expect(page.getByRole('heading', { level: 1, name: 'Galería' })).toBeVisible()
  await page.getByRole('link', { name: ANIVERSARIO }).click()
  await expect(page.getByRole('heading', { level: 1, name: ANIVERSARIO })).toBeVisible()
}

test('álbumes con portada y visor de fotos con teclado', async ({ page }) => {
  await page.goto('/galeria')
  await expect(page.getByRole('heading', { level: 2, name: ANIVERSARIO })).toBeVisible()
  await expectAccessible(page)

  await openAnniversary(page)
  // Next conserva oculta la pantalla anterior (la lista, que también dice «4 fotos»): se busca en el encabezado.
  await expect(
    page.locator('header').filter({ has: page.getByRole('heading', { level: 1, name: ANIVERSARIO }) }),
  ).toContainText('4 fotos')
  await expectAccessible(page)

  const second = page.getByRole('link', { name: /^Ver foto 2 de 4/ })
  await second.click()
  const viewer = page.getByRole('dialog', { name: /visor de fotos$/ })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByText('Foto 2 de 4')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(viewer.getByText('Foto 3 de 4')).toBeVisible()
  await viewer.getByRole('button', { name: 'Foto anterior' }).click()
  await viewer.getByRole('button', { name: 'Foto anterior' }).click()
  await expect(viewer.getByText('Foto 1 de 4')).toBeVisible()
  // Desde la primera, «anterior» va a la última.
  await page.keyboard.press('ArrowLeft')
  await expect(viewer.getByText('Foto 4 de 4')).toBeVisible()
  await expectAccessible(page)
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  // El foco vuelve a la miniatura de la foto que se estaba viendo.
  await expect(page.getByRole('link', { name: /^Ver foto 4 de 4/ })).toBeFocused()
})

test('un álbum nuevo del panel, con una foto de la biblioteca, aparece en la galería', async ({
  page,
}, testInfo) => {
  const title = `E2E Álbum ${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Galería y videos', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Nuevo álbum' }).click()
  await page.getByRole('textbox', { name: 'Nombre' }).fill(title)
  await page.getByRole('checkbox', { name: 'Publicado en la galería' }).check()
  await page.getByRole('button', { name: 'Crear y subir las fotos' }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()

  const fromLibrary = page.locator('details').filter({ hasText: 'Agregar una foto de la biblioteca' })
  await fromLibrary.getByText('Agregar una foto de la biblioteca').click()
  await fromLibrary.getByRole('button', { name: 'Elegir imagen' }).click()
  const library = page.getByRole('dialog', { name: 'Elegir imagen' })
  // Otras pruebas suben fotos antes: la del seed puede no estar en la primera página. Se busca.
  await library.getByRole('searchbox', { name: 'Buscar en la biblioteca' }).fill('del álbum')
  await library
    .getByRole('button', { name: /^Imagen de ejemplo \d+ del álbum/ })
    .first()
    .click()
  await expect(library).toBeHidden()
  await fromLibrary.getByRole('button', { name: 'Agregar foto' }).click()
  await expect(page.getByText('Foto agregada.')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Fotos (1)' })).toBeVisible()
  await expectAccessible(page)

  await page.goto('/galeria')
  await page.getByRole('link', { name: title }).click()
  await expect(page.getByRole('link', { name: /^Ver foto 1 de 1/ })).toBeVisible()
})

test('videos: nada de YouTube se carga antes del clic', async ({ page, baseURL }, testInfo) => {
  const title = `E2E Video ${testInfo.project.name} ${Date.now()}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await page.goto('/admin/galeria/videos/nuevo')
  await page.getByRole('textbox', { name: 'Título' }).fill(title)
  await page.getByRole('textbox', { name: 'Dirección del video' }).fill('https://www.instagram.com/reel/abc/')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Pega la dirección de un video de YouTube o de Facebook.')).toBeVisible()
  await page.getByRole('textbox', { name: 'Dirección del video' }).fill('https://youtu.be/dQw4w9WgXcQ')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/galeria\/videos$/)

  const outside: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL ?? '') && !request.url().startsWith('data:'))
      outside.push(request.url())
  })
  // YouTube no es parte de la prueba: se responde aquí, sin salir a internet.
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Video</title>' }),
  )
  await page.goto('/videos')
  const facade = page.getByRole('link', { name: `Ver el video (${title})` })
  await expect(facade).toBeVisible()
  await expectAccessible(page)
  expect(outside).toEqual([])

  await facade.click()
  await expect(page.locator(`iframe[title="${title}"]`)).toBeVisible()
  await expect
    .poll(() => outside.some((url) => url.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')))
    .toBe(true)
})

test('un álbum que no existe responde 404', async ({ request }) => {
  const response = await request.get('/galeria/no-existe-este-album', { maxRedirects: 0 })
  expect(response.status()).toBe(404)
})

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('la grilla del álbum enlaza a cada foto', async ({ page }) => {
    await openAnniversary(page)
    const first = page.getByRole('link', { name: /^Ver foto 1 de 4/ })
    await expect(first).toHaveAttribute('href', /^\/media\/.+\.webp$/)
    await first.click()
    await expect(page).toHaveURL(/\/media\/.+\.webp$/)
  })
})
