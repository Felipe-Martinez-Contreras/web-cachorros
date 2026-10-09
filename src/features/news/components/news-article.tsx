import Link from 'next/link'
import type { ReactNode } from 'react'
import { ClubImage } from '@/components/site/club-image'
import { RichText } from '@/components/site/rich-text'
import { Badge } from '@/components/ui/badge'
import { Scoreboard } from '@/features/matches/components/scoreboard'
import { formatLongDate } from '@/lib/format'
import { newsTypeLabels } from '@/lib/labels'
import type { NewsDetailDTO } from '../dto'

export type NewsArticleData = Pick<
  NewsDetailDTO,
  'title' | 'type' | 'categoryName' | 'cover' | 'body' | 'bodyImages' | 'match'
> & {
  /** `null` en la vista previa de una noticia que todavía no se publica. */
  publishedAt: string | null
}

/**
 * Cuerpo de una noticia: encabezado oscuro (con el marcador si es una crónica), foto principal y texto.
 * Lo usan la página pública y la vista previa del panel, para que se vean igual.
 */
export function NewsArticle({
  news,
  breadcrumbs,
  children,
}: {
  news: NewsArticleData
  breadcrumbs?: ReactNode
  /** Lo que va después del texto: series, compartir y noticias relacionadas. */
  children?: ReactNode
}) {
  const showScore = news.type === 'cronica' && news.match !== null
  return (
    <article>
      <header className="theme-dark">
        <div className="container-site grid grid-cols-1 gap-3 pt-4 pb-8 md:pb-12">
          {breadcrumbs}
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-meta text-(--muted)">
            {news.type === 'comunicado' ? (
              <Badge variant="accent">{newsTypeLabels.comunicado}</Badge>
            ) : (
              <span className="text-eyebrow text-accent">
                {news.categoryName ?? newsTypeLabels[news.type]}
              </span>
            )}
            {news.publishedAt ? (
              <time dateTime={news.publishedAt}>{formatLongDate(news.publishedAt)}</time>
            ) : (
              <span>Sin publicar</span>
            )}
          </p>
          <h1 className="max-w-4xl text-h1 normal-case">{news.title}</h1>
          {showScore && news.match && (
            <div className="mt-4 grid max-w-xl gap-2 justify-self-center">
              <Scoreboard match={news.match} size="lg" />
              <p className="text-center text-meta">
                <Link href={`/partidos/${news.match.slug}`} className="underline underline-offset-4">
                  Ver el detalle del partido
                </Link>
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="container-site grid max-w-3xl grid-cols-1 gap-8 py-8 md:py-12">
        {news.cover && (
          <figure className="grid gap-2">
            <ClubImage
              image={news.cover}
              sizes="(min-width: 768px) 720px, 100vw"
              priority
              className="aspect-[16/9] w-full rounded-lg object-cover"
            />
            {news.cover.credit && (
              <figcaption className="text-meta text-(--muted)">Foto: {news.cover.credit}</figcaption>
            )}
          </figure>
        )}
        <RichText doc={news.body} images={news.bodyImages} />
        {!showScore && news.match && (
          <p>
            <Link href={`/partidos/${news.match.slug}`} className="font-semibold text-(--link) underline">
              Partido relacionado: {news.match.home.shortName} vs {news.match.away.shortName} ·{' '}
              {news.match.seriesName}
            </Link>
          </p>
        )}
        {children}
      </div>
    </article>
  )
}
