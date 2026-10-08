import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Scripts de consola que se empaquetan para la imagen (especificación 12.2). */
export const SCRIPT_NAMES = ['migrate', 'create-admin']
/** Scripts que solo existen en desarrollo. */
export const DEV_SCRIPT_NAMES = ['db-reset']

/**
 * Empaqueta `scripts/<name>.ts` en un `.mjs`.
 * - `standalone: true` (imagen): incluye todas las dependencias; el archivo se ejecuta solo con Node.
 * - `standalone: false` (desarrollo): deja los paquetes fuera y los resuelve desde `node_modules`.
 */
export async function bundleScripts(names, { outdir, standalone }) {
  await build({
    absWorkingDir: root,
    entryPoints: names.map((name) => `scripts/${name}.ts`),
    outdir,
    outExtension: { '.js': '.mjs' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    sourcemap: standalone ? false : 'inline',
    logLevel: 'warning',
    tsconfig: 'tsconfig.json',
    alias: { 'server-only': './scripts/lib/server-only-stub.mjs' },
    ...(standalone
      ? {
          // Los módulos nativos no se pueden empaquetar: se resuelven desde el node_modules del standalone.
          external: ['sharp'],
          // Algunas dependencias CommonJS usan require() dinámico, que no existe en ESM.
          banner: {
            js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
          },
        }
      : { packages: 'external' }),
  })
}

export { root }
