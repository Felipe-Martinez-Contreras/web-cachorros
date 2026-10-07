'use server'

import { eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { db } from '@/db/client'
import { siteSettings } from '@/db/schema'
import { type ActionResult, fail, ok } from '@/lib/action-result'
import { audit } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/session'
import { tags } from '@/lib/cache-tags'
import { runAction } from '@/lib/run-action'
import { type ClubIdentityDTO, toClubIdentityDTO } from './dto'
import { updateClubIdentitySchema } from './schemas'

export async function actualizarIdentidadClub(input: unknown): Promise<ActionResult<ClubIdentityDTO>> {
  return runAction('settings.identity.update', async () => {
    const user = await requirePermission('settings:write') // 1. autorización (siempre aquí)
    const parsed = updateClubIdentitySchema.safeParse(input) // 2. validación
    if (!parsed.success) return fail(parsed.error)

    const updated = await db.transaction(async (tx) => {
      // 3. escritura atómica
      const [row] = await tx.update(siteSettings).set(parsed.data).where(eq(siteSettings.id, 1)).returning({
        clubName: siteSettings.clubName,
        shortName: siteSettings.shortName,
        foundedOn: siteSettings.foundedOn,
      })
      if (!row) return null
      await audit(tx, user, 'settings.identity.update', {
        // 4. auditoría
        entityType: 'site_settings',
        entityId: '1',
        summary: 'Actualizó el nombre del club',
        meta: parsed.data,
      })
      return row
    })
    if (!updated) return fail('No encontramos la configuración del club. Avisa a soporte.')

    updateTag(tags.settings()) // 5. invalidación mínima
    return ok(toClubIdentityDTO(updated)) // 6. resultado tipado
  })
}

/** Adaptador para `useActionState`: recibe el formulario y delega en la acción tipada. */
export async function actualizarIdentidadClubForm(
  _prev: ActionResult<ClubIdentityDTO> | null,
  formData: FormData,
): Promise<ActionResult<ClubIdentityDTO>> {
  return actualizarIdentidadClub({
    clubName: formData.get('clubName'),
    shortName: formData.get('shortName'),
  })
}
