import { after } from 'next/server'
import { getPublicForm } from '@/features/inbox/forms'
import { notifySubmission } from '@/features/inbox/notify'
import { getPrivacyPolicyVersion } from '@/features/inbox/privacy'
import { env } from '@/lib/env'
import { clientIp, hashIp } from '@/lib/forms/client-ip'
import { HONEYPOT_FIELD, STAMP_FIELD, TURNSTILE_FIELD } from '@/lib/forms/fields'
import { checkStamp, isHoneypotFilled } from '@/lib/forms/honeypot'
import { FORM_ERRORS, type FormErrorCode, type FormResponse } from '@/lib/forms/messages'
import { isSameOrigin } from '@/lib/forms/origin'
import { formRateLimiter } from '@/lib/forms/rate-limit'
import { verifyTurnstile } from '@/lib/forms/turnstile'
import { logger } from '@/lib/logger'

/** Un formulario de texto nunca se acerca a esto; lo demás no se lee. */
const MAX_BODY_BYTES = 64 * 1024

type Context = { params: Promise<{ form: string }> }

/**
 * Envío de los formularios públicos (especificación 9.4). Es un Route Handler y no una Server Action para
 * poder responder un 429 real y funcionar sin JavaScript. Con JavaScript, el formulario pide JSON; sin él,
 * el navegador envía el formulario nativo y recibe una redirección 303 de vuelta a la página (PRG).
 *
 * Orden: origen → límite por IP → campo trampa y tiempo mínimo → Turnstile → validación y guardado.
 */
export async function POST(request: Request, { params }: Context) {
  const form = getPublicForm((await params).form)
  if (!form) return Response.json({ ok: false, message: 'Formulario desconocido.' }, { status: 404 })

  const wantsJson = (request.headers.get('accept') ?? '').includes('application/json')
  const back = (query: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `${form.path}?${query}#formulario`, 'Cache-Control': 'no-store' },
    })
  const reject = (
    status: number,
    code: FormErrorCode,
    extra: { fieldErrors?: Record<string, string[]>; headers?: HeadersInit } = {},
  ) => {
    if (!wantsJson) return back(`error=${code}`)
    const body: FormResponse = { ok: false, code, message: FORM_ERRORS[code], fieldErrors: extra.fieldErrors }
    return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...extra.headers } })
  }

  // CSRF: lo que verifican de serie las Server Actions.
  if (!isSameOrigin(request.headers, env.SITE_URL)) return reject(403, 'origen')

  const ip = clientIp(request.headers, env.SITE_ENV)
  const limit = formRateLimiter.take(`${form.kind}:${ip}`)
  if (!limit.allowed) {
    return reject(429, 'limite', { headers: { 'Retry-After': String(limit.retryAfterSeconds) } })
  }

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return reject(413, 'rechazado')
  let data: FormData
  try {
    data = await request.formData()
  } catch {
    return reject(400, 'rechazado')
  }

  const log = logger.child({ form: form.kind })
  if (isHoneypotFilled(data.get(HONEYPOT_FIELD))) {
    log.info('formulario: campo trampa lleno, se rechaza')
    return reject(400, 'rechazado')
  }
  const stamp = checkStamp(String(data.get(STAMP_FIELD) ?? ''), env.BETTER_AUTH_SECRET)
  if (stamp === 'too-fast') return reject(400, 'rapido')
  if (stamp === 'expired') return reject(400, 'expirado')
  if (stamp === 'invalid') return reject(400, 'rechazado')

  const token = data.get(TURNSTILE_FIELD)
  const turnstile = await verifyTurnstile(
    typeof token === 'string' && token !== '' ? token : null,
    { action: form.turnstileAction, remoteIp: ip === 'desconocida' ? undefined : ip },
    { secret: env.TURNSTILE_SECRET_KEY, hostname: new URL(env.SITE_URL).hostname },
  )
  if (turnstile === 'missing') return reject(400, 'sin-verificacion')
  if (turnstile === 'unavailable') return reject(503, 'verificacion-caida')
  if (turnstile === 'rejected') {
    log.info('formulario: Turnstile rechazó el token')
    return reject(400, 'rechazado')
  }

  const values: Record<string, unknown> = {}
  for (const [key, value] of data) if (typeof value === 'string') values[key] = value

  try {
    const result = await form.save(values, {
      ipHash: hashIp(ip, env.IP_HASH_SALT),
      policyVersion: await getPrivacyPolicyVersion(),
      now: new Date(),
    })
    if (!result.ok) return reject(400, 'campos', { fieldErrors: result.fieldErrors })
    after(() => notifySubmission(form.kind, result.id))
  } catch (error) {
    log.error({ err: error }, 'formulario: no se pudo guardar el envío')
    return reject(500, 'servidor')
  }

  if (!wantsJson) return back('enviado=1')
  const body: FormResponse = { ok: true }
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
