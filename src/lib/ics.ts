/** Evento de calendario para «Agregar al calendario» (especificación 6.16). */
export type CalendarEvent = {
  /** Identificador estable: el mismo evento actualizado reemplaza al anterior en el calendario. */
  uid: string
  title: string
  startsAt: Date
  durationMinutes: number
  description?: string | null
  location?: string | null
  url?: string | null
  /** Se incrementa cuando cambia la fecha o el estado, para que el calendario tome la versión nueva. */
  sequence?: number
  cancelled?: boolean
  /** Momento de generación (inyectable para pruebas). */
  now?: Date
}

/** Instante en UTC con el formato de iCalendar: `20261010T190000Z`. */
function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

/** Escapa texto según RFC 5545 (3.3.11): barra invertida, punto y coma, coma y saltos de línea. */
export function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Corta las líneas a 75 octetos (RFC 5545, 3.1) sin partir un carácter de varios bytes. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // Las líneas de continuación empiezan con un espacio, que también cuenta.
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** Archivo `.ics` con un solo evento, en UTC (el calendario lo muestra en la zona de cada persona). */
export function buildIcs(event: CalendarEvent, productName: string): string {
  const end = new Date(event.startsAt.getTime() + event.durationMinutes * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeIcsText(productName)}//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(event.uid)}`,
    `DTSTAMP:${utcStamp(event.now ?? new Date())}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(end)}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : null,
    event.url ? `URL:${event.url}` : null,
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines
    .filter((line): line is string => line !== null)
    .map(foldIcsLine)
    .join('\r\n')}\r\n`
}
