import {
  HeroSection,
  LatestResultsSection,
  NewsSection,
  QuickAccessSection,
  SocialSection,
  SponsorsSection,
  StandingsSection,
} from '@/components/site/home-sections'

/**
 * Portada (especificación 5.3), en capas. Cada capa lee sus datos en runtime (el build no toca la BD)
 * desde consultas cacheadas por tags, y todas se resuelven en paralelo. No hay <Suspense> por capa: el
 * HTML llega completo, sin saltos de layout y legible sin JavaScript.
 */
export default function HomePage() {
  return (
    <>
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
