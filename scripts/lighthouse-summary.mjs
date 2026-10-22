// Resume en Markdown los informes que deja `pnpm lighthouse` en .lighthouseci/reportes, por página.
// Lo usa el CI para publicar los puntajes: `node scripts/lighthouse-summary.mjs`.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dir = '.lighthouseci/reportes'
const GOALS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 95 }

const reports = existsSync(dir)
  ? readdirSync(dir)
      .filter((file) => file.endsWith('.json') && file !== 'manifest.json')
      .map((file) => JSON.parse(readFileSync(path.join(dir, file), 'utf8')))
      .filter((report) => report.categories?.performance?.score != null)
      .sort((a, b) => a.fetchTime.localeCompare(b.fetchTime))
  : []

if (reports.length === 0) {
  console.log('## Lighthouse móvil\n\nNo hay informes: revisa el paso anterior.')
  process.exit(0)
}

const score = (report, id) => Math.round(report.categories[id].score * 100)
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const metric = (report, key) => report.audits.metrics.details.items[0][key]
const pathOf = (report) => new URL(report.requestedUrl).pathname

const pages = new Map()
for (const report of reports) {
  const key = pathOf(report)
  pages.set(key, [...(pages.get(key) ?? []), report])
}

const lines = [
  '## Lighthouse móvil',
  '',
  `${reports.length} corridas · red 4G lenta y CPU ×4 (${reports[0].configSettings.throttlingMethod}). ` +
    'Se juzga la mediana de cada página.',
  '',
  `| Página | ${Object.keys(GOALS)
    .map((id) => `${reports[0].categories[id].title} (meta ${GOALS[id]})`)
    .join(' | ')} | LCP mediano | CLS mediano |`,
  `|---|${Object.keys(GOALS)
    .map(() => '---')
    .join('|')}|---|---|`,
]
for (const [page, runs] of pages) {
  const cells = Object.entries(GOALS).map(([id, goal]) => {
    const mid = median(runs.map((report) => score(report, id)))
    return `${mid} ${mid >= goal ? '✅' : '❌'}`
  })
  const lcp = median(runs.map((report) => metric(report, 'largestContentfulPaint')))
  const cls = median(runs.map((report) => metric(report, 'cumulativeLayoutShift')))
  lines.push(`| \`${page}\` | ${cells.join(' | ')} | ${Math.round(lcp)} ms | ${cls.toFixed(3)} |`)
}
console.log(lines.join('\n'))
