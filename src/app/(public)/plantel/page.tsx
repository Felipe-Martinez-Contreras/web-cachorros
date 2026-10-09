import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getSportsNav } from '@/features/matches/public-queries'

/** `/plantel` lleva al plantel de la serie destacada (especificación 5.1). */
export default async function SquadIndexPage() {
  await connection()
  const nav = await getSportsNav()
  const slug = nav.featuredSeriesSlug ?? nav.series[0]?.slug
  if (!slug) notFound()
  redirect(`/plantel/${slug}`)
}
