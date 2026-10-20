import postgres from 'postgres'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { testDb } from './db-urls'

// `POST /api/forms/[form]` corre fuera de Next: `after()` guarda las tareas para ejecutarlas a mano, el
// correo es un doble (se prueba que se envía y qué pasa si falla) y Cloudflare (siteverify) se simula.
const doubles = vi.hoisted(() => ({
  afterTasks: [] as (() => unknown)[],
  sendMail: vi.fn<(message: { to: string | string[]; subject: string; replyTo?: string }) => Promise<void>>(),
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => unknown) => {
    doubles.afterTasks.push(task)
  },
}))
vi.mock('@/lib/mail', () => ({ sendMail: doubles.sendMail }))

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
const SITE = 'http://localhost:3000'
const SECRET = 'secreto-solo-para-pruebas-de-integracion-0123456789'
const SALT = 'sal-solo-para-pruebas-de-integracion-0123456789'

type Route = typeof import('@/app/api/forms/[form]/route')

/**
 * Carga el Route Handler con un SITE_ENV dado (cada carga trae su propio contador del rate limit). El pool
 * de la BD es uno solo (`globalThis`): se cierra una vez, al final.
 */
async function loadRoute(siteEnv: 'development' | 'staging' | 'production') {
  vi.resetModules()
  vi.stubEnv('SITE_ENV', siteEnv)
  if (siteEnv === 'production') {
    vi.stubEnv('TURNSTILE_SITE_KEY', '0x4AAAAAAA-integracion')
    vi.stubEnv('TURNSTILE_SECRET_KEY', '0x4AAAAAAA-integracion-secreto')
  }
  const route: Route = await import('@/app/api/forms/[form]/route')
  const { sql } = await import('@/db/client')
  return { POST: route.POST, close: () => sql.end() }
}

const { issueStamp } = await import('@/lib/forms/honeypot')
const { hashIp } = await import('@/lib/forms/client-ip')

let ipCounter = 0
/** Cada prueba usa su propia IP simulada para no compartir el cupo del rate limit. */
const nextIp = () => `198.51.100.${++ipCounter}`

function contactBody(overrides: Record<string, string | null> = {}) {
  const values: Record<string, string | null> = {
    topic: 'socios',
    name: 'Ana Pérez',
    email: 'Ana@Correo.cl',
    phone: '9 8765 4321',
    message: 'Quiero hacerme socia.',
    privacy: 'on',
    sitio_web: '',
    enviado_desde: issueStamp(SECRET, Date.now() - 5000),
    'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX',
    ...overrides,
  }
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) if (value !== null) form.set(key, value)
  return form
}

function post(
  body: FormData,
  { ip = nextIp(), json = true, headers = {} as Record<string, string>, form = 'contacto' } = {},
) {
  const request = new Request(`${SITE}/api/forms/${form}`, {
    method: 'POST',
    body,
    headers: {
      origin: SITE,
      'cf-connecting-ip': ip,
      ...(json ? { accept: 'application/json' } : {}),
      ...headers,
    },
  })
  return { request, ip, params: { params: Promise.resolve({ form }) } }
}

const contactRows = () =>
  admin<
    {
      email: string
      phone_e164: string | null
      ip_hash: string | null
      privacy_consent_at: Date | null
      privacy_policy_version: string | null
      notified_at: Date | null
      notify_attempts: number
    }[]
  >`select email, phone_e164, ip_hash, privacy_consent_at, privacy_policy_version, notified_at, notify_attempts
    from contact_messages order by created_at`

async function runAfterTasks() {
  const tasks = doubles.afterTasks.splice(0)
  for (const task of tasks) await task()
}

let dev: Awaited<ReturnType<typeof loadRoute>>

beforeAll(async () => {
  await admin`update site_settings set notify_recipients = ${admin.json({ contacto: ['directiva@cachorros.test'], socios: ['socios@cachorros.test'] })}`
  dev = await loadRoute('development')
})

beforeEach(async () => {
  await admin`delete from contact_messages`
  doubles.afterTasks.length = 0
  doubles.sendMail.mockReset()
  doubles.sendMail.mockResolvedValue(undefined)
  // Cloudflare siteverify con la clave de prueba «siempre pasa».
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, hostname: 'example.com', action: '' })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await dev.close()
  await admin.end()
})

