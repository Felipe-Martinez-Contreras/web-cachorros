// `pnpm content:pending [--sin-bd]`: lista los marcadores [COMPLETAR], [DECIDIR] y [VERIFICAR] presentes en el
// código, el seed y la base de datos, y regenera docs/pendientes-contenido.md (especificación 0.3).
import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'
import { requireEnv } from './lib/migrate'
import { EXAMPLE_PHONE } from './seed/data'

const MARKER = /\[(COMPLETAR|DECIDIR|VERIFICAR)[^\]]*\]/g
const KINDS = ['COMPLETAR', 'DECIDIR', 'VERIFICAR'] as const
const OUTPUT = 'docs/pendientes-contenido.md'

const CODE_ROOTS = ['src', 'scripts', 'deploy', 'docker', 'compose.yaml', 'Dockerfile', '.env.example']
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mjs',
  '.css',
  '.sql',
  '.yaml',
  '.yml',
  '.sh',
  '.example',
  '',
])
// Tablas sin contenido editorial (cuentas, sesiones, auditoría).
const SKIPPED_TABLES = new Set(['user', 'session', 'account', 'verification', 'rate_limit', 'audit_log'])

type Finding = { marker: string; where: string }

async function walk(target: string): Promise<string[]> {
  if (!existsSync(target)) return []
  const entries = await readdir(target, { withFileTypes: true }).catch(() => null)
  if (!entries) return [target]
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.cache')) continue
    files.push(...(await walk(path.join(target, entry.name))))
  }
  return files
}

async function scanCode(): Promise<Finding[]> {
  const findings: Finding[] = []
  for (const root of CODE_ROOTS) {
    for (const file of await walk(root)) {
      if (!CODE_EXTENSIONS.has(path.extname(file))) continue
      const lines = (await readFile(file, 'utf8')).split('\n')
      lines.forEach((line, index) => {
        for (const match of line.matchAll(MARKER)) {
          findings.push({ marker: match[0], where: `${file.replaceAll('\\', '/')}:${index + 1}` })
        }
      })
    }
  }
  return findings
}

type DbScan = { findings: Finding[]; settings: string[] }

async function scanDatabase(): Promise<DbScan> {
  const sql = postgres(requireEnv('DATABASE_URL'), { max: 1, onnotice: () => {}, connect_timeout: 10 })
  try {
    const columns = await sql<{ table_name: string; column_name: string }[]>`
      select c.table_name, c.column_name
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
        and c.data_type in ('text', 'character varying', 'jsonb')
      order by c.table_name, c.ordinal_position`

    const findings: Finding[] = []
    for (const { table_name: table, column_name: column } of columns) {
      if (SKIPPED_TABLES.has(table)) continue
      const rows = await sql<{ value: string }[]>`
        select ${sql(column)}::text as value from ${sql(table)}
        where ${sql(column)}::text ~ '\\[(COMPLETAR|DECIDIR|VERIFICAR)'`
      for (const row of rows) {
        for (const match of row.value.matchAll(MARKER)) {
          findings.push({ marker: match[0], where: `${table}.${column}` })
        }
      }
    }

    // Configuración del club: campos vacíos o con el valor de ejemplo.
    const settings: string[] = []
    const [row] = await sql<Record<string, unknown>[]>`select * from site_settings where id = 1`
    if (!row) {
      settings.push('No existe la fila de configuración del club (¿faltó `pnpm db:migrate`?).')
    } else {
      const labels: Record<string, string> = {
        whatsapp_e164: 'WhatsApp del club',
        phone_e164: 'Teléfono del club',
        public_email: 'Correo público',
        notify_recipients: 'Destinatarios de las notificaciones de formularios',
        social_links: 'Redes sociales',
        address: 'Dirección',
        geo_lat: 'Coordenadas de la cancha',
        bank_details: 'Datos bancarios',
        donation_url: 'Link de pago (opcional)',
        featured_series_id: 'Serie destacada',
      }
      for (const [column, label] of Object.entries(labels)) {
        const value = row[column]
        if (value === null || value === undefined) settings.push(`${label}: sin completar.`)
        else if (value === EXAMPLE_PHONE)
          settings.push(`${label}: tiene el número de ejemplo ${EXAMPLE_PHONE}.`)
      }
    }
    return { findings, settings }
  } finally {
    await sql.end()
  }
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return counts
}

