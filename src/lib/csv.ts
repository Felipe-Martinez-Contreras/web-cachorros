/**
 * CSV para abrir en Excel con la configuración regional de Chile: separador `;` (la coma es el separador
 * decimal), saltos de línea CRLF y BOM UTF-8 para que las tildes y la ñ se lean bien. Lógica pura.
 */
export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined }

const SEPARATOR = ';'

/**
 * Una celda que empieza con `=`, `+`, `-`, `@`, tabulación o retorno de carro es una fórmula para Excel:
 * un nombre como `=HYPERLINK(…)` escrito en un formulario público se ejecutaría al abrir el archivo. Se
 * antepone un apóstrofo para que quede como texto (OWASP, «CSV injection»). Un número puro (un celular
 * `+56912345678`, un monto `-500`) no es una fórmula: Excel lo lee como número y se deja tal cual.
 */
function neutralizeFormula(text: string): string {
  if (/^[+-]?\d+([.,]\d+)?$/.test(text)) return text
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'number' ? String(value) : neutralizeFormula(value)
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(SEPARATOR),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(SEPARATOR)),
  ]
  return `﻿${lines.join('\r\n')}\r\n`
}
