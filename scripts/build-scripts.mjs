// `pnpm build:scripts`: deja en dist/scripts los .mjs autocontenidos que usa la imagen Docker
// (`node scripts/migrate.mjs`, `node scripts/create-admin.mjs`).
import path from 'node:path'
import { bundleScripts, root, SCRIPT_NAMES } from './lib/bundle.mjs'

await bundleScripts(SCRIPT_NAMES, { outdir: path.join(root, 'dist', 'scripts'), standalone: true })
console.log(`Scripts empaquetados en dist/scripts: ${SCRIPT_NAMES.join(', ')}`)
