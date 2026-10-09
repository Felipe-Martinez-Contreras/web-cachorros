/** Errores de Better Auth mapeados a español de Chile (especificación 3.9). */
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'El correo o la contraseña no son correctos.',
  INVALID_EMAIL: 'El correo no es válido.',
  INVALID_PASSWORD: 'La contraseña no es correcta.',
  USER_NOT_FOUND: 'El correo o la contraseña no son correctos.',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'El correo o la contraseña no son correctos.',
  BANNED_USER: 'Tu cuenta está desactivada. Habla con la directiva del club.',
  PASSWORD_TOO_SHORT: 'La contraseña debe tener al menos 12 caracteres.',
  PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
  INVALID_TOKEN: 'El enlace ya no es válido o venció. Pide uno nuevo.',
  SESSION_EXPIRED: 'Tu sesión venció. Vuelve a entrar.',
  EMAIL_AND_PASSWORD_SIGN_UP_IS_NOT_ENABLED: 'El registro no está disponible.',
  // Verificación en dos pasos
  INVALID_CODE: 'Ese código no es correcto. Revisa la app y vuelve a intentarlo.',
  INVALID_BACKUP_CODE: 'Ese código de respaldo no es válido o ya se usó.',
  INVALID_TWO_FACTOR_COOKIE: 'Pasó mucho tiempo. Vuelve a escribir tu correo y tu contraseña.',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Demasiados intentos. Vuelve a escribir tu correo y tu contraseña.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Demasiados intentos fallidos. Espera unos minutos y vuelve a intentarlo.',
  TOTP_NOT_ENABLED: 'La verificación en dos pasos no está activada en esta cuenta.',
  TWO_FACTOR_NOT_ENABLED: 'La verificación en dos pasos no está activada en esta cuenta.',
  TOTP_ALREADY_ENABLED: 'La verificación en dos pasos ya está activada.',
}

const FALLBACK = 'No pudimos completar la acción. Inténtalo de nuevo en unos segundos.'
const TOO_MANY = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'

export type AuthClientError = { code?: string; status?: number; message?: string } | null | undefined

export function authErrorMessage(error: AuthClientError): string {
  if (!error) return FALLBACK
  if (error.status === 429) return TOO_MANY
  return (error.code && MESSAGES[error.code]) || FALLBACK
}
