/**
 * Resultado de un envío público. El mismo código sirve para la respuesta JSON (con JavaScript) y para la
 * redirección sin JavaScript (`?error=<código>`), así ambos caminos muestran el mismo texto.
 */
export const FORM_ERRORS = {
  origen: 'No pudimos recibir el formulario. Recarga la página e inténtalo de nuevo.',
  limite: 'Recibimos varios envíos seguidos desde tu conexión. Espera unos minutos y vuelve a intentarlo.',
  rapido: 'Lo enviaste muy rápido. Revisa los datos y vuelve a enviarlo.',
  expirado: 'El formulario estuvo abierto mucho tiempo. Recarga la página y vuelve a enviarlo.',
  rechazado: 'No pudimos enviar el formulario. Si el problema sigue, escríbenos por WhatsApp o correo.',
  'sin-verificacion':
    'Para enviar el formulario necesitamos verificar que no eres un robot, y eso requiere JavaScript. ' +
    'Actívalo y vuelve a intentarlo, o escríbenos por WhatsApp o correo.',
  'verificacion-caida': 'No pudimos verificar el envío en este momento. Inténtalo de nuevo en unos minutos.',
  campos: 'Revisa los campos marcados.',
  servidor: 'Algo salió mal al guardar tu envío. Inténtalo de nuevo en unos minutos.',
} as const

export type FormErrorCode = keyof typeof FORM_ERRORS

export type FormResponse =
  | { ok: true }
  | { ok: false; code: FormErrorCode; message: string; fieldErrors?: Record<string, string[]> }

export function isFormErrorCode(value: unknown): value is FormErrorCode {
  return typeof value === 'string' && Object.hasOwn(FORM_ERRORS, value)
}

/** Códigos que conviene acompañar con los canales directos (WhatsApp, correo). */
export const SHOW_DIRECT_CHANNELS: ReadonlySet<FormErrorCode> = new Set([
  'rechazado',
  'sin-verificacion',
  'verificacion-caida',
  'servidor',
])
