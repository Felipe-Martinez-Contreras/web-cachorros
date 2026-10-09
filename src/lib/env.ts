import { createEnv } from '@t3-oss/env-nextjs'
import * as z from 'zod'

/**
 * Variables de entorno (especificación 3.7). Solo de servidor: `NEXT_PUBLIC_*` está prohibido.
 *
 * La validación se omite únicamente mientras se compila (`next build` o la etapa de build de Docker con
 * `SKIP_ENV_VALIDATION=1`): la imagen no depende del entorno. Al arrancar, `instrumentation.ts` importa
 * este módulo y la app falla con un mensaje claro si falta algo.
 */
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === '1' || process.env.NEXT_PHASE === 'phase-production-build'

const requerida = (ayuda: string) => z.string({ error: `Falta definirla. ${ayuda}` }).min(1)

export const env = createEnv({
  server: {
    SITE_ENV: z.enum(['development', 'staging', 'production'], {
      error: 'Debe ser development, staging o production.',
    }),
    SITE_URL: z.url({
      error: 'Debe ser la URL pública del sitio, por ejemplo http://localhost:3000.',
    }),
    APP_VERSION: z.string().default('dev'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: requerida('Es la conexión de la app a PostgreSQL (rol restringido cachorros_app).').pipe(
      z.url({ protocol: /^postgres(ql)?$/, error: 'Debe empezar con postgres://' }),
    ),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),

    BETTER_AUTH_SECRET: requerida('Genera una con el comando del README.').pipe(
      z.string().min(32, { error: 'Debe tener al menos 32 caracteres.' }),
    ),

    SMTP_HOST: requerida('En desarrollo usa localhost (Mailpit).'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: requerida('Ejemplo: "Club Deportivo Los Cachorros <no-responder@dominio>".'),

    // Carpeta de las imágenes procesadas. En la VM es el volumen /data/uploads, que Caddy sirve en /media.
    UPLOADS_DIR: z.string().default('./data/uploads'),
    // Tope por archivo subido; Caddy corta en 15 MB como red de seguridad (especificación 9.5).
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(12),
  },
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  skipValidation,
  onValidationError: (issues) => {
    const detalle = issues
      .map((issue) => {
        const nombre = (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.')
        return `  - ${nombre || '(desconocida)'}: ${issue.message}`
      })
      .join('\n')
    throw new Error(
      `La configuración no es válida. Revisa estas variables de entorno (archivo .env):\n${detalle}\n` +
        'Puedes guiarte por .env.example.',
    )
  },
})