const kindOf = (marker: string) => KINDS.find((kind) => marker.startsWith(`[${kind}`)) ?? 'COMPLETAR'
const cell = (text: string) => text.replaceAll('|', '\\|')

function tableByMarker(findings: Finding[]): string[] {
  const byMarker = new Map<string, Map<string, number>>()
  for (const finding of findings) {
    const places = byMarker.get(finding.marker) ?? new Map<string, number>()
    places.set(finding.where, (places.get(finding.where) ?? 0) + 1)
    byMarker.set(finding.marker, places)
  }
  const lines = ['| Marcador | Dónde |', '|---|---|']
  for (const marker of [...byMarker.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
    const places = [...(byMarker.get(marker) ?? [])]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([where, times]) => `\`${where}\`${times > 1 ? ` (×${times})` : ''}`)
    lines.push(`| ${cell(marker)} | ${places.join(', ')} |`)
  }
  return lines
}

function render(code: Finding[], db: DbScan | null): string {
  const all = [...code, ...(db?.findings ?? [])]
  const totals = countBy(all, (finding) => kindOf(finding.marker))
  const lines = [
    '# Pendientes de contenido',
    '',
    '> Archivo generado por `pnpm content:pending`. No lo edites a mano: corrige el dato en el panel o en el',
    '> código y vuelve a generarlo.',
    '',
    'Marcadores que todavía están en el sitio (especificación, sección 0.3):',
    '',
    '| Marcador | Significado | Cantidad |',
    '|---|---|---|',
    `| \`[COMPLETAR: …]\` | Dato del club que aún no tenemos | ${totals.get('COMPLETAR') ?? 0} |`,
    `| \`[DECIDIR: …]\` | Decisión de producto pendiente (rige el default) | ${totals.get('DECIDIR') ?? 0} |`,
    `| \`[VERIFICAR: …]\` | Supuesto técnico o normativo por confirmar | ${totals.get('VERIFICAR') ?? 0} |`,
    '',
    '## En la base de datos',
    '',
  ]
  if (!db) {
    lines.push('No se revisó la base de datos (se generó con `--sin-bd`).')
  } else {
    lines.push('Es lo que ve el público hoy. Se corrige desde el panel.', '')
    lines.push(
      ...(db.findings.length > 0 ? tableByMarker(db.findings) : ['No hay marcadores en la base de datos.']),
    )
    lines.push('', '### Configuración del club', '')
    lines.push(
      ...(db.settings.length > 0
        ? db.settings.map((item) => `- ${item}`)
        : ['Todos los campos están completos.']),
    )
  }
  lines.push(
    '',
    '## En el código y en el seed',
    '',
    'Los del seed (`scripts/seed/`) son el origen de los datos de ejemplo de la base. El resto son supuestos',
    'y decisiones anotados junto al código que los aplica.',
    '',
    ...(code.length > 0 ? tableByMarker(code) : ['No hay marcadores en el código.']),
    '',
  )
  return lines.join('\n')
}

try {
  const withoutDb = process.argv.includes('--sin-bd')
  const code = await scanCode()
  let db: DbScan | null = null
  if (!withoutDb) {
    try {
      db = await scanDatabase()
    } catch (error) {
      throw new Error(
        'No se pudo revisar la base de datos. Levántala (docker compose -f compose.dev.yaml up -d) o usa ' +
          '`pnpm content:pending --sin-bd` para revisar solo el código.',
        { cause: error },
      )
    }
  }
  await writeFile(OUTPUT, render(code, db), 'utf8')

  const total = code.length + (db?.findings.length ?? 0)
  console.log(
    `${total} marcadores: ${code.length} en el código y el seed, ${db?.findings.length ?? 0} en la base de datos.`,
  )
  if (db && db.settings.length > 0) {
    console.log(`Configuración del club: ${db.settings.length} campos sin completar.`)
  }
  console.log(`Detalle en ${OUTPUT}`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
