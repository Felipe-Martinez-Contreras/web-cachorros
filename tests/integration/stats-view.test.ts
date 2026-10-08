import postgres from 'postgres'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { testDb } from './db-urls'
import { cleanSport, createMatch, createPlayer, createSportFixture, type SportFixture } from './fixtures'

const admin = postgres(testDb.adminUrl, { max: 1, onnotice: () => {} })
// La app lee la vista con el rol restringido, igual que en producción.
const app = postgres(testDb.appUrl, { max: 1, onnotice: () => {} })

type Stats = { appearances: number; goals: number; yellow_cards: number; red_cards: number }

let f: SportFixture
let goleador: string
let defensa: string
let suplente: string

async function statsOf(playerId: string): Promise<Stats | undefined> {
  const [row] = await app<Stats[]>`
    select appearances, goals, yellow_cards, red_cards from v_player_season_stats
    where player_id = ${playerId} and season_id = ${f.seasonId} and series_id = ${f.seriesId}`
  return row
}

beforeAll(async () => {
  await cleanSport(admin)
  f = await createSportFixture(admin)
  goleador = await createPlayer(admin, 'goleador')
  defensa = await createPlayer(admin, 'defensa')
  suplente = await createPlayer(admin, 'suplente')

  const jugado1 = await createMatch(admin, f, 'jugado-1')
  const jugado2 = await createMatch(admin, f, 'jugado-2')
  const enVivo = await createMatch(admin, f, 'en-vivo', 'en_vivo')
  const programado = await createMatch(admin, f, 'programado', 'programado')

  const lineup = (match: string, player: string, played: boolean) =>
    admin`insert into match_lineups (match_id, player_id, played) values (${match}, ${player}, ${played})`
  const event = (match: string, player: string | null, type: string, minute: number) =>
    admin`insert into match_events (match_id, type, period, minute, team_id, player_id)
          values (${match}, ${type}, 'primer_tiempo', ${minute}, ${f.ownTeamId}, ${player})`

  // Partido 1: el goleador hace 2 (uno de penal); el defensa recibe amarilla y luego segunda amarilla.
  await lineup(jugado1, goleador, true)
  await lineup(jugado1, defensa, true)
  await lineup(jugado1, suplente, false)
  await event(jugado1, goleador, 'gol', 12)
  await event(jugado1, goleador, 'gol_penal', 40)
  await event(jugado1, defensa, 'tarjeta_amarilla', 30)
  await event(jugado1, defensa, 'segunda_amarilla', 70)
  // Un autogol y un penal errado no suman goles; un gol rival sin jugador tampoco.
  await event(jugado1, defensa, 'autogol', 80)
  await event(jugado1, goleador, 'penal_errado', 85)
  await event(jugado1, null, 'gol', 88)

  // Partido 2: el goleador hace 1 y ve la roja directa.
  await lineup(jugado2, goleador, true)
  await event(jugado2, goleador, 'gol', 5)
  await event(jugado2, goleador, 'tarjeta_roja', 60)

  // Partidos no finalizados: nada de esto cuenta.
  await lineup(enVivo, goleador, true)
  await event(enVivo, goleador, 'gol', 3)
  await lineup(programado, goleador, true)
})

afterAll(async () => {
  await cleanSport(admin)
  await Promise.all([admin.end(), app.end()])
})

describe('v_player_season_stats', () => {
  it('entrega los totales exactos de los partidos finalizados', async () => {
    expect(await statsOf(goleador)).toEqual({ appearances: 2, goals: 3, yellow_cards: 0, red_cards: 1 })
  })

  it('cuenta la segunda amarilla como una amarilla y una roja', async () => {
    expect(await statsOf(defensa)).toEqual({ appearances: 1, goals: 0, yellow_cards: 2, red_cards: 1 })
  })

  it('no cuenta como jugado a quien estuvo en la nómina sin jugar', async () => {
    expect(await statsOf(suplente)).toBeUndefined()
  })

  it('suma los ajustes históricos', async () => {
    await admin`
      insert into player_stat_adjustments (player_id, season_id, series_id, appearances, goals, yellow_cards, red_cards)
      values (${goleador}, ${f.seasonId}, ${f.seriesId}, 10, 7, 2, 0), (${suplente}, ${f.seasonId}, ${f.seriesId}, 4, 1, 0, 0)`
    expect(await statsOf(goleador)).toEqual({ appearances: 12, goals: 10, yellow_cards: 2, red_cards: 1 })
    expect(await statsOf(suplente)).toEqual({ appearances: 4, goals: 1, yellow_cards: 0, red_cards: 0 })
  })

  it('incluye un partido en cuanto pasa a finalizado', async () => {
    await admin`update matches set status = 'finalizado' where slug = 'en-vivo'`
    expect(await statsOf(goleador)).toMatchObject({ appearances: 13, goals: 11 })
  })
})
