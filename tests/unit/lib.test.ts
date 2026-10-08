import { describe, expect, it } from 'vitest'
import { loginSchema, resetPasswordSchema } from '@/features/auth/schemas'
import { fail, ok } from '@/lib/action-result'
import { authErrorMessage } from '@/lib/auth/errors'
import { maskEmail } from '@/lib/logger'

describe('ActionResult', () => {
  it('ok envuelve el dato', () => {
    expect(ok({ id: 1 })).toEqual({ ok: true, data: { id: 1 } })
  })

  it('fail con texto devuelve el mensaje', () => {
    expect(fail('No se pudo')).toEqual({ ok: false, message: 'No se pudo' })
  })

  it('fail con un error de Zod devuelve los errores por campo, en español', () => {
    const parsed = loginSchema.safeParse({ email: 'no-es-correo', password: '' })
    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(fail(parsed.error)).toEqual({
      ok: false,
      message: 'Revisa los campos marcados.',
      fieldErrors: { email: ['Escribe un correo válido.'], password: ['Escribe tu contraseña.'] },
    })
  })
})

describe('esquemas de autenticación', () => {
  it('normaliza el correo', () => {
    expect(loginSchema.parse({ email: '  Admin@Cachorros.CL ', password: 'x' }).email).toBe(
      'admin@cachorros.cl',
    )
  })

  it('exige 12 caracteres y que las contraseñas coincidan', () => {
    const corta = resetPasswordSchema.safeParse({ password: 'once-letras', confirm: 'once-letras' })
    expect(corta.success).toBe(false)
    const distinta = resetPasswordSchema.safeParse({ password: 'doce-letras!', confirm: 'otra-cosa-12' })
    expect(distinta.success).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'doce-letras!', confirm: 'doce-letras!' }).success).toBe(
      true,
    )
  })
})

describe('authErrorMessage', () => {
  it('traduce los códigos conocidos', () => {
    expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD', status: 401 })).toBe(
      'El correo o la contraseña no son correctos.',
    )
  })

  it('avisa cuando hay demasiados intentos', () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/)
  })

  it('nunca muestra mensajes en inglés: lo desconocido cae en un texto genérico', () => {
    expect(authErrorMessage({ code: 'ALGO_NUEVO', message: 'Something went wrong' })).toMatch(/^No pudimos/)
    expect(authErrorMessage(null)).toMatch(/^No pudimos/)
  })
})

describe('maskEmail', () => {
  it('oculta la parte local del correo', () => {
    expect(maskEmail('felipe@correo.cl')).toBe('f***@correo.cl')
    expect(maskEmail('sin-arroba')).toBe('***')
  })
})
