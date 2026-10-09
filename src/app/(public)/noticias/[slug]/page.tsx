import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { connection } from 'next/server'
import { Breadcrumbs } from '@/components/site/page-shell'
import { ShareBar } from '@/components/site/share-bar'
import { loadSiteOrFallback } from '@/components/site/site-frame'
import { badgeVariants } from '@/components/ui/badge'
import { NewsArticle } from '@/features/news/components/news-article'
import { NewsCard } from '@/features/news/components/news-card'
import { newsListHref } from '@/features/news/lib/public-params'
import { getNewsDetail, resolveNewsRedirect } from '@/features/news/public-queries'
import { JsonLd } from '@/features/seo/components/json-ld'
import { newsArticleJsonLd } from '@/features/seo/lib/json-ld'
import { ogImageOf } from '@/features/seo/lib/og-image'
import { pageMetadata, siteBaseUrl } from '@/features/seo/metadata'
import { env } from '@/lib/env'

type Props = { params: Promise<{ slug: string }> }

async function loadNews(slug: string) {
  // Los datos se leen en runtime: sin esto, el build intentaría consultar la base (especificación 3.4).
  await connection()
  const detail = await getNewsDetail(slug)
  if (detail) return detail
  // Segunda barrera (el 404 y el 301 reales los responde el proxy, ADR 0008).
  const current = await resolveNewsRedirect(slug)
  if (current) permanentRedirect(`/noticias/${current}`)
  notFound()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const news = await loadNews((await params).slug)
  return pageMetadata({
    title: news.seoTitle ?? news.title,
    description: news.seoDescription ?? news.excerpt,
    path: `/noticias/${news.slug}`,
    image: news.shareImage,
    article: { publishedTime: news.publishedAt, modifiedTime: news.updatedAt, section: news.categoryName },
  })
}

export default async function NewsPage({ params }: Props) {
  const news = await loadNews((await params).slug)
  const site = await loadSiteOrFallback()

  return (
    <NewsArticle
      news={news}
      breadcrumbs={
        <Breadcrumbs
          items={[
            { href: '/', label: 'Inicio' },
            { href: '/noticias', label: 'Noticias' },
            ...(news.categoryName && news.categorySlug
              ? [{ href: newsListHref({ category: news.categorySlug }), label: news.categoryName }]
              : []),
          ]}
        />
      }
    >
      <JsonLd
        data={newsArticleJsonLd(
          { ...news, image: ogImageOf(news.shareImage)?.url ?? null },
          { clubName: site.clubName, logo: site.crest?.src ?? null },
          siteBaseUrl(),
        )}
      />
      {news.series.length > 0 && (
        <ul aria-label="Series de esta noticia" className="flex flex-wrap gap-2">
          {news.series.map((item) => (
            <li key={item.slug}>
              <Link
                href={newsListHref({ series: item.slug })}
                className={badgeVariants({ variant: 'neutral', className: 'min-h-11 px-3 text-sm' })}
              >
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-(--border) pt-6">
        <ShareBar url={`${env.SITE_URL}/noticias/${news.slug}`} title={news.title} />
      </div>

      {news.related.length > 0 && (
        <section aria-labelledby="relacionadas" className="grid gap-4 border-t border-(--border) pt-6">
          <h2 id="relacionadas" className="text-h2 uppercase">
            Más noticias
          </h2>
          <ul className="grid gap-5">
            {news.related.map((item) => (
              <li key={item.id}>
                <NewsCard news={item} variant="compact" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </NewsArticle>
  )
}
