import { describe, expect, it } from 'vitest'
import { albumSchema, videoSchema } from '@/features/gallery/schemas'

const video = (url: string) =>
  videoSchema.safeParse({
    title: 'Resumen',
    url,
    thumbnailMediaId: '',
    publishedOn: '',
    matchId: '',
    isPublished: true,
  })

describe('esquema de videos', () => {
  it('YouTube: guarda la dirección normalizada y el id del video', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    ]) {
      expect(video(url).data).toMatchObject({
        provider: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        externalId: 'dQw4w9WgXcQ',
      })
    }
  })

  it('Facebook: sin id de reproductor (se enlaza)', () => {
    expect(video('https://www.facebook.com/cachorros/videos/123456789/').data).toMatchObject({
      provider: 'facebook',
      externalId: null,
    })
  })

  it('rechaza Instagram, otras páginas y los marcadores', () => {
    for (const url of [
      'https://www.instagram.com/reel/abc123/',
      'https://vimeo.com/123',
      '[COMPLETAR: URL del video]',
    ]) {
      expect(video(url).error?.issues[0]).toMatchObject({
        path: ['url'],
        message: 'Pega la dirección de un video de YouTube o de Facebook.',
      })
    }
  })
})

describe('esquema de álbumes', () => {
  const album = {
    title: 'Formativas en la cancha',
    takenOn: '',
    coverMediaId: '',
    matchId: '',
    eventId: '',
    isPublished: true,
    containsMinors: true,
    minorsConsent: false,
  }

  it('un álbum con menores no se publica sin confirmar las autorizaciones', () => {
    expect(albumSchema.safeParse(album).error?.issues[0]?.path).toEqual(['minorsConsent'])
    expect(albumSchema.safeParse({ ...album, minorsConsent: true }).success).toBe(true)
    // Como borrador sí se puede guardar.
    expect(albumSchema.safeParse({ ...album, isPublished: false }).success).toBe(true)
  })
})
