import { ClubImage } from '@/components/site/club-image'
import { cn } from '@/lib/cn'
import { sponsorTierLabels } from '@/lib/labels'
import type { SponsorDTO } from '../dto'

const TIERS = ['principal', 'oficial', 'colaborador'] as const

const LOGO_BOX: Record<SponsorDTO['tier'], string> = {
  principal: 'h-24 w-60 md:h-28 md:w-72',
  oficial: 'h-20 w-48',
  colaborador: 'h-16 w-40',
}

function Logo({ sponsor }: { sponsor: SponsorDTO }) {
  // Monocromo en reposo; toma color al pasar el cursor o al enfocar (especificación 4.5).
  const box = cn(
    'grid place-items-center rounded-md px-3 grayscale transition-[filter,opacity] duration-200 ease-out',
    'opacity-80 hover:opacity-100 hover:grayscale-0 focus-visible:opacity-100 focus-visible:grayscale-0',
    LOGO_BOX[sponsor.tier],
  )
  const content = sponsor.logo ? (
    <ClubImage
      image={sponsor.logo}
      alt={sponsor.name}
      sizes="288px"
      className="max-h-full w-auto max-w-full object-contain"
      style={{ backgroundImage: 'none' }}
    />
  ) : (
    <span className="text-center font-semibold">{sponsor.name}</span>
  )
  if (!sponsor.hasLink) return <div className={box}>{content}</div>
  return (
    <a href={`/r/auspiciador/${sponsor.slug}`} rel="noopener sponsored" className={box}>
      {content}
    </a>
  )
}

/** Auspiciadores por nivel: el principal, más grande. Los niveles sin auspiciadores no se muestran. */
export function SponsorStrip({ sponsors, className }: { sponsors: SponsorDTO[]; className?: string }) {
  if (sponsors.length === 0) return null
  return (
    <div className={cn('grid gap-8', className)}>
      {TIERS.map((tier) => {
        const group = sponsors.filter((sponsor) => sponsor.tier === tier)
        if (group.length === 0) return null
        return (
          <div key={tier} className="grid justify-items-center gap-3">
            <h3 className="text-eyebrow text-(--muted)">
              {group.length > 1 && tier !== 'principal'
                ? `${sponsorTierLabels[tier].replace('Auspiciador oficial', 'Auspiciadores oficiales').replace('Colaborador', 'Colaboradores')}`
                : sponsorTierLabels[tier]}
            </h3>
            <ul className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
              {group.map((sponsor) => (
                <li key={sponsor.id}>
                  <Logo sponsor={sponsor} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
