// Graph API de Meta simulada para las e2e (nunca se llama a Facebook real). Sin dependencias: node:http.
// Responde como la Graph API a lo que usa el sitio y registra cada petición:
//   POST /<versión>/<página>/photos  → { id, post_id }
//   GET  /<versión>/<página>         → { id, name }
//   GET  /__peticiones               → lo recibido (con el texto y si vino la imagen)
//   GET  /__salud                    → 200 (Playwright espera esto para arrancar)
import { createServer } from 'node:http'

const port = Number(process.env.GRAPH_MOCK_PORT ?? 3190)
const received = []
let posts = 0

/** Lee un campo de texto y si vino el archivo `source` de un cuerpo multipart (lo justo para las pruebas). */
function parseMultipart(body, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType ?? '')
  if (!boundary) return {}
  const fields = {}
  for (const part of body.split(`--${boundary[1] ?? boundary[2]}`)) {
    const name = /name="([^"]+)"/.exec(part)?.[1]
    if (!name) continue
    const value = part.slice(part.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '')
    fields[name] = /filename="/.test(part)
      ? { filename: /filename="([^"]*)"/.exec(part)?.[1], bytes: value.length }
      : value
  }
  return fields
}

const server = createServer((request, response) => {
  const chunks = []
  request.on('data', (chunk) => chunks.push(chunk))
  request.on('end', () => {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`)
    const json = (status, value) => {
      response.writeHead(status, { 'content-type': 'application/json' })
      response.end(JSON.stringify(value))
    }
    if (url.pathname === '/__salud') return json(200, { ok: true })
    if (url.pathname === '/__peticiones') return json(200, received)

    const [, version, pageId, edge] = url.pathname.split('/')
    if (request.method === 'POST' && edge === 'photos') {
      const fields = parseMultipart(Buffer.concat(chunks).toString('latin1'), request.headers['content-type'])
      // multipart envía los saltos de línea como CRLF.
      const caption = Buffer.from(String(fields.caption ?? ''), 'latin1')
        .toString('utf8')
        .replace(/\r\n/g, '\n')
      received.push({
        method: 'POST',
        path: url.pathname,
        version,
        caption,
        source: fields.source ?? null,
        tokenInUrl: url.searchParams.has('access_token'),
        hasToken: typeof fields.access_token === 'string' && fields.access_token.length > 0,
      })
      posts++
      return json(200, { id: String(9000 + posts), post_id: `${pageId}_${9000 + posts}` })
    }
    if (request.method === 'GET' && pageId && !edge) {
      received.push({ method: 'GET', path: url.pathname, version })
      return json(200, { id: pageId, name: 'Página E2E de Los Cachorros' })
    }
    return json(404, { error: { message: 'Ruta no simulada', code: 100 } })
  })
})

server.listen(port, 'localhost')