describe('POST /api/forms/[form]: envío válido', () => {
  it('guarda el mensaje con consentimiento versionado e IP solo como hash, y avisa después de responder', async () => {
    const { request, ip, params } = post(contactBody())
    const response = await dev.POST(request, params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })

    const [row] = await contactRows()
    expect(row).toMatchObject({ email: 'ana@correo.cl', phone_e164: '+56987654321', notified_at: null })
    expect(row?.ip_hash).toBe(hashIp(ip, SALT))
    expect(row?.ip_hash).not.toContain('198.51')
    expect(row?.privacy_consent_at).toBeInstanceOf(Date)
    expect(row?.privacy_policy_version).toBeTruthy()
    // El correo no bloquea la respuesta: queda para `after()`.
    expect(doubles.sendMail).not.toHaveBeenCalled()

    await runAfterTasks()
    expect(doubles.sendMail).toHaveBeenCalledTimes(2)
    const [staff, ack] = doubles.sendMail.mock.calls.map(([message]) => message)
    expect(staff).toMatchObject({ to: ['directiva@cachorros.test'], replyTo: 'ana@correo.cl' })
    expect(staff?.subject).toBe('Nuevo mensaje de contacto: Socios')
    expect(ack).toMatchObject({ to: 'ana@correo.cl' })
    const [notified] = await contactRows()
    expect(notified?.notified_at).toBeInstanceOf(Date)
    expect(notified?.notify_attempts).toBe(1)
  })

  it('sin JavaScript responde con una redirección 303 de vuelta a la página (PRG)', async () => {
    const { request, params } = post(contactBody(), { json: false })
    const response = await dev.POST(request, params)
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe('/contacto?enviado=1#formulario')
  })

  it('un formulario que no existe responde 404', async () => {
    const { request, params } = post(contactBody(), { form: 'otro' })
    expect((await dev.POST(request, params)).status).toBe(404)
  })
})

describe('POST /api/forms/[form]: verificación del origen (CSRF)', () => {
  it('rechaza con 403 un Origin distinto de SITE_URL o ausente, sin guardar nada', async () => {
    for (const origin of ['https://otro.example', 'http://localhost:3001', 'null']) {
      const { request, params } = post(contactBody(), { headers: { origin } })
      const response = await dev.POST(request, params)
      expect(response.status, origin).toBe(403)
      expect(await response.json()).toMatchObject({ ok: false, code: 'origen' })
    }
    const request = new Request(`${SITE}/api/forms/contacto`, {
      method: 'POST',
      body: contactBody(),
      headers: { accept: 'application/json', 'cf-connecting-ip': nextIp() },
    })
    expect((await dev.POST(request, { params: Promise.resolve({ form: 'contacto' }) })).status).toBe(403)
    expect(await contactRows()).toHaveLength(0)
  })

  it('sin JavaScript, el rechazo por origen también vuelve a la página con el error', async () => {
    const { request, params } = post(contactBody(), {
      json: false,
      headers: { origin: 'https://otro.example' },
    })
    const response = await dev.POST(request, params)
    expect(response.headers.get('location')).toBe('/contacto?error=origen#formulario')
  })
})

describe('POST /api/forms/[form]: anti-spam', () => {
  const rejected = async (body: FormData, code: string, status = 400) => {
    const { request, params } = post(body)
    const response = await dev.POST(request, params)
    expect(response.status, code).toBe(status)
    expect(await response.json()).toMatchObject({ ok: false, code })
  }

  it('rechaza el campo trampa lleno, el envío demasiado rápido y el timestamp alterado', async () => {
    await rejected(contactBody({ sitio_web: 'https://spam.example' }), 'rechazado')
    await rejected(contactBody({ enviado_desde: issueStamp(SECRET, Date.now()) }), 'rapido')
    await rejected(
      contactBody({ enviado_desde: issueStamp('otra-clave-0123456789-0123456789', Date.now() - 5000) }),
      'rechazado',
    )
    await rejected(contactBody({ enviado_desde: null }), 'rechazado')
    expect(await contactRows()).toHaveLength(0)
  })

  it('sin token de Turnstile (sin JavaScript) rechaza ofreciendo los canales directos', async () => {
    await rejected(contactBody({ 'cf-turnstile-response': null }), 'sin-verificacion')
    const { request, params } = post(contactBody({ 'cf-turnstile-response': null }), { json: false })
    expect((await dev.POST(request, params)).headers.get('location')).toBe(
      '/contacto?error=sin-verificacion#formulario',
    )
  })

  it('un token que Cloudflare rechaza (clave «siempre falla») no se guarda', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })),
    )
    await rejected(contactBody(), 'rechazado')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('error', { status: 502 })),
    )
    await rejected(contactBody(), 'verificacion-caida', 503)
    expect(await contactRows()).toHaveLength(0)
  })

  it('valida los campos con los mensajes en español', async () => {
    const { request, params } = post(contactBody({ privacy: null, email: 'ana@' }))
    const response = await dev.POST(request, params)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ ok: false, code: 'campos' })
    expect(Object.keys(body.fieldErrors).sort()).toEqual(['email', 'privacy'])
    expect(body.fieldErrors.privacy).toEqual(['Para enviar, debes aceptar la política de privacidad.'])
  })
})

