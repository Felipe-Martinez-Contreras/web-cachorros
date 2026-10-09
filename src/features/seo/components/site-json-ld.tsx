import { connection } from 'next/server'
import { loadSiteOrFallback } from '@/components/site/site-frame'
import { sportsTeamJsonLd, webSiteJsonLd } from '../lib/json-ld'
import { siteBaseUrl } from '../metadata'
import { JsonLd } from './json-ld'

/** Datos estructurados del club y del sitio (`SportsTeam` y `WebSite`); van en la portada. */
export async function SiteJsonLd() {
  await connection()
  const site = await loadSiteOrFallback()
  const base = siteBaseUrl()
  return (
    <>
      <JsonLd
        data={sportsTeamJsonLd(
          {
            clubName: site.clubName,
            shortName: site.shortName,
            foundedOn: site.foundedOn,
            commune: site.commune,
            region: site.region,
            logo: site.crest?.src ?? null,
            sameAs: site.socialLinks.map((link) => link.url),
            description: site.seoDescription,
          },
          base,
        )}
      />
      <JsonLd data={webSiteJsonLd(site, base)} />
    </>
  )
}
