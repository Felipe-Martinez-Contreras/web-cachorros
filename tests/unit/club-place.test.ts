import { describe, expect, it } from 'vitest'
import { bankTransferText, openStreetMapUrls } from '@/features/club/lib/place'
import { trainingScheduleSchema } from '@/features/club/schemas'

describe('mapa de OpenStreetMap', () => {
  it('arma el recuadro alrededor del punto y la página para el enlace sin JavaScript', () => {
    const { embed, page } = openStreetMapUrls(-34.995, -71.38)
    expect(embed).toBe(
      'https://www.openstreetmap.org/export/embed.html?bbox=-71.38400%2C-34.99800%2C-71.37600%2C-34.99200&layer=mapnik&marker=-34.995%2C-71.38',
    )
    expect(page).toBe('https://www.openstreetmap.org/?mlat=-34.995&mlon=-71.38#map=17/-34.995/-71.38')
  })
})

describe('datos de transferencia', () => {
  it('una línea por dato, en orden, sin los vacíos', () => {
    expect(
      bankTransferText({
        holder: 'Club Deportivo Los Cachorros',
        rut: '65.123.456-7',
        bank: 'BancoEstado',
        accountType: 'Cuenta vista',
        accountNumber: '123456789',
        email: ' ',
      }),
    ).toBe(
      [
        'Titular: Club Deportivo Los Cachorros',
        'RUT: 65.123.456-7',
        'Banco: BancoEstado',
        'Tipo de cuenta: Cuenta vista',
        'Número de cuenta: 123456789',
      ].join('\n'),
    )
  })

  it('sin datos no hay bloque', () => {
    expect(bankTransferText(null)).toBeNull()
    expect(bankTransferText({ holder: '' })).toBeNull()
  })
})

describe('horario de entrenamiento', () => {
  const base = { seriesId: '00000000-0000-4000-8000-000000000001', weekday: '2', venueId: '', notes: '' }

  it('el término tiene que ser después del inicio', () => {
    expect(
      trainingScheduleSchema.safeParse({ ...base, startsAt: '20:00', endsAt: '19:30' }).error?.issues[0],
    ).toMatchObject({
      path: ['endsAt'],
      message: 'El término tiene que ser después del inicio.',
    })
    expect(trainingScheduleSchema.parse({ ...base, startsAt: '19:00', endsAt: '20:30' })).toMatchObject({
      weekday: 2,
      venueId: null,
      notes: null,
    })
  })

  it('el día va de lunes (1) a domingo (7)', () => {
    expect(
      trainingScheduleSchema.safeParse({ ...base, weekday: '8', startsAt: '19:00', endsAt: '20:00' }).success,
    ).toBe(false)
  })
})
