import { and, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/client'
import { matches, series, teams, venues } from '@/db/schema'
import { isClubMatch } from '@/features/matches/queries'
import { getSite } from '@/features/settings/queries'
import { env } from '@/lib/env'
import { isUuid } from '@/lib/form-schemas'
import { buildIcs } from '@/lib/ics'

const homeTeam = alias(teams, 'home_team')
const awayTeam = alias(teams, 'away_team')

/** Entretiempo y demoras habituales, además de los dos tiempos. */
const EXTRA_MINUTES = 20

/** `.ics` de un partido del club para «Agregar al calendario» (especificación 6.16). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return new Response(null, { status: 404 })

  const [match] = await db
    .select({
      slug: matches.slug,
      kickoffAt: matches.kickoffAt,
      status: matches.status,
      shareVersion: matches.shareVersion,
      roundLabel: matches.roundLabel,
      seriesName: series.name,
      halfLengthMinutes: series.halfLengthMinutes,
      homeName: homeTeam.shortName,
      awayName: awayTeam.shortName,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCommune: venues.commune,
    })
    .from(matches)
    .innerJoin(series, eq(series.id, matches.seriesId))
    .innerJoin(homeTeam, eq(homeTeam.id, matches.homeTeamId))
    .innerJoin(awayTeam, eq(awayTeam.id, matches.awayTeamId))
    .leftJoin(venues, eq(venues.id, matches.venueId))
    .where(and(eq(matches.id, id), isClubMatch))
    .limit(1)
  if (!match) return new Response(null, { status: 404 })

  const site = await getSite()
  const clubName = site?.clubName ?? 'Club Deportivo Los Cachorros'
  const url = `${env.SITE_URL}/partidos/${match.slug}`
  const body = buildIcs(
    {
      uid: `partido-${id}@${new URL(env.SITE_URL ?? url).hostname}`,
      title: `${match.seriesName}: ${match.homeName} vs ${match.awayName}`,
      startsAt: match.kickoffAt,
      durationMinutes: match.halfLengthMinutes * 2 + EXTRA_MINUTES,
      description: [match.roundLabel, url].filter(Boolean).join('\n'),
      location: [match.venueName, match.venueAddress, match.venueCommune].filter(Boolean).join(', ') || null,
      url,
      sequence: match.shareVersion,
      cancelled: match.status === 'cancelado',
    },
    clubName,
  )
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${match.slug}.ics"`,
      // Corta: si el partido se posterga, el archivo descargado después trae la fecha nueva.
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  })
}
