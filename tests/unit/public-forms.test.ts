import { describe, expect, it, vi } from 'vitest'
import { contactFormSchema } from '@/features/inbox/schemas'
import { clientIp, hashIp, TEST_IP_HEADER } from '@/lib/forms/client-ip'
import { checkStamp, isHoneypotFilled, issueStamp, MAX_FILL_MS, MIN_FILL_MS } from '@/lib/forms/honeypot'
import { isSameOrigin } from '@/lib/forms/origin'
import { RateLimiter } from '@/lib/forms/rate-limit'
import { TURNSTILE_TEST_KEY, verifyTurnstile } from '@/lib/forms/turnstile'

const KEY = 'clave-de-firma-de-pruebas-0123456789'
const T0 = Date.UTC(2026, 9, 20, 15, 0, 0)

describe('tiempo mínimo de llenado (timestamp firmado)', () => {
  it('acepta un formulario llenado en 3 s o más y rechaza uno más rápido', () => {
    const stamp = issueStamp(KEY, T0)
    expect(checkStamp(stamp, KEY, T0 + MIN_FILL_MS - 1)).toBe('too-fast')
    expect(checkStamp(stamp, KEY, T0 + MIN_FILL_MS)).toBe('ok')
  })

  it('un formulario abierto más de 24 h expira', () => {
    const stamp = issueStamp(KEY, T0)
    expect(checkStamp(stamp, KEY, T0 + MAX_FILL_MS + 1)).toBe('expired')
  })

  it('rechaza un timestamp alterado, firmado con otra clave o mal formado', () => {
    const [issuedAt, signature] = issueStamp(KEY, T0).split('.')
    const earlier = String(Number(issuedAt) - 60_000)
    expect(checkStamp(`${earlier}.${signature}`, KEY, T0 + 5000)).toBe('invalid')
    expect(checkStamp(issueStamp('otra-clave-0123456789-0123456789', T0), KEY, T0 + 5000)).toBe('invalid')
    for (const bad of [null, '', 'abc', `${issuedAt}`, `${issuedAt}.${signature}.extra`, `12.${signature}`]) {
      expect(checkStamp(bad, KEY, T0 + 5000)).toBe('invalid')
    }
  })

  it('el campo trampa solo pasa si llega vacío', () => {
    expect(isHoneypotFilled(null)).toBe(false)
    expect(isHoneypotFilled('   ')).toBe(false)
    expect(isHoneypotFilled('https://spam.example')).toBe(true)
  })
})

describe('rate limit (token bucket)', () => {
  it('deja 5 envíos y rechaza el 6.º con el tiempo de espera', () => {
    const limiter = new RateLimiter({ capacity: 5, windowMs: 10 * 60_000 })
    for (let i = 0; i < 5; i++) expect(limiter.take('contacto:1.1.1.1', T0 + i)).toEqual({ allowed: true })
    const sixth = limiter.take('contacto:1.1.1.1', T0 + 5)
    expect(sixth.allowed).toBe(false)
    if (!sixth.allowed) expect(sixth.retryAfterSeconds).toBe(120)
    // Otra IP (u otro formulario) tiene su propio cupo.
    expect(limiter.take('contacto:2.2.2.2', T0 + 5)).toEqual({ allowed: true })
  })

  it('recupera un envío cada 2 minutos, sin pasar de 5', () => {
    const limiter = new RateLimiter({ capacity: 5, windowMs: 10 * 60_000 })
    for (let i = 0; i < 5; i++) limiter.take('k', T0)
    expect(limiter.take('k', T0 + 119_000).allowed).toBe(false)
    expect(limiter.take('k', T0 + 241_000).allowed).toBe(true)
    // Una hora después vuelve a tener 5, no más.
    const later = T0 + 3_600_000
    for (let i = 0; i < 5; i++) expect(limiter.take('k', later).allowed).toBe(true)
    expect(limiter.take('k', later).allowed).toBe(false)
  })

  it('no crece sin límite: olvida primero las claves inactivas', () => {
    const limiter = new RateLimiter({ capacity: 5, windowMs: 10 * 60_000, maxKeys: 2 })
    for (let i = 0; i < 5; i++) limiter.take('a', T0)
    limiter.take('b', T0)
    // «c» entra cuando «a» y «b» ya están llenas de nuevo: se olvidan y «c» parte con su cupo.
    expect(limiter.take('c', T0 + 11 * 60_000)).toEqual({ allowed: true })
    // Con todas activas («c» y «d» recién usadas), se descarta la más antigua y la nueva igual tiene cupo.
    const now = T0 + 11 * 60_000
    for (let i = 0; i < 5; i++) limiter.take('d', now)
    expect(limiter.take('e', now)).toEqual({ allowed: true })
    // «d» sigue sin cupo: la descartada fue «c», la más antigua.
    expect(limiter.take('d', now).allowed).toBe(false)
  })
})