describe('reintento de los avisos (tarea tick)', () => {
  it('si el correo falla, el envío queda guardado y tick lo reintenta hasta 5 veces', async () => {
    const { notifySubmission, retryPendingNotifications, MAX_NOTIFY_ATTEMPTS } = await import(
      '@/features/inbox/notify'
    )
    doubles.sendMail.mockRejectedValue(new Error('SMTP caído'))
    const { request, params } = post(contactBody())
    expect((await dev.POST(request, params)).status).toBe(200)
    // La tarea de `after()` se ejecuta con el módulo cargado por esta prueba (mismo doble del correo).
    doubles.afterTasks.length = 0
    const [{ id } = { id: '' }] = await admin<{ id: string }[]>`select id from contact_messages`
    expect(await notifySubmission('contacto', id)).toBe(false)
    let [row] = await contactRows()
    expect(row).toMatchObject({ notified_at: null, notify_attempts: 1 })

    // Sigue fallando: tick reintenta hasta agotar los intentos y después lo deja en la bandeja.
    for (let i = 1; i < MAX_NOTIFY_ATTEMPTS; i++) {
      expect(await retryPendingNotifications()).toEqual({ sent: 0, failed: 1 })
    }
    expect(await retryPendingNotifications()).toEqual({ sent: 0, failed: 0 })
    ;[row] = await contactRows()
    expect(row).toMatchObject({ notified_at: null, notify_attempts: MAX_NOTIFY_ATTEMPTS })

    // Con otro envío pendiente y el SMTP de vuelta, tick lo entrega una sola vez.
    await admin`update contact_messages set notify_attempts = 2`
    doubles.sendMail.mockReset()
    doubles.sendMail.mockResolvedValue(undefined)
    expect(await retryPendingNotifications()).toEqual({ sent: 1, failed: 0 })
    expect(await retryPendingNotifications()).toEqual({ sent: 0, failed: 0 })
    ;[row] = await contactRows()
    expect(row?.notified_at).toBeInstanceOf(Date)
    expect(doubles.sendMail).toHaveBeenCalledTimes(2)
  })

  it('no reintenta lo que tiene más de 48 horas', async () => {
    const { retryPendingNotifications } = await import('@/features/inbox/notify')
    await admin`
      insert into contact_messages (name, email, topic, message, created_at)
      values ('Antiguo', 'antiguo@correo.cl', 'general', 'Hola', now() - interval '3 days')`
    expect(await retryPendingNotifications()).toEqual({ sent: 0, failed: 0 })
  })
})

