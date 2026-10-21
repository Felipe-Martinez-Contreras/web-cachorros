import { describe, expect, it } from 'vitest'
import { detectSocialPost, embedFrameUrl } from '@/features/social/lib/feed'
import { socialPostSchema } from '@/features/social/schemas'

describe('detectSocialPost', () => {
  it('reconoce Instagram, Facebook y TikTok y normaliza el enlace', () => {
    expect(detectSocialPost('https://www.instagram.com/p/C0d1g0/?igsh=abc')).toEqual({
      platform: 'instagram',
      url: 'https://www.instagram.com/p/C0d1g0/',
      embeddable: true,
    })
    expect(detectSocialPost('https://www.facebook.com/club/posts/123')?.platform).toBe('facebook')
    expect(detectSocialPost('https://www.tiktok.com/@club/video/123?lang=es')).toEqual({
      platform: 'tiktok',
      url: 'https://www.tiktok.com/@club/video/123',
      embeddable: false,
    })
  })

  it('rechaza lo que no es una publicación de esas redes', () => {
    expect(detectSocialPost('https://example.com/p/1')).toBeNull()
    expect(detectSocialPost('https://www.tiktok.com/')).toBeNull()
    expect(detectSocialPost('ftp://www.tiktok.com/@club')).toBeNull()
    expect(detectSocialPost('no es un enlace')).toBeNull()
    expect(detectSocialPost(42)).toBeNull()
  })
})

describe('embedFrameUrl', () => {
  it('iframe oficial de Instagram y Facebook; TikTok no tiene', () => {
    expect(embedFrameUrl('https://www.instagram.com/reel/AbC123/')).toBe(
      'https://www.instagram.com/reel/AbC123/embed/',
    )
    expect(embedFrameUrl('https://www.facebook.com/club/posts/123')).toBe(
      'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fclub%2Fposts%2F123&show_text=true&width=500',
    )
    expect(embedFrameUrl('https://www.tiktok.com/@club/video/1')).toBeNull()
    expect(embedFrameUrl('[COMPLETAR: URL de la publicación]')).toBeNull()
  })
})

describe('socialPostSchema', () => {
  const IMAGE = '01a15f15-bb07-7e50-b715-4482a6b29aef'
  const base = {
    permalink: 'https://www.instagram.com/p/C0d1g0/',
    platform: 'instagram',
    imageMediaId: IMAGE,
    excerpt: '',
    postedOn: '',
    sortOrder: '0',
    isPinned: false,
    embedEnabled: true,
    isPublished: true,
  }

  it('acepta una publicación válida y el marcador de contenido pendiente', () => {
    expect(socialPostSchema.safeParse(base).success).toBe(true)
    const marker = socialPostSchema.safeParse({
      ...base,
      permalink: '[COMPLETAR: URL de la publicación]',
      embedEnabled: false,
    })
    expect(marker.success).toBe(true)
  })

  it('explica cada rechazo en español', () => {
    const errors = (input: Record<string, unknown>) =>
      socialPostSchema.safeParse({ ...base, ...input }).error?.issues.map((issue) => issue.message)
    expect(errors({ permalink: 'https://example.com/x' })).toEqual([
      'Pega el enlace de una publicación de Instagram, Facebook o TikTok (empieza con https://).',
    ])
    expect(errors({ permalink: 'https://www.tiktok.com/@club/video/1' })).toEqual([
      'Las publicaciones de TikTok se muestran solo como enlace.',
    ])
    expect(errors({ permalink: '[COMPLETAR: URL]' })).toEqual([
      'Primero pega el enlace real de la publicación.',
    ])
    expect(errors({ imageMediaId: '' })).toEqual(['Para publicarla en el sitio, elige su imagen.'])
  })
})