describe('IP de quien envía', () => {
  const headers = (values: Record<string, string>) => new Headers(values)

  it('en staging y producción usa CF-Connecting-IP e ignora la cabecera de pruebas', () => {
    const request = headers({ 'cf-connecting-ip': '200.1.2.3', [TEST_IP_HEADER]: 'e2e-falsa' })
    expect(clientIp(request, 'production')).toBe('200.1.2.3')
    expect(clientIp(request, 'staging')).toBe('200.1.2.3')
    expect(clientIp(headers({ [TEST_IP_HEADER]: 'e2e-falsa' }), 'production')).toBe('desconocida')
  })

  it('solo en desarrollo (como corre el CI) acepta la IP simulada de las pruebas', () => {
    const request = headers({ 'cf-connecting-ip': '200.1.2.3', [TEST_IP_HEADER]: 'e2e-celular' })
    expect(clientIp(request, 'development')).toBe('e2e-celular')
    expect(clientIp(headers({}), 'development')).toBe('desconocida')
  })

  it('se guarda como HMAC: estable con la misma sal y sin la IP a la vista', () => {
    const hash = hashIp('200.1.2.3', 'sal-uno-0123456789-0123456789-0123')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(hashIp('200.1.2.3', 'sal-uno-0123456789-0123456789-0123'))
    expect(hash).not.toBe(hashIp('200.1.2.3', 'sal-dos-0123456789-0123456789-0123'))
    expect(hash).not.toContain('200')
  })
})

describe('origen del envío (CSRF)', () => {
  const site = 'https://cachorros.fmartinez.xyz'

  it('acepta solo el origen exacto de SITE_URL', () => {
    expect(isSameOrigin(new Headers({ origin: site }), site)).toBe(true)
    expect(isSameOrigin(new Headers({ origin: 'https://cachorros.fmartinez.xyz' }), `${site}/`)).toBe(true)
    for (const origin of [
      'https://otro.example',
      'http://cachorros.fmartinez.xyz',
      'https://cachorros.fmartinez.xyz:8443',
      'https://cachorros.fmartinez.xyz.evil.example',
      'null',
    ]) {
      expect(isSameOrigin(new Headers({ origin }), site), origin).toBe(false)
    }
  })

  it('rechaza el envío sin cabecera Origin', () => {
    expect(isSameOrigin(new Headers(), site)).toBe(false)
  })
})

describe('Turnstile en el servidor', () => {
  const REAL_SECRET = '0x4AAAAAAA-secreto-real'
  const respond = (body: unknown, status = 200) =>
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }))
  const config = (fetchImpl: typeof fetch, secret = REAL_SECRET) => ({
    secret,
    hostname: 'cachorros.fmartinez.xyz',
    fetch: fetchImpl,
  })

  it('sin token no consulta a Cloudflare', async () => {
    const fetchImpl = respond({ success: true })
    expect(await verifyTurnstile(null, { action: 'contacto' }, config(fetchImpl))).toBe('missing')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('con una clave real exige success, hostname y action', async () => {
    const ok = { success: true, hostname: 'cachorros.fmartinez.xyz', action: 'contacto' }
    const expected = { action: 'contacto', remoteIp: '200.1.2.3' }
    const fetchImpl = respond(ok)
    expect(await verifyTurnstile('token', expected, config(fetchImpl))).toBe('ok')
    const body = fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams
    expect(Object.fromEntries(body)).toEqual({
      secret: REAL_SECRET,
      response: 'token',
      remoteip: '200.1.2.3',
    })

    for (const bad of [
      { ...ok, success: false },
      { ...ok, hostname: 'otro.example' },
      { ...ok, action: 'socio' },
    ]) {
      expect(await verifyTurnstile('token', expected, config(respond(bad)))).toBe('rejected')
    }
  })

  it('con las claves de prueba solo cuenta success (Cloudflare responde datos ficticios)', async () => {
    const secret = '1x0000000000000000000000000000000AA'
    const dummy = { success: true, hostname: 'example.com', action: '' }
    expect(
      await verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', { action: 'contacto' }, config(respond(dummy), secret)),
    ).toBe('ok')
    const failing = '2x0000000000000000000000000000000AA'
    expect(
      await verifyTurnstile('t', { action: 'contacto' }, config(respond({ success: false }), failing)),
    ).toBe('rejected')
  })

  it('si Cloudflare no responde, lo informa aparte (no es culpa de quien envía)', async () => {
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await verifyTurnstile('t', { action: 'contacto' }, config(down))).toBe('unavailable')
    expect(await verifyTurnstile('t', { action: 'contacto' }, config(respond({}, 500)))).toBe('unavailable')
  })

  it('reconoce las claves de prueba oficiales', () => {
    for (const key of [
      '1x00000000000000000000AA',
      '2x00000000000000000000AB',
      '3x00000000000000000000FF',
      '1x0000000000000000000000000000000AA',
      '2x0000000000000000000000000000000AA',
    ]) {
      expect(TURNSTILE_TEST_KEY.test(key), key).toBe(true)
    }
    expect(TURNSTILE_TEST_KEY.test('0x4AAAAAAABkMYinukE8nzYS')).toBe(false)
  })
})

describe('formulario de contacto', () => {
  const valid = {
    topic: 'socios',
    name: '  Ana Pérez ',
    email: 'Ana.Perez@Correo.CL',
    phone: '9 8765 4321',
    message: 'Quiero hacerme socia.',
    privacy: 'on',
  }

  it('normaliza el correo y el celular', () => {
    const parsed = contactFormSchema.parse(valid)
    expect(parsed).toMatchObject({ name: 'Ana Pérez', email: 'ana.perez@correo.cl', phone: '+56987654321' })
  })

  it('el consentimiento de privacidad es obligatorio (sin marcar no se envía)', () => {
    const { privacy: _privacy, ...unchecked } = valid
    const result = contactFormSchema.safeParse(unchecked)
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(['privacy'])
  })

  it('rechaza un tema que no existe y un correo inválido', () => {
    const result = contactFormSchema.safeParse({ ...valid, topic: 'apuestas', email: 'ana@' })
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual(['email', 'topic'])
  })
})
