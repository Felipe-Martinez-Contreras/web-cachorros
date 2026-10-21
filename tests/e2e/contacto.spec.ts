import { expect, type Page, test } from '@playwright/test'
import {
  expectAccessible,
  uniqueIp,
  useOwnIp,
  waitForMail,
  waitForMailMatching,
  waitForTurnstile,
} from './support'

async function fillContact(page: Page, sender: { name: string; email: string }) {
  const form = page.getByRole('main')
  await form.getByRole('combobox', { name: 'Tema' }).selectOption('auspicios')
  await form.getByRole('textbox', { name: 'Nombre' }).fill(sender.name)
  await form.getByRole('textbox', { name: 'Correo' }).fill(sender.email)
  await form.getByRole('textbox', { name: /^Celular/ }).fill('9 8765 4321')
  await form.getByRole('textbox', { name: 'Mensaje' }).fill('Tenemos un almacén y queremos auspiciar.')
  await form.getByRole('checkbox', { name: /Acepto la política de privacidad/ }).check()
}

test.describe('formulario de contacto', () => {
  test('un envío válido se guarda, avisa a la directiva y llega el acuse de recibo', async ({
    page,
    request,
  }, testInfo) => {
    const stamp = `${testInfo.project.name}-${Date.now()}`
    const sender = { name: `E2E Contacto ${stamp}`, email: `e2e-contacto-${stamp}@cachorros.test` }
    await useOwnIp(page, uniqueIp(testInfo.project.name))

    await page.goto('/contacto?tema=socios')
    await expect(page.getByRole('heading', { level: 1, name: 'Contacto' })).toBeVisible()
    // `?tema=` preselecciona el tema.
    await expect(page.getByRole('combobox', { name: 'Tema' })).toHaveValue('socios')
    await expect(page.getByRole('link', { name: 'política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    )
    await fillContact(page, sender)
    await waitForTurnstile(page)
    await expectAccessible(page)
    // El servidor exige al menos 3 s desde que se dibujó el formulario.
    await page.waitForTimeout(3000)
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByRole('status').filter({ hasText: '¡Mensaje enviado!' })).toBeVisible()

    const ack = await waitForMail(request, sender.email)
    expect(ack).toContain('Recibimos tu mensaje sobre «Auspicios»')
    const staff = await waitForMailMatching(request, `to:contacto@cachorros.test "${sender.name}"`)
    expect(staff).toContain(`Correo: ${sender.email}`)
    expect(staff).toContain('Celular: +56987654321')
  })

  test('los errores de validación se muestran junto a cada campo', async ({ page }, testInfo) => {
    await useOwnIp(page, uniqueIp(testInfo.project.name))
    await page.goto('/contacto')
    await page.getByRole('textbox', { name: 'Nombre' }).fill('E2E Sin Correo')
    await page.getByRole('textbox', { name: 'Mensaje' }).fill('Hola')
    await waitForTurnstile(page)
    // El servidor exige al menos 3 s desde que se dibujó el formulario.
    await page.waitForTimeout(3000)
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Revisa los campos marcados.')
    await expect(page.getByRole('textbox', { name: 'Correo' })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Para enviar, debes aceptar la política de privacidad.')).toBeVisible()
  })

  test('con el campo trampa lleno se rechaza y no se envía ningún correo', async ({
    page,
    request,
  }, testInfo) => {
    const stamp = `${testInfo.project.name}-${Date.now()}`
    const sender = { name: `E2E Bot ${stamp}`, email: `e2e-bot-${stamp}@cachorros.test` }
    await useOwnIp(page, uniqueIp(testInfo.project.name))
    await page.goto('/contacto')
    await fillContact(page, sender)
    // Lo que haría un bot: completar también el campo que las personas no ven.
    await page.locator('input[name="sitio_web"]').evaluate((input: HTMLInputElement) => {
      input.value = 'https://spam.example'
    })
    await waitForTurnstile(page)
    await page.waitForTimeout(3000)
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('No pudimos enviar el formulario.')

    await page.waitForTimeout(2000)
    const search = await request.get('http://localhost:8025/api/v1/search', {
      params: { query: `to:${sender.email}` },
    })
    expect(((await search.json()) as { messages: unknown[] }).messages).toHaveLength(0)
  })

  test('el 6.º envío en 10 minutos desde la misma IP recibe 429 con un mensaje amable', async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    const ip = uniqueIp(testInfo.project.name)
    for (let i = 0; i < 5; i++) {
      const response = await request.post('/api/forms/contacto', {
        headers: { origin: baseURL ?? '', accept: 'application/json', 'x-e2e-client-ip': ip },
        multipart: { name: 'E2E Rate' },
      })
      expect(response.status()).not.toBe(429)
    }
    const sixth = await request.post('/api/forms/contacto', {
      headers: { origin: baseURL ?? '', accept: 'application/json', 'x-e2e-client-ip': ip },
      multipart: { name: 'E2E Rate' },
    })
    expect(sixth.status()).toBe(429)
    expect(Number(sixth.headers()['retry-after'])).toBeGreaterThan(0)

    // En la página, la misma IP ve el aviso en lenguaje claro.
    await useOwnIp(page, ip)
    await page.goto('/contacto')
    await fillContact(page, { name: 'E2E Rate', email: 'e2e-rate@cachorros.test' })
    await waitForTurnstile(page)
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Recibimos varios envíos seguidos desde tu conexión.',
    )
  })

  test('rechaza un envío desde otro origen (CSRF)', async ({ request }, testInfo) => {
    const response = await request.post('/api/forms/contacto', {
      headers: {
        origin: 'https://otro.example',
        accept: 'application/json',
        'x-e2e-client-ip': uniqueIp(testInfo.project.name),
      },
      multipart: { name: 'E2E Origen' },
    })
    expect(response.status()).toBe(403)
  })
})

test.describe('formulario de contacto sin JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('se muestra y se envía, pero sin Turnstile se rechaza ofreciendo WhatsApp', async ({
    page,
  }, testInfo) => {
    await useOwnIp(page, uniqueIp(testInfo.project.name))
    await page.goto('/contacto')
    await expect(page.getByText(/eso requiere JavaScript/).first()).toBeVisible()
    await page.getByRole('textbox', { name: 'Nombre' }).fill('E2E Sin JavaScript')
    // Una persona tarda más de los 3 s mínimos; si no, la respuesta sería «Lo enviaste muy rápido».
    await page.waitForTimeout(3000)
    await page.getByRole('button', { name: 'Enviar mensaje' }).click()

    await expect(page).toHaveURL(/\/contacto\?error=sin-verificacion#formulario$/)
    const alert = page.getByRole('main').getByRole('alert')
    await expect(alert).toContainText('Para enviar el formulario necesitamos verificar que no eres un robot')
    await expect(alert.getByRole('link', { name: 'WhatsApp del club' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\//,
    )
  })
})
