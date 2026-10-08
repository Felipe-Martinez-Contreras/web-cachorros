const MAX_LENGTH = 80

/** Slug en español (especificación 3.9): minúsculas, sin tildes, `ñ → n`, máximo 80 caracteres. */
export function slugify(text: string, maxLength = MAX_LENGTH): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '')
}

/** Devuelve `base` o, si ya existe, `base-2`, `base-3`, … respetando el largo máximo. */
export function uniqueSlug(base: string, isTaken: (slug: string) => boolean, maxLength = MAX_LENGTH): string {
  const root = slugify(base, maxLength) || 'sin-titulo'
  if (!isTaken(root)) return root
  for (let n = 2; ; n++) {
    const suffix = `-${n}`
    const candidate = `${root.slice(0, maxLength - suffix.length).replace(/-+$/, '')}${suffix}`
    if (!isTaken(candidate)) return candidate
  }
}
