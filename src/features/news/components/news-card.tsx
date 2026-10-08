import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatShortDate } from '@/lib/format'
import { newsTypeLabels } from '@/lib/labels'
import type { NewsCardDTO } from '../dto'

type NewsCardProps = {
  news: NewsCardDTO
  /** `featured`: la destacada grande · `standard`: tarjeta de grilla · `compact`: fila con miniatura. */
  variant?: 'featured' | 'standard' | 'compact'
  /** La imagen es candidata a LCP (solo la primera de la página). */
  priority?: boolean
  /** Nivel del encabezado del título, según dónde se use la tarjeta. */
  headingLevel?: 'h2' | 'h3'
  className?: string
}

const SIZES = {
  featured: '(min-width: 1024px) 60vw, 100vw',
  standard: '(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw',
  compact: '112px',
} as const

function Meta({ news }: { news: NewsCardDTO }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-(--muted)">
      {news.type === 'comunicado' ? (
        <Badge variant="dark">{newsTypeLabels.comunicado}</Badge>
      ) : (
        news.categoryName && <span className="font-bold text-(--link) uppercase">{news.categoryName}</span>
      )}
      <time dateTime={news.publishedAt}>{formatShortDate(news.publishedAt)}</time>
    </p>
  )
}

/** Tarjeta de noticia. Toda la tarjeta es clicable, con un único enlace (el título) para el teclado. */
export function NewsCard({
  news,
  variant = 'standard',
  priority = false,
  headingLevel: Heading = 'h3',
  className,
}: NewsCardProps) {
  const href = `/noticias/${news.slug}`
  const link = (
    <Link href={href} className="after:absolute after:inset-0 hover:underline hover:underline-offset-4">
      {news.title}
    </Link>
  )

  if (variant === 'compact') {
    return (
      <article className={cn('relative grid grid-cols-[7rem_1fr] items-center gap-4', className)}>
        <div className="aspect-[4/3] overflow-hidden rounded-md bg-(--surface)">
          {news.cover && (
            <ClubImage image={news.cover} alt="" sizes={SIZES.compact} className="size-full object-cover" />
          )}
        </div>
        <div className="grid gap-1">
          <Meta news={news} />
          <Heading className="leading-snug font-bold">{link}</Heading>
        </div>
      </article>
    )
  }

  const featured = variant === 'featured'
  return (
    <article className={cn('group relative grid content-start gap-3', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-lg bg-(--surface)',
          featured ? 'aspect-[16/10]' : 'aspect-[16/9]',
        )}
      >
        {news.cover && (
          <ClubImage
            image={news.cover}
            alt=""
            sizes={SIZES[variant]}
            priority={priority}
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        )}
      </div>
      <Meta news={news} />
      <Heading className={featured ? 'text-h2' : 'text-xl leading-snug font-bold'}>{link}</Heading>
      {news.excerpt && (
        <p className={cn('text-(--muted)', featured ? 'line-clamp-3 text-lg' : 'line-clamp-2')}>
          {news.excerpt}
        </p>
      )}
    </article>
  )
}
