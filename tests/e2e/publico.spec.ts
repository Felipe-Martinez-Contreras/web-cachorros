import { expect, test } from '@playwright/test'

// La portada y la navegación pública se prueban en portada.spec.ts.
test('GET /api/health responde ok con la base de datos arriba', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ status: 'ok', db: 'ok' })
  expect(response.headers()['cache-control']).toBe('no-store')
})
