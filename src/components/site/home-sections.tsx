import { CalendarDays, ShoppingBag, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { getUpcomingEvents } from '@/features/events/queries'
import { HeroMatchday } from '@/features/matches/components/hero-matchday'
import { LiveMatchday, LiveMatchdayProvider } from '@/features/matches/components/live-matchday'
import { MatchCard } from '@/features/matches/components/match-card'
import { StandingsTable } from '@/features/matches/components/standings-table'
import { livePollBaseMs } from '@/features/matches/live-queries'
import { getFeaturedStandings, getLatestResults, getMatchday } from '@/features/matches/queries'
import { NewsCard } from '@/features/news/components/news-card'
import { getHomeNews } from '@/features/news/queries'
import { getSite } from '@/features/settings/queries'
import { SocialFollowLinks, SocialPostCard } from '@/features/social/components/social-post-card'
import { socialFeed } from '@/features/social/provider'
import { SponsorStrip } from '@/features/sponsors/components/sponsor-strip'
import { getActiveSponsors } from '@/features/sponsors/queries'
import { cn } from '@/lib/cn'
import { formatDayMonth } from '@/lib/format'
import { ClubImage } from './club-image'

// Capas de la portada (especificación 5.3). Cada una resuelve sus datos en runtime (`connection()`), dentro
// de su propio <Suspense>, y consume consultas cacheadas por tags. Una capa sin contenido no se renderiza.

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 md:mb-8">
      <h2 className="text-h2 uppercase">{title}</h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-1 font-semibold text-(--link) hover:underline hover:underline-offset-4"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

function Section({ className, children, label }: { className?: string; children: ReactNode; label: string }) {
  return (
    // Sin `content-visibility: auto`: se probó y en esta página triplica el tiempo de layout antes del
    // primer pintado (medido con CPU ×4), en vez de reducirlo.
    <section aria-label={label} className={cn('py-12 md:py-20', className)}>
      <div className="container-site">{children}</div>
    </section>
  )
}

// ── 1 y 2. Hero con las placas + franja matchday ─────────────────────────────────────────────────

// En el celular la portada ocupa el 70 % de la pantalla y las placas quedan en ese espacio, sin desplazarse.
const HERO_HEIGHT = 'min-h-[70svh] lg:min-h-[82svh]'

export async function HeroSection() {
  await connection()
  const [site, matchday] = await Promise.all([getSite(), getMatchday()])
  const hero = site?.hero
  const image = hero?.image
  const mobile = hero?.mobileImage

  const content = (
    <>
      <section
        aria-label="Presentación"
        className={cn('theme-dark relative isolate flex items-end', HERO_HEIGHT)}
      >
        {/* Es el LCP de la página: `priority` la precarga con prioridad alta desde el <head>. */}
        {image && !mobile && (
          <ClubImage
            image={image}
            sizes="100vw"
            priority
            className="absolute inset-0 -z-20 size-full object-cover photo-mono"
          />
        )}
        {image && mobile && (
          // Con foto alternativa para celular se usa <picture>: el navegador descarga solo la que corresponde.
          <picture>
            <source media="(max-width: 767px)" srcSet={mobile.srcSet} sizes="100vw" />
            <ClubImage
              image={image}
              sizes="100vw"
              priority
              className="absolute inset-0 -z-20 size-full object-cover photo-mono"
            />
          </picture>
        )}
        {/* Degradado que asegura el contraste del texto sobre cualquier foto. */}
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink via-ink/75 to-ink/20" />

        <div className="container-site grid gap-4 pt-12 pb-8 md:gap-5 md:pt-24 md:pb-16">
          {/* Sin el escudo grande: el de la barra de navegación ya identifica al club. */}
          <h1 className="text-hero max-w-5xl text-balance">{hero?.title ?? site?.shortName}</h1>
          {hero?.subtitle && <p className="max-w-xl text-lg text-paper/90 md:text-xl">{hero.subtitle}</p>}
          {matchday && (
            <div className="mt-2 md:mt-4">
              <HeroMatchday />
            </div>
          )}
          {hero?.ctaLabel && hero.ctaHref && (
            <div className="mt-2">
              <Link href={hero.ctaHref} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                {hero.ctaLabel}
              </Link>
            </div>
          )}
        </div>
      </section>

      {matchday && (
        <div className="container-site pt-8 md:pt-12">
          <LiveMatchday className="mx-auto max-w-3xl" />
        </div>
      )}
    </>
  )

  // Un solo polling para las placas del hero y la tarjeta de la franja.
  return matchday ? (
    <LiveMatchdayProvider matchday={matchday} pollBaseMs={livePollBaseMs()}>
      {content}
    </LiveMatchdayProvider>
  ) : (
    content
  )
}

// ── 3. Últimos resultados por serie ──────────────────────────────────────────────────────────────

export async function LatestResultsSection() {
  await connection()
  const results = await getLatestResults()
  if (results.length === 0) return null
  return (
    <Section label="Últimos resultados">
      <SectionHeader title="Últimos resultados" href="/partidos" linkLabel="Todos los partidos" />
      {/* Carrusel con desplazamiento nativo: sin JavaScript, sin autoplay y navegable con teclado. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3 xl:grid-cols-4">
        {results.map((match) => (
          <li key={match.id} className="w-[82%] shrink-0 snap-center sm:w-[46%] md:w-auto">
            <MatchCard match={match} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── 4. Noticias ──────────────────────────────────────────────────────────────────────────────────

export async function NewsSection() {
  await connection()
  const [featured, ...rest] = await getHomeNews()
  if (!featured) return null
  return (
    <Section label="Noticias" className="bg-(--surface)">
      <SectionHeader title="Noticias" href="/noticias" linkLabel="Todas las noticias" />
      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <NewsCard news={featured} variant="featured" headingLevel="h3" />
        {rest.length > 0 && (
          <ul className="grid content-start gap-6">
            {rest.map((item) => (
              <li key={item.id}>
                <NewsCard news={item} variant="compact" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  )
}

// ── 5. Accesos rápidos ───────────────────────────────────────────────────────────────────────────

export async function QuickAccessSection() {
  await connection()
  const [nextEvent] = await getUpcomingEvents(1)
  const tiles = [
    {
      href: '/socios',
      icon: UserPlus,
      title: 'Hazte socio',
      text: 'Súmate al club y apoya a todas las series.',
    },
    {
      href: '/tienda',
      icon: ShoppingBag,
      title: 'Tienda',
      text: 'Camisetas, polerones y más. Pide por WhatsApp.',
    },
    {
      href: '/eventos',
      icon: CalendarDays,
      title: 'Próximos eventos',
      text: nextEvent
        ? `${nextEvent.title}, ${formatDayMonth(nextEvent.startsAt)}`
        : 'Completadas, bingos y actividades del club.',
    },
  ]
  return (
    <Section label="Accesos rápidos" className="theme-dark">
      <ul className="grid gap-4 md:grid-cols-3">
        {tiles.map(({ href, icon: Icon, title, text }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full min-h-40 flex-col justify-between gap-6 rounded-lg border border-(--border) bg-(--surface) p-6 transition-colors duration-200 hover:border-accent"
            >
              <Icon aria-hidden="true" className="size-8 text-accent" />
              <span className="grid gap-1">
                <span className="font-display text-3xl font-extrabold uppercase [font-stretch:75%]">
                  {title}
                </span>
                <span className="text-(--muted)">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── 6. Mini-tabla de la serie destacada ──────────────────────────────────────────────────────────

export async function StandingsSection() {
  await connection()
  const standings = await getFeaturedStandings()
  if (!standings) return null
  return (
    <Section label="Tabla de posiciones">
      <div className="mx-auto max-w-3xl">
        <SectionHeader
          title={`Tabla de la serie ${standings.seriesName}`}
          href={`/partidos/posiciones?serie=${standings.seriesSlug}`}
          linkLabel="Tabla completa"
        />
        <StandingsTable standings={standings} compact />
      </div>
    </Section>
  )
}

// ── 7. Redes sociales ────────────────────────────────────────────────────────────────────────────

export async function SocialSection() {
  await connection()
  const [posts, site] = await Promise.all([socialFeed().latest(6), getSite()])
  if (posts.length === 0) return null
  return (
    <Section label="Redes sociales" className="bg-(--surface)">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
        <h2 className="text-h2 uppercase">En redes</h2>
        {site && <SocialFollowLinks links={site.socialLinks} />}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {posts.map((post) => (
          <li key={post.id}>
            <SocialPostCard post={post} />
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ── 8. Auspiciadores ─────────────────────────────────────────────────────────────────────────────

export async function SponsorsSection() {
  await connection()
  const sponsors = await getActiveSponsors()
  if (sponsors.length === 0) return null
  return (
    <Section label="Auspiciadores">
      <h2 className="mb-8 text-center text-h2 uppercase">Nos apoyan</h2>
      <SponsorStrip sponsors={sponsors} />
      <p className="mt-10 text-center">
        <Link href="/auspiciadores" className={buttonVariants({ variant: 'outline' })}>
          ¿Quieres auspiciar al club?
        </Link>
      </p>
    </Section>
  )
}

/** Respaldo de una capa mientras llegan sus datos: reserva una altura parecida a la final. */
export function SectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('py-12 md:py-20', className)}>
      <div className="container-site grid gap-6">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
