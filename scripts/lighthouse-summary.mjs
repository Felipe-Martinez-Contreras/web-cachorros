// Resume en Markdown los informes que deja `pnpm lighthouse` en .lighthouseci/reportes.
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
  console.log('## Lighthouse móvil de la portada\n\nNo hay informes: revisa el paso anterior.')
  process.exit(0)
}

const score = (report, id) => Math.round(report.categories[id].score * 100)
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const metric = (report, key) => report.audits.metrics.details.items[0][key]

const lines = [
  '## Lighthouse móvil de la portada',
  '',
  `${reports.length} corridas · red 4G lenta y CPU ×4 (${reports[0].configSettings.throttlingMethod})`,
  '',
  '| Categoría | Meta | Mediana | Mejor | Todas |',
  '|---|---|---|---|---|',
]
for (const [id, goal] of Object.entries(GOALS)) {
  const values = reports.map((report) => score(report, id))
  const mid = median(values)
  lines.push(
    `| ${reports[0].categories[id].title} | ${goal} | ${mid} ${mid >= goal ? '✅' : '❌'} | ${Math.max(...values)} | ${values.join(' · ')} |`,
  )
}
lines.push(
  '',
  '| Corrida | Rendimiento | FCP | LCP | TBT | CLS | Índice de CPU |',
  '|---|---|---|---|---|---|---|',
)
reports.forEach((report, index) => {
  lines.push(
    `| ${index + 1} | ${score(report, 'performance')} | ${Math.round(metric(report, 'firstContentfulPaint'))} ms | ${Math.round(metric(report, 'largestContentfulPaint'))} ms | ${Math.round(metric(report, 'totalBlockingTime'))} ms | ${metric(report, 'cumulativeLayoutShift').toFixed(3)} | ${Math.round(report.environment.benchmarkIndex)} |`,
  )
})

const best = [...reports].sort((a, b) => b.categories.performance.score - a.categories.performance.score)[0]
const lcp = best.audits['largest-contentful-paint-element']?.details?.items ?? []
const element = lcp[0]?.items?.[0]?.node
const phases = lcp[1]?.items ?? []
if (element && phases.length > 0) {
  lines.push(
    '',
    `Elemento LCP (mejor corrida): \`${element.selector}\``,
    '',
    '| Fase del LCP | Tiempo |',
    '|---|---|',
    ...phases.map((phase) => `| ${phase.phase} | ${Math.round(phase.timing)} ms |`),
  )
}
console.log(lines.join('\n'))
