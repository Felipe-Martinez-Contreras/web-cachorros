import { describe, expect, it } from 'vitest'
import {
  addDays,
  clampText,
  fitDisplaySize,
  isGoalFor,
  isValidVersion,
  lastClubGoal,
  parseShareRequest,
  scorerLines,
  shareCachePath,
  shareFilename,
  shareUrl,
  shortHash,
  weekendOf,
  weekendTitle,
  withDesignRevision,
} from '@/features/share/lib/cards'

const ID = '01a15f15-bb07-7e50-b715-4482a6b29aef'

type Goal = Parameters<typeof scorerLines>[0][number]
const goal = (over: Partial<Goal>): Goal => ({
  type: 'gol',
  period: 'primer_tiempo',
  minute: 10,
  stoppageMinute: null,
  side: 'home',
  playerName: 'Juan Pérez',
  ...over,
})

describe('parseShareRequest', () => {
  it('acepta plantillas, formatos e ids válidos', () => {
    expect(parseShareRequest('resultado', ID.toUpperCase(), 'cuadrado')).toEqual({
      template: 'resultado',
      id: ID,
      format: 'cuadrado',
    })
    expect(parseShareRequest('programacion', '2026-10-24', 'historia')?.template).toBe('programacion')
    expect(parseShareRequest('noticia', ID, 'og')?.format).toBe('og')
  })

  it('rechaza lo que no corresponde', () => {
    expect(parseShareRequest('otra', ID, 'cuadrado')).toBeNull()
    expect(parseShareRequest('resultado', ID, 'gigante')).toBeNull()
    expect(parseShareRequest('resultado', 'no-es-id', 'cuadrado')).toBeNull()
    expect(parseShareRequest('resultado', '2026-10-24', 'cuadrado')).toBeNull()
    expect(parseShareRequest('resultados', ID, 'cuadrado')).toBeNull()
    expect(parseShareRequest('resultados', '2026-02-30', 'cuadrado')).toBeNull()
    expect(parseShareRequest('noticia', ID, 'cuadrado')).toBeNull()
    expect(parseShareRequest('constructor', ID, 'cuadrado')).toBeNull()
  })
})

describe('direcciones y archivos', () => {
  it('URL versionada, archivo de la caché y nombre de descarga', () => {
    const request = { template: 'resultado', id: ID, format: 'og' } as const
    expect(shareUrl('resultado', ID, 'og', 3)).toBe(`/api/share/resultado/${ID}/og?v=3`)
    expect(shareCachePath(request, 3)).toBe(`resultado/${ID}-v3-og.jpg`)
    expect(shareFilename({ ...request, format: 'vertical' }, 'honor-vs-rival')).toBe(
      'resultado-honor-vs-rival-vertical.png',
    )
  })

  it('valida la versión pedida', () => {
    expect(isValidVersion('12')).toBe(true)
    expect(isValidVersion('1m6t1ru')).toBe(true)
    expect(isValidVersion(null)).toBe(false)
    expect(isValidVersion('../x')).toBe(false)
    expect(isValidVersion('a'.repeat(17))).toBe(false)
  })

  it('hash corto estable', () => {
    expect(shortHash(['a', 1])).toBe(shortHash(['a', 1]))
    expect(shortHash(['a', 1])).not.toBe(shortHash(['a', 2]))
  })
})

