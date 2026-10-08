// Después de `next build`: copia los estáticos dentro del output standalone para poder arrancarlo
// en local con `pnpm start` (en la imagen Docker lo hace el Dockerfile).
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const standalone = path.join(root, '.next', 'standalone')

if (!existsSync(standalone)) {
  console.error('No existe .next/standalone: revisa que next.config.ts tenga output: "standalone".')
  process.exit(1)
}

cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true })
if (existsSync(path.join(root, 'public'))) {
  cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })
}
