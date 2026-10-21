import { expect, test } from '@playwright/test'
import { ADMIN, expectAccessible, login, openModule } from './support'

test('feed curado: la publicación del panel llega a la portada y «Ver aquí» no carga nada de Instagram antes del clic', async ({
  page,
  baseURL,
}, testInfo) => {
  const excerpt = `E2E publicación ${testInfo.project.name}`
  const code = `E2E${testInfo.project.name}`
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()
  await openModule(page, 'Redes sociales', testInfo.project.name === 'celular')
  await page.getByRole('link', { name: 'Nueva publicación' }).click()

  await page
    .getByRole('textbox', { name: 'Enlace de la publicación' })
    .fill(`https://www.instagram.com/p/${code}/?igsh=seguimiento`)
  await page.getByRole('button', { name: 'Elegir imagen' }).click()
  const library = page.getByRole('dialog', { name: 'Elegir imagen' })
  await library.getByRole('searchbox', { name: 'Buscar en la biblioteca' }).fill('publicación en redes')
  await library
    .getByRole('button', { name: /^Imagen de ejemplo de una publicación en redes sociales/ })
    .first()
    .click()
  await expect(library).toBeHidden()
  await page.getByRole('textbox', { name: 'Texto breve' }).fill(excerpt)
  await page.getByRole('checkbox', { name: 'Fijar al comienzo' }).check()
  await page.getByRole('checkbox', { name: 'Permitir verla dentro del sitio' }).check()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page).toHaveURL(/\/admin\/redes$/)
  await expect(page.getByRole('link', { name: new RegExp(excerpt) })).toBeVisible()

  // En la portada: nada de Instagram hasta tocar «Ver aquí».
  const outside: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(baseURL ?? '') && !request.url().startsWith('data:'))
      outside.push(request.url())
  })
  // Instagram no es parte de la prueba: se responde aquí, sin salir a internet.
  await page.route('https://www.instagram.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Publicación</title>' }),
  )
  await page.goto('/')
  const feed = page.getByRole('region', { name: 'Redes sociales' })
  const post = feed.getByRole('link', { name: new RegExp(excerpt) })
  await expect(post).toHaveAttribute('href', `https://www.instagram.com/p/${code}/`)
  await expect(
    feed.getByRole('button', { name: 'Ver aquí la publicación de Instagram' }).first(),
  ).toBeVisible()
  await expectAccessible(page)
  expect(outside).toEqual([])

  await post.locator('xpath=..').getByRole('button', { name: 'Ver aquí la publicación de Instagram' }).click()
  const dialog = page.getByRole('dialog', { name: 'Publicación de Instagram' })
  await expect(dialog.locator('iframe')).toHaveAttribute('src', `https://www.instagram.com/p/${code}/embed/`)
  await expect.poll(() => outside.some((url) => url.includes(`/p/${code}/embed/`))).toBe(true)
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dialog).toBeHidden()

  // Se elimina desde el panel y sale de la portada.
  await page.goto('/admin/redes')
  await page.getByRole('link', { name: new RegExp(excerpt) }).click()
  await page.getByRole('button', { name: 'Eliminar publicación' }).click()
  await page.getByRole('button', { name: 'Sí, eliminar' }).click()
  await expect(page).toHaveURL(/\/admin\/redes$/)
  await page.goto('/')
  await expect(page.getByRole('link', { name: new RegExp(excerpt) })).toHaveCount(0)
})