describe('fin de semana', () => {
  it('cada día lleva al sábado de su fin de semana', () => {
    expect(weekendOf('2026-10-19')).toBe('2026-10-24') // lunes
    expect(weekendOf('2026-10-24')).toBe('2026-10-24') // sábado
    expect(weekendOf('2026-10-25')).toBe('2026-10-24') // domingo
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('título con uno o dos meses', () => {
    expect(weekendTitle('2026-10-24')).toBe('Sábado 24 y domingo 25 de octubre')
    expect(weekendTitle('2026-10-31')).toBe('Sábado 31 de octubre y domingo 1 de noviembre')
  })
})

describe('goleadores', () => {
  const events: Goal[] = [
    goal({ minute: 12 }),
    goal({ minute: 30, side: 'away', playerName: 'Rival Uno' }),
    goal({ type: 'gol_penal', minute: 45, stoppageMinute: 2 }),
    goal({ type: 'autogol', minute: 60, side: 'away', playerName: 'Defensa Rival' }),
    goal({ minute: 70, playerName: null }),
    goal({ type: 'gol_penal', period: 'penales', minute: null }),
    goal({ type: 'tarjeta_amarilla', minute: 80 }),
  ]

  it('agrupa por jugador con sus minutos; el autogol suma al contrario', () => {
    expect(scorerLines(events, 'home')).toEqual([
      "Juan Pérez 12', 45+2' (p)",
      "Autogol de Defensa Rival 60'",
      "Gol 70'",
    ])
    expect(scorerLines(events, 'away')).toEqual(["Rival Uno 30'"])
    const unnamed = [goal({ playerName: null, minute: 65 }), goal({ playerName: null, minute: 72 })]
    expect(scorerLines(unnamed, 'home')).toEqual(["Goles 65', 72'"])
    expect(
      scorerLines([goal({ type: 'autogol', side: 'home', playerName: null, minute: null })], 'away'),
    ).toEqual(['Autogol'])
  })

  it('la definición por penales y un evento sin lado no cuentan', () => {
    expect(isGoalFor(goal({ period: 'penales' }), 'home')).toBe(false)
    expect(isGoalFor(goal({ side: null }), 'home')).toBe(false)
  })

  it('último gol del club', () => {
    expect(lastClubGoal(events, 'home')?.minute).toBe(70)
    expect(lastClubGoal(events, 'away')?.minute).toBe(30)
    expect(lastClubGoal([goal({ side: 'away' })], 'home')).toBeNull()
  })
})

describe('clampText', () => {
  it('corta en una palabra y agrega puntos suspensivos', () => {
    expect(clampText('  corto  ', 10)).toBe('corto')
    expect(clampText('Los Cachorros ganan el clásico', 20)).toBe('Los Cachorros ganan…')
    expect(clampText('Supercalifragilístico', 10)).toBe('Supercali…')
    // Los marcadores de contenido pendiente no se dibujan.
    expect(clampText('Campeonato Oficial [COMPLETAR: nombre de la asociación] · Fecha 7', 60)).toBe(
      'Campeonato Oficial · Fecha 7',
    )
  })
})

describe('fitDisplaySize', () => {
  it('mantiene el tamaño si el nombre cabe en las líneas pedidas', () => {
    expect(fitDisplaySize('Cachorros', 400, 60)).toBe(60)
    expect(fitDisplaySize('Deportivo Ejemplo', 400, 60)).toBe(60)
  })

  it('achica la letra en vez de cortar un nombre largo', () => {
    const size = fitDisplaySize('Social y Deportivo Población Ejemplo del Sur', 400, 60)
    expect(size).toBeLessThan(60)
    expect(size).toBeGreaterThanOrEqual(30)
    // Con más líneas permitidas, la letra puede ser más grande.
    expect(fitDisplaySize('Social y Deportivo Población Ejemplo del Sur', 400, 60, 3)).toBeGreaterThan(size)
  })

  it('una palabra que no cabe a lo ancho también achica la letra', () => {
    expect(fitDisplaySize('Supercalifragilístico', 300, 60, 2)).toBeLessThan(60)
  })
})

describe('withDesignRevision', () => {
  it('suma la revisión del diseño a las plantillas rediseñadas', () => {
    expect(withDesignRevision('proximo', 3)).toBe('3m2')
    expect(withDesignRevision('programacion', 'abc')).toBe('abcp2')
    expect(withDesignRevision('resultado', 3)).toBe('3e1')
    expect(isValidVersion(withDesignRevision('proximo', 12))).toBe(true)
    expect(isValidVersion(withDesignRevision('noticia', 'abc'))).toBe(true)
  })
})
