import { describe, expect, it } from 'vitest'
import { adminCsp, newNonce, publicCsp, summarizeCspReports } from '@/lib/csp'

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((part) => part.startsWith(`${name} `))
    ?.split(' ')
    .slice(1)

describe('CSP del sitio público', () => {
  const csp = publicCsp()

  it('permite Turnstile, la analítica y las fachadas de terceros (9.3)', () => {
    expect(directive(csp, 'script-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
      'https://challenges.cloudflare.com',
      'https://static.cloudflareinsights.com',
    ])
    expect(directive(csp, 'frame-src')).toContain('https://www.youtube-nocookie.com')
    expect(directive(csp, 'frame-src')).toContain('https://www.openstreetmap.org')
    expect(directive(csp, 'frame-src')).toContain('https://www.instagram.com')
    expect(directive(csp, 'img-src')).toContain('https://i.ytimg.com')
    expect(directive(csp, 'connect-src')).toEqual(["'self'", 'https://cloudflareinsights.com'])
    expect(directive(csp, 'worker-src')).toEqual(["'self'"])
    expect(directive(csp, 'manifest-src')).toEqual(["'self'"])
    expect(directive(csp, 'object-src')).toEqual(["'none'"])
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"])
    expect(directive(csp, 'report-uri')).toEqual(['/api/csp-report'])
  })

  it('no lleva nonce (el HTML se puede cachear)', () => {
    expect(csp).not.toContain('nonce-')
  })
})

describe('CSP del panel', () => {
  it('scripts solo con el nonce de la petición', () => {
    const nonce = newNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    expect(newNonce()).not.toBe(nonce)
    const csp = adminCsp(nonce)
    expect(directive(csp, 'script-src')).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"])
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'")
  })
})

describe('summarizeCspReports', () => {
  it('formato clásico: sin query ni dirección completa', () => {
    expect(
      summarizeCspReports({
        'csp-report': {
          'document-uri': 'https://cachorros.test/contacto?email=persona@correo.cl',
          'effective-directive': 'script-src-elem',
          'blocked-uri': 'https://malo.example/x.js?token=1',
          disposition: 'report',
        },
      }),
    ).toEqual([
      {
        directive: 'script-src-elem',
        blocked: 'https://malo.example',
        page: '/contacto',
        disposition: 'report',
      },
    ])
  })

  it('Reporting API, inline y lo que no es un reporte', () => {
    expect(
      summarizeCspReports([
        {
          type: 'csp-violation',
          body: {
            documentURL: 'https://cachorros.test/',
            effectiveDirective: 'style-src',
            blockedURL: 'inline',
          },
        },
        { type: 'deprecation', body: {} },
      ]),
    ).toEqual([{ directive: 'style-src', blocked: 'inline', page: '/', disposition: 'report' }])
    expect(summarizeCspReports({ 'csp-report': { 'blocked-uri': 'no es url', 'document-uri': 3 } })).toEqual([
      { directive: '', blocked: 'desconocido', page: 'desconocida', disposition: 'report' },
    ])
    expect(summarizeCspReports({ hola: 1 })).toBeNull()
    expect(summarizeCspReports([])).toBeNull()
    expect(summarizeCspReports('texto')).toBeNull()
  })
})
