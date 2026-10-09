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
      LOG_LEVEL: 'silent',
      // Las subidas de las pruebas no se mezclan con las de desarrollo.
      UPLOADS_DIR: path.join(tmpdir(), 'cachorros-test-uploads'),
    },
  },
})
