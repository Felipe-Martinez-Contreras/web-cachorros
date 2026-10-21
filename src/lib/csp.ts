// Content Security Policy (especificación 9.3). Lógica pura y sin alias de rutas: la importa también
// `next.config.ts`. Obligatoria desde la Fase 5 (en la 4 fue Report-Only); las violaciones se siguen
// reportando a /api/csp-report. `upgrade-insecure-requests` lo agrega Caddy en la VM: aquí rompería las
// pruebas y el desarrollo, que corren en http://localhost.

export const CSP_HEADER = 'Content-Security-Policy'

/** `next dev` evalúa código para recargar en caliente: solo en desarrollo se permite `eval`. */
const DEV_SCRIPT = ["'unsafe-eval'"]
export const CSP_REPORT_PATH = '/api/csp-report'

type Directives = Record<string, readonly string[]>

function serialize(directives: Directives): string {
  return Object.entries(directives)
    .map(([name, values]) => (values.length > 0 ? `${name} ${values.join(' ')}` : name))
    .join('; ')
}

/**
 * Sitio público: fija (sale del build en `next.config`) y compatible con la caché del HTML, por eso con
 * `'unsafe-inline'` y sin nonce (justificación en 9.3: no hay HTML de usuarios y React escapa todo).
 * - Turnstile: script y frame de challenges.cloudflare.com.
 * - Cloudflare Web Analytics: script y envío de datos.
 * - Fachadas: miniaturas de YouTube, y los iframes de youtube-nocookie, OpenStreetMap y los embeds del
 *   feed («Ver aquí» de Instagram y Facebook), que solo se crean después del clic.
 */
export const PUBLIC_CSP_DIRECTIVES: Directives = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com',
    'https://static.cloudflareinsights.com',
  ],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
  'font-src': ["'self'"],
  'connect-src': ["'self'", 'https://cloudflareinsights.com'],
  'frame-src': [
    'https://challenges.cloudflare.com',
    'https://www.youtube-nocookie.com',
    'https://www.openstreetmap.org',
    'https://www.facebook.com',
    'https://www.instagram.com',
  ],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'report-uri': [CSP_REPORT_PATH],
}

export function publicCsp({ dev = false }: { dev?: boolean } = {}): string {
  if (!dev) return serialize(PUBLIC_CSP_DIRECTIVES)
  const scripts = PUBLIC_CSP_DIRECTIVES['script-src'] ?? []
  return serialize({ ...PUBLIC_CSP_DIRECTIVES, 'script-src': [...scripts, ...DEV_SCRIPT] })
}

/**
 * Panel: estricta, con un nonce por petición desde `proxy.ts` (el panel ya es 100 % dinámico). Next lee
 * el nonce de esta misma cabecera en la petición y lo pone en sus scripts. `'strict-dynamic'` deja cargar
 * los fragmentos que esos scripts piden (el editor y el visor de PDF se cargan con `import()`).
 */
export function adminCsp(nonce: string, { dev = false }: { dev?: boolean } = {}): string {
  return serialize({
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? DEV_SCRIPT : [])],
    // React escribe estilos en línea (`style=`) y el CSS va dentro del HTML (`inlineCss`).
    'style-src': ["'self'", "'unsafe-inline'"],
    // `blob:`: vista previa de una foto antes de subirla.
    'img-src': ["'self'", 'data:', 'blob:', 'https://i.ytimg.com'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    // Vista previa de videos en el editor de noticias (detrás de la misma fachada que el sitio).
    'frame-src': ['https://www.youtube-nocookie.com'],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'report-uri': [CSP_REPORT_PATH],
  })
}

/** Nonce de 128 bits en base64 (uno por petición). */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

export type CspViolation = {
  directive: string
  /** Solo el origen de lo bloqueado (o `inline` / `eval`): nunca la dirección completa con su query. */
  blocked: string
  /** Solo la ruta de la página, sin query (podría llevar datos de un formulario). */
  page: string
  disposition: string
}

const MAX_REPORTS = 20

/**
 * Resume un reporte de CSP sin datos personales. Acepta el formato clásico (`report-uri`,
 * `{ "csp-report": {…} }`) y el de la Reporting API (`[{ type: 'csp-violation', body: {…} }]`).
 * `null` si no parece un reporte.
 */
export function summarizeCspReports(payload: unknown): CspViolation[] | null {
  const bodies: Record<string, unknown>[] = []
  if (isRecord(payload) && isRecord(payload['csp-report'])) bodies.push(payload['csp-report'])
  else if (Array.isArray(payload)) {
    for (const item of payload.slice(0, MAX_REPORTS)) {
      if (isRecord(item) && item.type === 'csp-violation' && isRecord(item.body)) bodies.push(item.body)
    }
  }
  if (bodies.length === 0) return null
  return bodies.map((body) => ({
    directive: text(body['effective-directive'] ?? body.effectiveDirective ?? body['violated-directive']),
    blocked: blockedOrigin(text(body['blocked-uri'] ?? body.blockedURL)),
    page: pagePath(text(body['document-uri'] ?? body.documentURL)),
    disposition: text(body.disposition) || 'report',
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 200) : ''
}

function blockedOrigin(value: string): string {
  if (value === '' || value === 'inline' || value === 'eval' || value === 'data' || value === 'blob') {
    return value || 'desconocido'
  }
  try {
    return new URL(value).origin
  } catch {
    return 'desconocido'
  }
}

function pagePath(value: string): string {
  try {
    return new URL(value).pathname
  } catch {
    return 'desconocida'
  }
}
