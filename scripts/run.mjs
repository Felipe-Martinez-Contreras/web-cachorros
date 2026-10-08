// Ejecuta un script de consola en desarrollo: `node scripts/run.mjs <nombre> [argumentos]`.
// Lo empaqueta con esbuild (la misma herramienta que usa la imagen) y lo corre con las variables de .env.
// Funciona igual en PowerShell, cmd y bash.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { bundleScripts, DEV_SCRIPT_NAMES, root, SCRIPT_NAMES } from './lib/bundle.mjs'

const [name, ...args] = process.argv.slice(2)
const known = [...SCRIPT_NAMES, ...DEV_SCRIPT_NAMES]

if (!name || !known.includes(name)) {
  console.error(`Uso: node scripts/run.mjs <${known.join(' | ')}> [argumentos]`)
  process.exit(1)
}

const outdir = path.join(root, '.cache', 'scripts')
await bundleScripts([name], { outdir, standalone: false })

const result = spawnSync(
  process.execPath,
  ['--env-file-if-exists=.env', '--enable-source-maps', path.join(outdir, `${name}.mjs`), ...args],
  { cwd: root, stdio: 'inherit' },
)
process.exit(result.status ?? 1)
