import { describe, expect, it } from 'vitest'
import { buildIcs, escapeIcsText, foldIcsLine } from '@/lib/ics'

const base = {
  uid: 'partido-123@cachorros',
  title: 'Honor: Cachorros vs Los Litres',
  startsAt: new Date('2026-10-10T19:00:00Z'),
  durationMinutes: 105,
  now: new Date('2026-10-01T12:00:00Z'),
}

describe('buildIcs', () => {
  it('genera un evento en UTC con fin calculado y líneas CRLF', () => {
    const ics = buildIcs(
      {
        ...base,
        location: 'Estadio Municipal, Sagrada Familia',
        url: 'https://ejemplo.cl/partidos/x',
        sequence: 3,
      },
      'Club Deportivo Los Cachorros',
    )
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.split('\r\n')).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Club Deportivo Los Cachorros//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:partido-123@cachorros',
      'DTSTAMP:20261001T120000Z',
      'DTSTART:20261010T190000Z',
      'DTEND:20261010T204500Z',
      'SEQUENCE:3',
      'SUMMARY:Honor: Cachorros vs Los Litres',
      'LOCATION:Estadio Municipal\\, Sagrada Familia',
      'URL:https://ejemplo.cl/partidos/x',
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ])
  })

  it('marca como cancelado y omite lo que no viene', () => {
    const ics = buildIcs({ ...base, cancelled: true }, 'Club')
    expect(ics).toContain('STATUS:CANCELLED')
    expect(ics).toContain('SEQUENCE:0')
    expect(ics).not.toContain('LOCATION')
    expect(ics).not.toContain('DESCRIPTION')
    expect(ics).not.toContain('URL')
  })

  it('escapa el texto y dobla las líneas largas sin romper tildes ni eñes', () => {
    expect(escapeIcsText('Cancha 1; entrada\\portón, calle Ñuble\nSin estacionamiento')).toBe(
      'Cancha 1\\; entrada\\\\portón\\, calle Ñuble\\nSin estacionamiento',
    )
    const long = `DESCRIPTION:${'Ñandú añejo '.repeat(12)}`
    const folded = foldIcsLine(long)
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    const bytes = (line: string) => new TextEncoder().encode(line).length
    for (const line of lines) expect(bytes(line)).toBeLessThanOrEqual(75)
    for (const line of lines.slice(1)) expect(line.startsWith(' ')).toBe(true)
    // Al quitar los dobleces vuelve el texto original, con cada carácter entero.
    expect(lines.map((line, index) => (index === 0 ? line : line.slice(1))).join('')).toBe(long)
    expect(foldIcsLine('SUMMARY:corta')).toBe('SUMMARY:corta')
  })
})
