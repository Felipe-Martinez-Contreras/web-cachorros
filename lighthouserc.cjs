// Lighthouse móvil local (especificación 14, Fase 1): `pnpm build` y luego `pnpm lighthouse`.
// Necesita la base con el seed cargado. El presupuesto en CI se agrega en la Fase 5.
const { chromium } = require('@playwright/test')

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'node scripts/start.mjs',
      startServerReadyPattern: 'Ready',
      url: ['http://localhost:3000/'],
      // Varias corridas: el puntaje de rendimiento varía con la carga de la máquina.
      numberOfRuns: 5,
      // Usa el Chromium que ya instala Playwright: no hace falta tener Chrome en la máquina.
      chromePath: process.env.CHROME_PATH || chromium.executablePath(),
      settings: {
        chromeFlags: '--headless=new --no-sandbox',
        // Red 4G lenta y CPU ×4 aplicadas de verdad durante la carga. En localhost la simulación por
        // defecto («simulate») no sirve: todo llega en milisegundos, los scripts se ejecutan antes del primer
        // pintado y el LCP estimado sale mucho peor que con una red real.
        throttlingMethod: process.env.LH_THROTTLING || 'devtools',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reportes' },
  },
}
