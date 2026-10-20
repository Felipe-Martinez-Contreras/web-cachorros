import { ExternalLink } from 'lucide-react'
import { ClubImage } from '@/components/site/club-image'
import { buttonVariants } from '@/components/ui/button'
import { sponsorTierLabels } from '@/lib/labels'
import type { SponsorDTO } from '../dto'
import { sponsorLinkLabels } from '../lib/links'

const TIERS = ['principal', 'oficial', 'colaborador'] as const

const TIER_TITLES: Record<SponsorDTO['tier'], string> = {
  principal: 'Auspiciador principal',
  oficial: 'Auspiciadores oficiales',
  colaborador: 'Colaboradores',
}

function SponsorCard({ sponsor }: { sponsor: SponsorDTO }) {
  return (
    <li className="grid content-start gap-3 rounded-lg border border-(--border) bg-(--surface) p-5">
      <div className="grid h-24 place-items-center rounded-md bg-white p-3">
        {sponsor.logo ? (
          <ClubImage
            image={sponsor.logo}
            alt={sponsor.name}
            sizes="288px"
            className="max-h-full w-auto max-w-full object-contain"
            style={{ backgroundImage: 'none' }}
          />
        ) : (
          <span className="text-center font-semibold text-ink">{sponsor.name}</span>
        )}
      </div>
      <h3 className="text-h3">{sponsor.name}</h3>
      <p className="sr-only">{sponsorTierLabels[sponsor.tier]}</p>
      {sponsor.description && <p className="text-(--muted)">{sponsor.description}</p>}
      {sponsor.links.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {sponsor.links.map((link) => (
            <li key={link}>
              {/* Pasa por /r/auspiciador, que cuenta el clic del día (sin datos personales). */}
              <a
                href={`/r/auspiciador/${sponsor.slug}?a=${link}`}
                rel="noopener sponsored"
                target="_blank"
                aria-label={`${sponsorLinkLabels[link]} de ${sponsor.name} (se abre en una pestaña nueva)`}
                className={buttonVariants({ variant: 'outline' })}
              >
                {sponsorLinkLabels[link]} <ExternalLink aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Vitrina de la página Auspiciadores: tarjetas por nivel con descripción y enlaces. */
export function SponsorShowcase({ sponsors }: { sponsors: SponsorDTO[] }) {
  return (
    <div className="grid gap-10">
      {TIERS.map((tier) => {
        const group = sponsors.filter((sponsor) => sponsor.tier === tier)
        if (group.length === 0) return null
        return (
          <section key={tier} aria-labelledby={`nivel-${tier}`} className="grid gap-4">
            <h2 id={`nivel-${tier}`} className="text-h2 uppercase">
              {TIER_TITLES[tier]}
            </h2>
            <ul className={tier === 'principal' ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
              {group.map((sponsor) => (
                <SponsorCard key={sponsor.id} sponsor={sponsor} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
