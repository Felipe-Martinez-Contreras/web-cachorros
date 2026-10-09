import 'server-only'
import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/client'
import { mediaAssets, seasons, series, staffAssignments, staffMembers } from '@/db/schema'
import { type MediaThumbDTO, toMediaThumbDTO } from '@/features/media/dto'

// Lecturas del panel: sin caché, siempre el estado actual.

type Assignment = {
  id: string
  staffId: string
  seasonId: string
  seasonName: string
  isCurrentSeason: boolean
  seriesId: string
  seriesName: string
  role: (typeof staffAssignments.$inferSelect)['role']
}

export type StaffAdminRow = {
  id: string
  fullName: string
  bio: string | null
  photo: MediaThumbDTO | null
  assignments: Assignment[]
}

async function loadStaff(id?: string): Promise<StaffAdminRow[]> {
  const members = await db
    .select({
      id: staffMembers.id,
      fullName: staffMembers.fullName,
      bio: staffMembers.bio,
      photoId: mediaAssets.id,
      photoVariants: mediaAssets.variants,
      photoAlt: mediaAssets.altText,
      photoMinors: mediaAssets.containsMinors,
    })
    .from(staffMembers)
    .leftJoin(mediaAssets, eq(mediaAssets.id, staffMembers.photoMediaId))
    .where(id ? eq(staffMembers.id, id) : undefined)
    .orderBy(asc(staffMembers.fullName))
  if (members.length === 0) return []

  // Una sola consulta para las asignaciones de todos (sin N+1).
  const assignments = await db
    .select({
      id: staffAssignments.id,
      staffId: staffAssignments.staffId,
      seasonId: staffAssignments.seasonId,
      seasonName: seasons.name,
      isCurrentSeason: seasons.isCurrent,
      seriesId: staffAssignments.seriesId,
      seriesName: series.name,
      role: staffAssignments.role,
    })
    .from(staffAssignments)
    .innerJoin(seasons, eq(seasons.id, staffAssignments.seasonId))
    .innerJoin(series, eq(series.id, staffAssignments.seriesId))
    .where(
      inArray(
        staffAssignments.staffId,
        members.map((member) => member.id),
      ),
    )
    .orderBy(desc(seasons.year), asc(series.sortOrder), asc(staffAssignments.sortOrder))

  return members.map((member) => ({
    id: member.id,
    fullName: member.fullName,
    bio: member.bio,
    photo: member.photoId
      ? toMediaThumbDTO({
          id: member.photoId,
          variants: member.photoVariants,
          altText: member.photoAlt,
          containsMinors: member.photoMinors ?? false,
        })
      : null,
    assignments: assignments.filter((assignment) => assignment.staffId === member.id),
  }))
}

export function listStaffAdmin(): Promise<StaffAdminRow[]> {
  return loadStaff()
}

export async function getStaffAdmin(id: string): Promise<StaffAdminRow | null> {
  return (await loadStaff(id))[0] ?? null
}
