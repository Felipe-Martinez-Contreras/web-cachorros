import { createEnv } from '@t3-oss/env-nextjs'
import * as z from 'zod'
import { TURNSTILE_TEST_KEY } from '@/lib/forms/turnstile'

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

    // Protege las tareas programadas (`/api/cron/*`). Sin ella, esas rutas responden 503.
    CRON_SECRET: z.string().min(32, { error: 'Debe tener al menos 32 caracteres.' }).optional(),

    SMTP_HOST: requerida('En desarrollo usa localhost (Mailpit).'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: requerida('Ejemplo: "Club Deportivo Los Cachorros <no-responder@dominio>".'),

    // Anti-spam de los formularios públicos (especificación 9.4). En desarrollo y CI, las claves de prueba.
    TURNSTILE_SITE_KEY: requerida('En desarrollo usa la clave de prueba de .env.example.'),
    TURNSTILE_SECRET_KEY: requerida('En desarrollo usa la clave de prueba de .env.example.'),
    // La IP de quien envía un formulario solo se guarda como HMAC con esta sal (especificación 9.4).
    IP_HASH_SALT: requerida('Genera una con el comando del README (hex de 32 bytes).').pipe(
      z.string().min(32, { error: 'Debe tener al menos 32 caracteres.' }),
    ),

    // Carpeta de las imágenes procesadas. En la VM es el volumen /data/uploads, que Caddy sirve en /media.
    UPLOADS_DIR: z.string().default('./data/uploads'),
    // Caché en disco de las tarjetas para redes (especificación 2.8). En la VM es /data/cache/share.
    SHARE_CACHE_DIR: z.string().default('./data/cache/share'),
    // Tope por archivo subido; Caddy corta en 15 MB como red de seguridad (especificación 9.5).
    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(50).default(12),
    // Intervalo base del polling en vivo, en ms. Solo vale con SITE_ENV=development (e2e más rápidas);
    // en staging y producción siempre es el de la especificación (20 s).
    LIVE_POLL_MS: z.coerce.number().int().min(500).max(60_000).optional(),
  },
  experimental__runtimeEnv: {},
  // Las claves de prueba de Turnstile dejan pasar a cualquiera: producción no arranca con ellas.
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((values, context) => {
      if (values.SITE_ENV !== 'production') return
      for (const key of ['TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'] as const) {
        if (TURNSTILE_TEST_KEY.test(values[key])) {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'Es una clave de prueba de Turnstile: en producción usa la del widget real.',
          })
        }
      }
    }),
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
