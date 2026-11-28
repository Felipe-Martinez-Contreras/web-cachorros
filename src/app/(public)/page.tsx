import {
  HeroSection,
  MatchCenterSection,
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
type Props = { searchParams: Promise<{ serie?: string | string[] }> }

export default function HomePage({ searchParams }: Props) {
  // La serie del centro de partidos (`/?serie=tercera#partidos`); el resto de la portada no depende de ella.
  const serie = searchParams.then(({ serie }) => (typeof serie === 'string' ? serie : null))
  return (
    <>
      <SiteJsonLd />
      <HeroSection />
      <MatchCenterSection serie={serie} />
      <NewsSection />
      <QuickAccessSection />
      <StandingsSection />
      <SocialSection />
      <SponsorsSection />
    </>
  )
}
