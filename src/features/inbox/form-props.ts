import 'server-only'
import { env } from '@/lib/env'
import { issueStamp } from '@/lib/forms/honeypot'
import { getPublicForm } from './forms'

/**
 * Lo que necesita `<PublicForm>` desde el servidor: la clave pública de Turnstile (en runtime, nunca
 * `NEXT_PUBLIC_*`) y el momento firmado en que se dibujó. Llamar después de `connection()`: es por petición.
 */
export function publicFormProps(name: string) {
  const form = getPublicForm(name)
  if (!form) throw new Error(`Formulario público desconocido: ${name}`)
  return {
    form: name,
    siteKey: env.TURNSTILE_SITE_KEY,
    turnstileAction: form.turnstileAction,
    stamp: issueStamp(env.BETTER_AUTH_SECRET),
  }
}
