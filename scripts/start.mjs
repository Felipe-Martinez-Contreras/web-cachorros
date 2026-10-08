// `pnpm start`: arranca en local el output standalone (lo mismo que corre la imagen Docker).
// El servidor standalone cambia su directorio de trabajo a `.next/standalone`, así que las rutas
// relativas de .env (UPLOADS_DIR, SHARE_CACHE_DIR) se resuelven antes contra la raíz del proyecto.
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const server = path.join(root, '.next', 'standalone', 'server.js')

if (!existsSync(server)) {
  console.error('No existe .next/standalone/server.js. Compila primero con: pnpm build')
  process.exit(1)
}

const envFile = path.join(root, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

const LOCAL_DIRS = { UPLOADS_DIR: './data/uploads', SHARE_CACHE_DIR: './data/cache/share' }
for (const [name, fallback] of Object.entries(LOCAL_DIRS)) {
  process.env[name] = path.resolve(root, process.env[name] || fallback)
}

await import(pathToFileURL(server).href)
