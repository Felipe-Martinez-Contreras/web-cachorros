'use server'

import { eq } from 'drizzle-orm'
import { staffAssignments, staffMembers } from '@/db/schema'
import { assertPublishableMedia } from '@/features/media/guards'
import type { ActionResult } from '@/lib/action-result'
import { tags } from '@/lib/cache-tags'
import { assertId, mutate, Rejection } from '@/lib/entity-action'
import { z } from '@/lib/zod'
import { assignmentSchema, staffSchema } from './schemas'

type Result = Promise<ActionResult<{ id: string }>>

// El cuerpo técnico se muestra junto al plantel de cada serie.
const STAFF_TAGS = [tags.players()]
const nothing = z.unknown()

export async function crearIntegrante(input: unknown): Result {
  return mutate({
    action: 'staff.create',
    permission: 'players:write',
    entityType: 'staff_member',
    schema: staffSchema,
    input,
    tags: STAFF_TAGS,
    write: async (tx, data) => {
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const [row] = await tx.insert(staffMembers).values(data).returning({ id: staffMembers.id })
      if (!row) throw new Error('El integrante no se creó.')
      return { id: row.id, summary: `Agregó a ${data.fullName} al cuerpo técnico` }
    },
  })
}

export async function actualizarIntegrante(id: string, input: unknown): Result {
  return mutate({
    action: 'staff.update',
    permission: 'players:write',
    entityType: 'staff_member',
    schema: staffSchema,
    input,
    tags: STAFF_TAGS,
    write: async (tx, data) => {
      const staffId = assertId(id, 'No encontramos a esa persona.')
      await assertPublishableMedia(tx, data.photoMediaId, 'photoMediaId')
      const [row] = await tx
        .update(staffMembers)
        .set(data)
        .where(eq(staffMembers.id, staffId))
        .returning({ id: staffMembers.id })
      if (!row) throw new Rejection('No encontramos a esa persona. Puede que la hayan eliminado.')
      return { id: staffId, summary: `Editó a ${data.fullName} del cuerpo técnico` }
    },
  })
}

export async function eliminarIntegrante(id: string): Result {
  return mutate({
    action: 'staff.delete',
    permission: 'players:write',
    entityType: 'staff_member',
    schema: nothing,
    input: null,
    tags: STAFF_TAGS,
    write: async (tx) => {
      const staffId = assertId(id, 'No encontramos a esa persona.')
      // Sus asignaciones se eliminan con ella (hijos puros).
      const [row] = await tx
        .delete(staffMembers)
        .where(eq(staffMembers.id, staffId))
        .returning({ fullName: staffMembers.fullName })
      if (!row) throw new Rejection('No encontramos a esa persona. Puede que ya la hayan eliminado.')
      return { id: staffId, summary: `Eliminó a ${row.fullName} del cuerpo técnico` }
    },
  })
}

export async function asignarIntegrante(staffId: string, input: unknown): Result {
  return mutate({
    action: 'staff.assignment.create',
    permission: 'players:write',
    entityType: 'staff_assignment',
    schema: assignmentSchema,
    input,
    tags: STAFF_TAGS,
    constraints: {
      staff_assignments_uq: {
        message: 'Ya tiene ese cargo en esa serie y temporada.',
        field: 'role',
      },
    },
    write: async (tx, data) => {
      const id = assertId(staffId, 'No encontramos a esa persona.')
      const [row] = await tx
        .insert(staffAssignments)
        .values({ ...data, staffId: id })
        .returning({ id: staffAssignments.id })
      if (!row) throw new Error('La asignación no se creó.')
      return { id: row.id, summary: 'Asignó un cargo del cuerpo técnico', meta: data }
    },
  })
}

export async function quitarAsignacion(assignmentId: string): Result {
  return mutate({
    action: 'staff.assignment.delete',
    permission: 'players:write',
    entityType: 'staff_assignment',
    schema: nothing,
    input: null,
    tags: STAFF_TAGS,
    write: async (tx) => {
      const id = assertId(assignmentId, 'No encontramos esa asignación.')
      const [row] = await tx
        .delete(staffAssignments)
        .where(eq(staffAssignments.id, id))
        .returning({ id: staffAssignments.id })
      if (!row) throw new Rejection('No encontramos esa asignación. Puede que ya la hayan quitado.')
      return { id, summary: 'Quitó un cargo del cuerpo técnico' }
    },
  })
}
