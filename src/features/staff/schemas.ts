import { labeledEnum, optionalText, optionalUuid, requiredText, requiredUuid } from '@/lib/form-schemas'
import { staffRoleLabels } from '@/lib/labels'
import { z } from '@/lib/zod'

export const staffSchema = z.object({
  fullName: requiredText('Escribe el nombre completo.', 100),
  photoMediaId: optionalUuid(),
  bio: optionalText(600),
})
export type StaffFormValues = z.input<typeof staffSchema>

export const assignmentSchema = z.object({
  seasonId: requiredUuid('Elige la temporada.'),
  seriesId: requiredUuid('Elige la serie.'),
  role: labeledEnum(staffRoleLabels, 'Elige el cargo.'),
})
export type AssignmentFormValues = z.input<typeof assignmentSchema>
