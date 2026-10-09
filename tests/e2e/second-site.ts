// Segunda instancia de la misma build para las pruebas de SEO: otro origen y `SITE_ENV=production`.
const port = Number(process.env.E2E_SECOND_PORT ?? 3101)

export const SECOND_SITE = { port, hostname: '127.0.0.1', url: `http://127.0.0.1:${port}` }
