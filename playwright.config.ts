import { defineConfig, devices } from '@playwright/test'

// Puerto propio, distinto del de `pnpm dev` (3000): las pruebas nunca corren contra otro servidor.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${PORT}`

/**
 * E2E contra el build de producción (`pnpm build` antes de `pnpm test:e2e`).
 * Necesita PostgreSQL y Mailpit arriba (compose.dev.yaml) y las migraciones aplicadas.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // Las capturas del reporte de fase no son pruebas: solo corren con la variable CAPTURAS.
  testIgnore: process.env.CAPTURAS ? [] : ['**/capturas.spec.ts'],
  globalSetup: './tests/e2e/global-setup.ts',
  // Las pruebas comparten usuarios y la bandeja de Mailpit: van en serie.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'celular',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, hasTouch: true },
    },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'pnpm start',
    url: `${baseURL}/api/health`,
    // Siempre levanta el build recién compilado; si el puerto está ocupado, falla en vez de reutilizarlo.
    reuseExistingServer: false,
    timeout: 60_000,
    // SITE_URL debe coincidir con el puerto: Better Auth valida el origen y arma con ella los enlaces de correo.
    env: { PORT: String(PORT), HOSTNAME: 'localhost', SITE_URL: baseURL },
  },
})
