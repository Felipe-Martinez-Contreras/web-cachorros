import type { ComponentType, SVGProps } from 'react'
import {
  FacebookIcon,
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
  XIcon,
  YouTubeIcon,
} from '@/components/icons/brand'
import { ClubImage } from '@/components/site/club-image'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { socialPlatformLabels } from '@/lib/labels'
import { whatsappUrl } from '@/lib/links'
import type { SocialLinkDTO, SocialPlatform, SocialPostDTO } from '../dto'

export const SOCIAL_ICONS: Record<SocialPlatform, ComponentType<SVGProps<SVGSVGElement>>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: TikTokIcon,
  youtube: YouTubeIcon,
  x: XIcon,
}

/**
 * Publicación curada del feed de redes (especificación 2.9): imagen liviana que enlaza a la publicación
 * original, sin scripts de terceros.
 */
export function SocialPostCard({ post, className }: { post: SocialPostDTO; className?: string }) {
  const Icon = SOCIAL_ICONS[post.platform]
  const platform = socialPlatformLabels[post.platform]
  const body = (
    <>
      {post.image && (
        <ClubImage
          image={post.image}
          alt=""
          sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
          className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />
      )}
      <span className="theme-dark absolute inset-x-0 bottom-0 flex items-end gap-2 bg-linear-to-t from-ink/90 to-transparent bg-transparent p-3 pt-10 text-sm font-medium text-paper">
        <Icon className="size-4 shrink-0" />
        <span className="line-clamp-2">{post.excerpt ?? `Publicación en ${platform}`}</span>
      </span>
    </>
  )
  const box = cn('group relative block aspect-square overflow-hidden rounded-md bg-(--surface)', className)
  if (!post.permalink) return <div className={box}>{body}</div>
  return (
    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={box}>
      {body}
      <span className="sr-only">. Ver en {platform} (se abre en una pestaña nueva)</span>
    </a>
  )
}

/** Botones para seguir al club en sus redes. */
export function SocialFollowLinks({ links, className }: { links: SocialLinkDTO[]; className?: string }) {
  if (links.length === 0) return null
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {links.map((link) => {
        const Icon = SOCIAL_ICONS[link.platform]
        return (
          <li key={link.platform}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${socialPlatformLabels[link.platform]} del club (se abre en una pestaña nueva)`}
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
            >
              <Icon />
            </a>
          </li>
        )
      })}
    </ul>
  )
}

type WhatsAppButtonProps = {
  /** Número del club en E.164 (viene de Configuración, nunca fijo en el código). */
  phone: string
  /** Mensaje prellenado. */
  message?: string
  children?: string
  variant?: 'primary' | 'outline' | 'dark'
  className?: string
}

/** CTA contextual de WhatsApp. No hay botón flotante: taparía la barra inferior (especificación 4.5). */
export function WhatsAppButton({
  phone,
  message,
  children = 'Escríbenos por WhatsApp',
  variant = 'outline',
  className,
}: WhatsAppButtonProps) {
  return (
    <a
      href={whatsappUrl(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant }), className)}
    >
      <WhatsAppIcon />
      {children}
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  )
}
