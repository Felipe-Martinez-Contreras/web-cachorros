import type { documentCategory, staffRole } from '@/db/schema/enums'
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

export type TrainingSeriesDTO = {
  slug: string
  name: string
  description: string | null
  /** Sesiones de la semana, de lunes a domingo; horas `HH:MM`. */
  sessions: {
    weekday: number
    startsAt: string
    endsAt: string
    venueName: string | null
    notes: string | null
  }[]
  /** Cuerpo técnico de la temporada actual (solo nombre y cargo). */
  coaches: { name: string; role: (typeof staffRole.enumValues)[number] }[]
}

/** Dónde queda la cancha del club (6.13): datos de Configuración. */
export type ClubPlaceDTO = {
  address: string | null
  commune: string | null
  region: string | null
  /** Coordenadas del club o, si faltan, de la cancha marcada como propia. */
  geo: { lat: number; lng: number } | null
}

/** «Apoya al club» (6.14): datos de transferencia ya formateados y link de pago opcional. */
export type DonationDTO = {
  transferText: string | null
  paymentUrl: string | null
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
