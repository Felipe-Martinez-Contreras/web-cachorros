import 'server-only'
import type { BetterAuthOptions } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { env } from '@/lib/env'
import { logger, maskEmail } from '@/lib/logger'
import { sendMail } from '@/lib/mail'
import { MIN_PASSWORD_LENGTH } from './constants'

const RESET_TOKEN_TTL_SECONDS = 60 * 60 // el enlace vale 1 hora
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 días, con renovación deslizante

/**
 * Opciones de Better Auth sin la base de datos (especificación 2.5 y 9.1). No importa nada de Next:
 * también las usan los scripts de consola (`admin:create`).
 */
export function buildAuthOptions() {
  return {
    appName: 'Club Deportivo Los Cachorros',
    // Se leen en runtime: cambiar de dominio no exige reconstruir la imagen.
    baseURL: env.SITE_URL,
    trustedOrigins: [env.SITE_URL],
    secret: env.BETTER_AUTH_SECRET,
    // Los avisos de Better Auth salen por pino (JSON), sin los argumentos: pueden traer datos personales.
    logger: {
      level: 'warn',
      log: (level, message) => logger[level](`better-auth: ${message}`),
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true, // sin registro público: los administradores se crean por consola
      minPasswordLength: MIN_PASSWORD_LENGTH,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        const url = `${env.SITE_URL}/admin/restablecer?token=${encodeURIComponent(token)}`
        // No se espera el envío: la respuesta no se bloquea ni revela si el correo existe.
        void sendMail({
          to: user.email,
          subject: 'Restablece tu contraseña · Club Deportivo Los Cachorros',
          text: [
            `Hola${user.name ? ` ${user.name}` : ''}:`,
            '',
            'Recibimos una solicitud para restablecer tu contraseña del panel del club.',
            'Abre este enlace para crear una nueva (vale por 1 hora):',
            '',
            url,
            '',
            'Si no fuiste tú, ignora este correo: tu contraseña no cambia.',
          ].join('\n'),
        }).catch((error: unknown) => {
          logger.error(
            { err: error, to: maskEmail(user.email) },
            'no se pudo enviar el correo de recuperación',
          )
        })
      },
    },
    session: {
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      // En desarrollo se desactiva para no entorpecer las pruebas locales y e2e.
      enabled: env.SITE_ENV !== 'development',
      storage: 'database',
    },
    advanced: {
      // Solo Cloudflare llega al origen (firewall + AOP), así que su cabecera es confiable.
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    },
    plugins: [admin({ adminRoles: ['admin'] })],
  } satisfies BetterAuthOptions
}
