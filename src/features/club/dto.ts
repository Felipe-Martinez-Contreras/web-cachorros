import type { documentCategory } from '@/db/schema/enums'
import type { ImageDTO } from '@/lib/images/dto'

export type BoardMemberDTO = {
  id: string
  fullName: string
  roleTitle: string
  photo: ImageDTO | null
  publicEmail: string | null
  /** Fechas `AAAA-MM-DD` del período, si se conocen. */
  termStart: string | null
  termEnd: string | null
}

export type DocumentCategory = (typeof documentCategory.enumValues)[number]

export type TransparencyDocumentDTO = {
  id: string
  title: string
  category: DocumentCategory
  periodLabel: string | null
  /** Fecha del documento (`AAAA-MM-DD`) o, si no tiene, la de publicación. */
  date: string | null
  year: number | null
  description: string | null
  url: string
  bytes: number
}

export type TransparencyDTO = {
  documents: TransparencyDocumentDTO[]
  categories: DocumentCategory[]
  years: number[]
}
