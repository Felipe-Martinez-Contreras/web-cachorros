import { expect, test } from '@playwright/test'
import { adminSql } from './db'
import { ADMIN, drawCardPreview, expectAccessible, login } from './support'

// Publicación en Facebook contra la Graph API simulada (`graph-mock.mjs`): nunca se llama a Facebook real.

/** Fecha `AAAA-MM-DD` en Santiago dentro de `days` días (como la escribe el panel). */
const santiagoDate = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(Date.now() + days * 86_400_000)

const GRAPH_MOCK = 'http://localhost:3190'

type Received = {
  method: string
  caption?: string
  source?: { filename: string; bytes: number } | null
  tokenInUrl?: boolean
  hasToken?: boolean
}

test('publicar a mano la previa de un partido: vista previa, texto editable y una sola vez', async ({
  page,
  request,
}, testInfo) => {
  const isMobile = testInfo.project.name === 'celular'
  // Números de fecha propios (resultados.spec usa del 40 al 45): las pruebas filtran los partidos por fecha.
  const round = isMobile ? 46 : 47
  await login(page, ADMIN.email)
  await expect(page.getByRole('heading', { name: 'Inicio', level: 1 })).toBeVisible()

  // 1. Activar la publicación y probar la conexión.
  // La dirección de antes lleva a Facebook → Ajustes.
  await page.goto('/admin/configuracion/facebook')
  await expect(page).toHaveURL(/\/admin\/facebook\/ajustes$/)
  await expect(page.getByRole('heading', { name: 'Facebook', level: 1 })).toBeVisible()
  await expect(page.getByText('Sitio de pruebas con publicación permitida')).toBeVisible()
  // El formulario se habilita al hidratar: un clic anterior se perdería.
  const enable = page.getByRole('checkbox', { name: 'Publicar en Facebook' })
  await expect(enable).toBeEnabled()
  await expect(async () => {
    await enable.check()
  }).toPass()
  // La semanal es secundaria y viene apagada.
  await expect(page.getByRole('checkbox', { name: /^Publicación automática semanal/ })).not.toBeChecked()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Ajustes de Facebook guardados.')).toBeVisible()
  await page.getByRole('button', { name: 'Probar conexión' }).click()
  await expect(page.getByText('La conexión con la página de Facebook funciona.')).toBeVisible()

  // 2. Programar un partido por el panel.
  await page.goto('/admin/partidos/nuevo')
  await page.getByRole('combobox', { name: 'Serie' }).selectOption({ label: 'Honor' })
  await page.getByRole('combobox', { name: 'Visita' }).selectOption({ label: 'Deportivo Los Litres' })
  // Lejos en el calendario: así no pasa a ser el «próximo partido» de la portada para las demás pruebas.
  await page.getByLabel('Día', { exact: true }).fill(santiagoDate(120))
  await page.getByLabel('Hora', { exact: true }).fill('16:00')
  await page.getByRole('spinbutton', { name: /^Número de fecha/ }).fill(String(round))
  await page.getByRole('button', { name: 'Programar partido' }).click()
  await expect(page.getByText('Partido programado.')).toBeVisible()
  const sql = adminSql()
  const [match] = await sql<{ id: string }[]>`
    select id from matches where round_number = ${round} order by created_at desc limit 1`
  await sql.end()
  expect(match?.id).toBeTruthy()

  // 3. Desde la ficha: vista previa de la tarjeta 4:5 y texto sugerido, editable.
  await page.goto(`/admin/partidos/${match?.id}`)
  const section = page.getByRole('region', { name: 'Facebook' })
  await section.getByRole('link', { name: 'Publicar o programar en Facebook' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/partidos/${match?.id}/facebook$`), { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Publicar en Facebook', level: 1 })).toBeVisible()
  await drawCardPreview(page, 'Tarjeta «Próximo partido» que se subirá a Facebook')
  const text = page.getByRole('textbox', { name: 'Texto de la publicación' })
  await expect(text).toHaveValue(/^⚽ Próximo partido · Honor/)
  await expect(text).toHaveValue(/Más información: http:\/\/localhost:\d+\/partidos\//)
  await expectAccessible(page)

  const caption = `E2E previa revisada a mano (${testInfo.project.name})\n¡Vamos!`
  await text.fill(caption)
  // Por defecto ofrece programarla (el partido es en meses); aquí se publica ahora.
  await expect(page.getByRole('combobox', { name: 'Cuándo' })).toHaveValue('programar')
  await page.getByRole('combobox', { name: 'Cuándo' }).selectOption({ label: 'Publicar ahora' })
  await page.getByRole('button', { name: 'Publicar ahora' }).click()
  await expect(page.getByText('Publicado en Facebook.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/admin/partidos/${match?.id}$`))

  // 4. En la ficha queda publicada, con su enlace, y ya no se ofrece publicar otra vez.
  await expect(section.getByText('Publicado', { exact: true })).toBeVisible()
  await expect(section.getByRole('link', { name: 'Ver en Facebook' })).toHaveAttribute(
    'href',
    /^https:\/\/www\.facebook\.com\/1000000000001_\d+$/,
  )
  await expect(section.getByRole('link', { name: 'Publicar o programar en Facebook' })).toHaveCount(0)
  await page.goto(`/admin/partidos/${match?.id}/facebook`)
  await expect(page.getByRole('button', { name: 'Publicar ahora' })).toHaveCount(0)
  await expect(page.getByText('Publicado', { exact: true })).toBeVisible()

  // 5. La API simulada recibió la imagen como archivo, el texto editado y el token fuera de la URL.
  const received = (await (await request.get(`${GRAPH_MOCK}/__peticiones`)).json()) as Received[]
  const posts = received.filter((item) => item.method === 'POST' && item.caption === caption)
  expect(posts).toHaveLength(1)
  expect(posts[0]?.source?.filename).toMatch(/^proximo-.+\.png$/)
  expect(posts[0]?.source?.bytes).toBeGreaterThan(10_000)
  expect(posts[0]).toMatchObject({ tokenInUrl: false, hasToken: true })

  // 6. Y aparece en Facebook → Publicadas.
  await page.goto('/admin/facebook/publicadas')
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: /Próximo partido · Honor: Cachorros vs Los Litres/ })
      .first(),
  ).toBeVisible()
})