describe('POST /api/forms/socios', () => {
  let activePlan = ''
  let inactivePlan = ''

  beforeAll(async () => {
    await admin`delete from membership_requests`
    const rows = await admin<{ id: string; is_active: boolean }[]>`
      insert into membership_plans (name, fee_clp, fee_period, is_active)
      values ('Integración vigente', 3000, 'mensual', true), ('Integración antiguo', 1000, 'anual', false)
      returning id, is_active`
    activePlan = rows.find((row) => row.is_active)?.id ?? ''
    inactivePlan = rows.find((row) => !row.is_active)?.id ?? ''
  })

  afterAll(async () => {
    await admin`delete from membership_requests`
    await admin`delete from membership_plans where name like 'Integración%'`
  })

  function membershipBody(overrides: Record<string, string | null> = {}) {
    return contactBody({
      topic: null,
      name: null,
      message: null,
      fullName: 'Luis Muñoz',
      email: 'Luis@Correo.cl',
      phone: '9 1234 5678',
      commune: 'Sagrada Familia',
      planId: activePlan,
      rut: '12345678-5',
      marketing: 'on',
      ...overrides,
    })
  }

  it('guarda la solicitud con el RUT formateado, el consentimiento y avisa a la bandeja de socios', async () => {
    const { request, ip, params } = post(membershipBody(), { form: 'socios' })
    const response = await dev.POST(request, params)
    expect(response.status).toBe(200)
    const [row] = await admin<
      {
        rut: string
        email: string
        marketing_consent: boolean
        privacy_policy_version: string
        ip_hash: string
      }[]
    >`select rut, email, marketing_consent, privacy_policy_version, ip_hash from membership_requests`
    expect(row).toMatchObject({ rut: '12.345.678-5', email: 'luis@correo.cl', marketing_consent: true })
    expect(row?.privacy_policy_version).toBeTruthy()
    expect(row?.ip_hash).toBe(hashIp(ip, SALT))

    await runAfterTasks()
    const [staff, ack] = doubles.sendMail.mock.calls.map(([message]) => message)
    expect(staff).toMatchObject({ to: ['socios@cachorros.test'], replyTo: 'luis@correo.cl' })
    expect(staff?.subject).toBe('Nueva solicitud de socio: Integración vigente')
    expect(ack).toMatchObject({ to: 'luis@correo.cl' })
  })

  it('rechaza un RUT con el dígito verificador equivocado, sin celular o con un plan inactivo', async () => {
    for (const [overrides, field] of [
      [{ rut: '12345678-9' }, 'rut'],
      [{ phone: '' }, 'phone'],
      [{ planId: inactivePlan }, 'planId'],
    ] as const) {
      const { request, params } = post(membershipBody(overrides), { form: 'socios' })
      const response = await dev.POST(request, params)
      expect(response.status).toBe(400)
      const body = (await response.json()) as { fieldErrors?: Record<string, string[]> }
      expect(Object.keys(body.fieldErrors ?? {})).toContain(field)
    }
    expect(await admin`select id from membership_requests where rut = '12.345.678-9'`).toHaveLength(0)
  })
})

describe('POST /api/forms/[form]: rate limit', () => {
  /** Envía 6 veces; cada intento cuenta, aunque se rechace por otro motivo. */
  async function sixAttempts(POST: Route['POST'], headersFor: (i: number) => Record<string, string>) {
    const statuses: number[] = []
    let retryAfter: string | null = null
    for (let i = 0; i < 6; i++) {
      const { request, params } = post(contactBody({ 'cf-turnstile-response': null }), {
        headers: headersFor(i),
      })
      const response = await POST(request, params)
      statuses.push(response.status)
      if (response.status === 429) {
        retryAfter = response.headers.get('retry-after')
        expect(await response.json()).toMatchObject({ code: 'limite' })
      }
    }
    return { statuses, retryAfter }
  }

  it('el 6.º envío en 10 minutos desde la misma IP recibe 429 con Retry-After', async () => {
    const ip = nextIp()
    const { statuses, retryAfter } = await sixAttempts(dev.POST, () => ({ 'cf-connecting-ip': ip }))
    expect(statuses).toEqual([400, 400, 400, 400, 400, 429])
    expect(Number(retryAfter)).toBeGreaterThan(0)
  })

  it('en desarrollo (y en el CI) la IP simulada de las pruebas tiene su propio cupo', async () => {
    const ip = nextIp()
    const { statuses } = await sixAttempts(dev.POST, (i) => ({
      'cf-connecting-ip': ip,
      'x-e2e-client-ip': `e2e-${ipCounter}-${i}`,
    }))
    expect(statuses).not.toContain(429)
  })

  for (const siteEnv of ['staging', 'production'] as const) {
    it(`en ${siteEnv} la IP simulada se ignora: cuenta la de Cloudflare`, async () => {
      const route = await loadRoute(siteEnv)
      try {
        const ip = nextIp()
        const { statuses } = await sixAttempts(route.POST, (i) => ({
          'cf-connecting-ip': ip,
          'x-e2e-client-ip': `e2e-falsa-${i}`,
        }))
        expect(statuses.at(-1)).toBe(429)
      } finally {
        vi.stubEnv('SITE_ENV', 'development')
      }
    })
  }
})
