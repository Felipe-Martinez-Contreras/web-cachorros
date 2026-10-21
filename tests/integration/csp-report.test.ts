import { afterAll, describe, expect, it, vi } from 'vitest'

const { logger } = await import('@/lib/logger')
const route = await import('@/app/api/csp-report/route')

const warnings: unknown[][] = []
// requestLogger crea un hijo del logger: se espía `child` para capturar lo que registra.
vi.spyOn(logger, 'child').mockImplementation(() => {
  const child = Object.create(logger)
  child.warn = (...args: unknown[]) => warnings.push(args)
  return child
})

afterAll(() => vi.restoreAllMocks())

function report(body: string, ip = '203.0.113.7') {
  return route.POST(
    new Request('http://localhost:3000/api/csp-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/csp-report', 'x-e2e-client-ip': ip },
      body,
    }),
  )
}

const violation = JSON.stringify({
  'csp-report': {
    'document-uri': 'http://localhost:3000/contacto?nombre=Ana',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'https://malo.example/x.js?token=secreto',
  },
})

describe('POST /api/csp-report', () => {
  it('registra la violación resumida, sin query ni IP, y responde 204', async () => {
    const response = await report(violation)
    expect(response.status).toBe(204)
    const [fields, message] = warnings.at(-1) ?? []
    expect(message).toBe('violación de CSP')
    expect(fields).toMatchObject({
      csp: { directive: 'script-src-elem', blocked: 'https://malo.example', page: '/contacto' },
    })
    const logged = JSON.stringify(fields)
    expect(logged).not.toContain('203.0.113.7')
    expect(logged).not.toContain('secreto')
    expect(logged).not.toContain('Ana')
  })

  it('ignora lo que no es un reporte y limita cuántos acepta por IP', async () => {
    const before = warnings.length
    expect((await report('no es json')).status).toBe(204)
    expect((await report(JSON.stringify({ hola: 1 }))).status).toBe(204)
    expect((await report('x'.repeat(20_000))).status).toBe(204)
    expect(warnings.length).toBe(before)

    for (let index = 0; index < 40; index++) await report(violation, '198.51.100.9')
    expect(warnings.length - before).toBe(30)
  })
})
