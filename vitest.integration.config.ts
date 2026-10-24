import { tmpdir } from 'node:os'
import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { testDb } from './tests/integration/db-urls.ts'
import { alias } from './vitest.config.ts'

// Pruebas de integración: PostgreSQL 18 real (compose.dev.yaml en local, servicio en CI).
export default defineConfig({
  resolve: { alias },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/next-mocks.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      SITE_ENV: 'development',
      SITE_URL: 'http://localhost:3000',
      DATABASE_URL: testDb.appUrl,
      BETTER_AUTH_SECRET: 'secreto-solo-para-pruebas-de-integracion-0123456789',
      CRON_SECRET: 'secreto-de-tareas-solo-para-pruebas-0123456789',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      MAIL_FROM: 'Pruebas <pruebas@cachorros.test>',
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
      IP_HASH_SALT: 'sal-solo-para-pruebas-de-integracion-0123456789',
      LOG_LEVEL: 'silent',
      // Página de Facebook ficticia: las pruebas inyectan su propio `fetch`. Si algo llamara a la Graph API
      // sin simularla, esta dirección falla al instante: nunca se llega a Facebook.
      FACEBOOK_PAGE_ID: '1234567890',
      FACEBOOK_PAGE_TOKEN: 'token-de-pagina-solo-para-pruebas-0123456789',
      FACEBOOK_ALLOW_NON_PRODUCTION: 'true',
      FACEBOOK_GRAPH_URL: 'http://127.0.0.1:9',
      // Las subidas de las pruebas no se mezclan con las de desarrollo.
      UPLOADS_DIR: path.join(tmpdir(), 'cachorros-test-uploads'),
      // Dentro del proyecto (en .gitignore) para poder revisar las tarjetas generadas.
      SHARE_CACHE_DIR: path.resolve(import.meta.dirname, 'data/cache/test-share'),
    },
  },
})
