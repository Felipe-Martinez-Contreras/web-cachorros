import {
  HeroSection,
  LatestResultsSection,
  NewsSection,
  QuickAccessSection,
  SocialSection,
  SponsorsSection,
  StandingsSection,
} from '@/components/site/home-sections'
import { SiteJsonLd } from '@/features/seo/components/site-json-ld'
import { pageMetadata } from '@/features/seo/metadata'

export function generateMetadata() {
  return pageMetadata({ path: '/' })
}

/**
 * Portada (especificación 5.3), en capas. Cada capa lee sus datos en runtime (el build no toca la BD)
 * desde consultas cacheadas por tags, y todas se resuelven en paralelo. No hay <Suspense> por capa: el
 * HTML llega completo, sin saltos de layout y legible sin JavaScript.
 */
export default function HomePage() {
  return (
    <>
      <SiteJsonLd />
      <HeroSection />
      <LatestResultsSection />
      <NewsSection />
      <QuickAccessSection />
      <StandingsSection />
      <SocialSection />
      <SponsorsSection />
    </>
  )
}
