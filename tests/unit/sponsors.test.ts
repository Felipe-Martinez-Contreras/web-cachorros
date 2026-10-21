import { describe, expect, it } from 'vitest'
import { resolveSponsorTarget, sponsorTargets } from '@/features/sponsors/lib/links'
import { adjacentMonths, monthLabel, reportMonth } from '@/features/sponsors/lib/month'
import { sponsorSchema, sponsorshipFormSchema } from '@/features/sponsors/schemas'

const source = {
  websiteUrl: 'https://roble.example',
  instagramUrl: '[COMPLETAR: Instagram]',
  whatsappE164: '+56912345678',
}

describe('enlaces de un auspiciador', () => {
  it('solo cuentan las direcciones reales: un marcador no es un enlace', () => {
    expect(sponsorTargets(source)).toEqual({
      web: 'https://roble.example/',
      whatsapp: 'https://wa.me/56912345678',
    })
  })

  it('usa el enlace pedido y, si no existe, el primero disponible', () => {
    expect(resolveSponsorTarget(source, 'whatsapp')).toBe('https://wa.me/56912345678')
    expect(resolveSponsorTarget(source, 'instagram')).toBe('https://roble.example/')
    expect(resolveSponsorTarget(source, null)).toBe('https://roble.example/')
    expect(
      resolveSponsorTarget({ websiteUrl: null, instagramUrl: null, whatsappE164: null }, 'web'),
    ).toBeNull()
  })
})

describe('mes del reporte de clics', () => {
  const now = new Date('2026-03-01T02:00:00Z') // 28 de febrero, 23:00 en Chile

  it('acepta AAAA-MM y si no, usa el mes actual en Chile', () => {
    expect(reportMonth('2026-10', now)).toBe('2026-10')
    expect(reportMonth('2026-13', now)).toBe('2026-02')
    expect(reportMonth(undefined, now)).toBe('2026-02')
  })

  it('navega entre meses cruzando el año', () => {
    expect(adjacentMonths('2026-01')).toEqual({ previous: '2025-12', next: '2026-02' })
    expect(adjacentMonths('2026-12')).toEqual({ previous: '2026-11', next: '2027-01' })
    expect(monthLabel('2026-10')).toBe('Octubre de 2026')
  })
})

describe('esquemas de auspiciadores', () => {
  const base = {
    name: 'Ferretería',
    tier: 'oficial',
    logoMediaId: '',
    description: '',
    websiteUrl: '',
    instagramUrl: '',
    whatsapp: '',
    isActive: true,
    sortOrder: '0',
  }

  it('la vigencia no puede terminar antes de empezar', () => {
    expect(sponsorSchema.safeParse({ ...base, startsOn: '2026-05-01', endsOn: '2026-04-30' }).success).toBe(
      false,
    )
    expect(sponsorSchema.safeParse({ ...base, startsOn: '2026-05-01', endsOn: '2026-05-01' }).success).toBe(
      true,
    )
    expect(sponsorSchema.safeParse({ ...base, startsOn: '', endsOn: '' }).success).toBe(true)
  })

  it('el formulario público acepta el nivel en blanco y exige el consentimiento', () => {
    const form = {
      businessName: 'Almacén',
      contactName: 'Rosa',
      email: 'rosa@correo.cl',
      phone: '',
      tierInterest: '',
      message: '',
      privacy: 'on',
    }
    expect(sponsorshipFormSchema.parse(form)).toMatchObject({ tierInterest: null, phone: null })
    expect(sponsorshipFormSchema.safeParse({ ...form, tierInterest: 'otro' }).success).toBe(false)
    expect(sponsorshipFormSchema.safeParse({ ...form, privacy: undefined }).success).toBe(false)
  })
})
