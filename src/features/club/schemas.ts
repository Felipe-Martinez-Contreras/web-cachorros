import {
  checkbox,
  labeledEnum,
  optionalDate,
  optionalEmail,
  optionalText,
  optionalUuid,
  requiredInt,
  requiredText,
  requiredUuid,
} from '@/lib/form-schemas'
import { documentCategoryLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

const sortOrder = () => requiredInt(0, 999, 'Escribe un número entre 0 y 999.')

/** Integrante de la directiva (especificación 6.12). */
export const boardMemberSchema = z
  .object({
    fullName: requiredText('Escribe el nombre completo.', 120),
    roleTitle: requiredText('Escribe el cargo (por ejemplo «Presidenta»).', 80),
    photoMediaId: optionalUuid(),
    publicEmail: optionalEmail(),
    termStart: optionalDate(),
    termEnd: optionalDate(),
    isCurrent: checkbox(),
    sortOrder: sortOrder(),
  })
  .refine((value) => !value.termStart || !value.termEnd || value.termEnd >= value.termStart, {
    message: 'El término del período no puede ser anterior al inicio.',
    path: ['termEnd'],
  })
export type BoardMemberFormValues = z.input<typeof boardMemberSchema>

/** Documento de transparencia: solo PDF validados (especificación 6.12 y 9.5). */
export const documentSchema = z.object({
  title: requiredText('Escribe el título del documento.', 160),
  category: labeledEnum(documentCategoryLabels, 'Elige una categoría de la lista.'),
  periodLabel: optionalText(60),
  documentDate: optionalDate(),
  fileMediaId: requiredUuid('Sube el PDF del documento.'),
  description: optionalText(500),
  isPublished: checkbox(),
})
export type DocumentFormValues = z.input<typeof documentSchema>
