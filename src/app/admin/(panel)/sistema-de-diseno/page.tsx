import { Inbox } from 'lucide-react'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import type { ReactNode } from 'react'
import {
  BallIcon,
  CardIcon,
  PenaltyMissIcon,
  PitchIcon,
  SecondYellowIcon,
  SubstitutionIcon,
  WhistleIcon,
} from '@/components/icons/football'
import { ShareBar } from '@/components/site/share-bar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, EmptyState, Skeleton, Toast } from '@/components/ui/feedback'
import { CheckboxField, Field, SelectField, TextareaField } from '@/components/ui/field'
import { Pagination } from '@/components/ui/pagination'
import {
  sampleEvent,
  sampleEvents,
  sampleMatches,
  sampleNews,
  sampleSocialPosts,
  sampleSponsors,
  sampleStandings,
} from '@/features/design-system/samples'
import { EventCard } from '@/features/events/components/event-card'
import { Countdown } from '@/features/matches/components/countdown'
import { EventTimeline } from '@/features/matches/components/event-timeline'
import { MatchCard } from '@/features/matches/components/match-card'
import { MatchdayStrip } from '@/features/matches/components/matchday-strip'
import { LiveBadge, Scoreboard } from '@/features/matches/components/scoreboard'
import { SeriesTabs } from '@/features/matches/components/series-tabs'
import { StandingsTable } from '@/features/matches/components/standings-table'
import { NewsCard } from '@/features/news/components/news-card'
import { SocialPostCard, WhatsAppButton } from '@/features/social/components/social-post-card'
import { SponsorStrip } from '@/features/sponsors/components/sponsor-strip'
import { requirePanelUser } from '@/lib/auth/session'
import { formatLongDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Sistema de diseño' }

const COLORS = [
  ['ink', 'bg-ink', 'Negro base'],
  ['paper', 'bg-paper', 'Blanco base'],
  ['accent', 'bg-accent', 'Naranja del león: botones y detalles'],
  ['accent-strong', 'bg-accent-strong', 'Acento para texto y enlaces sobre blanco'],
  ['accent-soft', 'bg-accent-soft', 'Fondos sutiles'],
  ['live', 'bg-live', 'EN VIVO'],
  ['success', 'bg-success', 'Éxito'],
  ['danger', 'bg-danger', 'Error'],
  ['neutral-50', 'bg-neutral-50', ''],
  ['neutral-100', 'bg-neutral-100', ''],
  ['neutral-200', 'bg-neutral-200', 'Bordes'],
  ['neutral-300', 'bg-neutral-300', ''],
  ['neutral-400', 'bg-neutral-400', 'Texto secundario en secciones oscuras'],
  ['neutral-500', 'bg-neutral-500', 'Texto secundario mínimo sobre blanco'],
  ['neutral-600', 'bg-neutral-600', 'Texto secundario sobre grises'],
  ['neutral-700', 'bg-neutral-700', ''],
  ['neutral-800', 'bg-neutral-800', ''],
  ['neutral-900', 'bg-neutral-900', ''],
] as const

const SECTIONS = [
  ['colores', 'Colores'],
  ['tipografia', 'Tipografía'],
  ['botones', 'Botones y etiquetas'],
  ['formularios', 'Formularios'],
  ['avisos', 'Avisos y estados'],
  ['partidos', 'Partidos'],
  ['contenido', 'Contenido'],
  ['iconos', 'Íconos'],
] as const

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="grid gap-4 border-t border-neutral-200 pt-6">
      <h2 id={`${id}-titulo`} className="text-h2">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Example({ title, children, dark = false }: { title: string; children: ReactNode; dark?: boolean }) {
  return (
    <div className="grid gap-2">
      <h3 className="text-meta font-semibold text-neutral-600">{title}</h3>
      <div
        className={
          dark ? 'theme-dark rounded-lg p-4' : 'theme-light rounded-lg border border-neutral-200 p-4'
        }
      >
        {children}
      </div>
    </div>
  )
}

/** Página viva del sistema de diseño (especificación 4.5): tokens, tipografía y componentes con sus estados. */
export default async function DesignSystemPage() {
  await requirePanelUser()
  // Las muestras usan fechas relativas a ahora: la página se renderiza siempre en el momento.
  await connection()
  const matches = sampleMatches(new Date())
  const [featured, comunicado] = sampleNews

  return (
    <div className="grid gap-8">
      <div className="grid gap-2">
        <h1 className="text-h1">Sistema de diseño</h1>
        <p className="text-neutral-600">
          Tokens, tipografía y componentes del sitio con sus estados. Los datos de esta página son de muestra.
        </p>
        <nav aria-label="Secciones de esta página">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {SECTIONS.map(([id, title]) => (
              <li key={id}>
                <a
                  href={`#${id}-titulo`}
                  className="inline-flex min-h-11 items-center text-(--link) underline"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <Section id="colores" title="Colores">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLORS.map(([name, className, use]) => (
            <li key={name} className="grid gap-1">
              <span className={`h-14 rounded-md border border-neutral-200 ${className}`} />
              <span className="text-sm font-semibold">{name}</span>
              {use && <span className="text-sm text-neutral-600">{use}</span>}
            </li>
          ))}
        </ul>
        <Alert variant="warning" title="Uso del naranja">
          Sobre blanco, el naranja del escudo (<code>accent</code>) no alcanza contraste para texto ni
          indicadores: ahí se usa <code>accent-strong</code>. Sobre negro, <code>accent</code> cumple AA.
        </Alert>
      </Section>

      <Section id="tipografia" title="Tipografía">
        <div className="grid gap-4 overflow-hidden">
          <p className="text-display">Display</p>
          <p className="text-h1">Título H1</p>
          <p className="text-h2">Título H2</p>
          <p className="text-h3">Título H3</p>
          <p className="max-w-[68ch] text-lg leading-relaxed">
            Texto: Archivo a ancho normal. El ancho de lectura máximo es de 68 caracteres para que las
            noticias se lean cómodas en cualquier pantalla.
          </p>
          <p className="text-meta text-neutral-600">Meta / pequeño: fechas, categorías y pies de foto.</p>
          <p className="text-eyebrow text-accent-strong">Rótulo · Desde 1934</p>
          <p className="text-score">3-1</p>
        </div>
      </Section>

      <Section id="botones" title="Botones y etiquetas">
        <Example title="Variantes">
          <div className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="dark">Oscuro</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Eliminar</Button>
            <Button variant="link">Enlace</Button>
          </div>
        </Example>
        <Example title="Estados: deshabilitado y cargando">
          <div className="flex flex-wrap gap-3">
            <Button disabled>Deshabilitado</Button>
            <Button loading>Guardando…</Button>
            <Button variant="dark" size="lg">
              Grande (panel)
            </Button>
            <Button variant="outline" size="sm">
              Compacto
            </Button>
          </div>
        </Example>
        <Example title="Sobre fondo oscuro" dark>
          <div className="flex flex-wrap gap-3">
            <Button>Primario</Button>
            <Button variant="light">Claro</Button>
            <Button variant="outline">Contorno</Button>
            <a href="#botones-titulo" className={buttonVariants({ variant: 'link' })}>
              Enlace
            </a>
          </div>
        </Example>
        <Example title="Etiquetas">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutra</Badge>
            <Badge variant="dark">Comunicado oficial</Badge>
            <Badge variant="accent">Destacada</Badge>
            <Badge variant="soft">Completada</Badge>
            <Badge variant="outline">Contorno</Badge>
            <Badge variant="success">Publicada</Badge>
            <Badge variant="danger">Error</Badge>
            <LiveBadge />
          </div>
        </Example>
      </Section>

      <Section id="formularios" title="Formularios">
        <Example title="Campos: reposo, con ayuda, con error y deshabilitado">
          <div className="grid gap-4">
            <Field name="ds-nombre" label="Nombre completo" autoComplete="off" />
            <Field
              name="ds-celular"
              label="Celular"
              help="Con código de país, por ejemplo +56 9 1234 5678."
            />
            <Field
              name="ds-correo"
              label="Correo"
              defaultValue="correo-sin-arroba"
              error="Escribe un correo válido."
            />
            <Field name="ds-fijo" label="Fundación" defaultValue="1 de abril de 1934" disabled />
            <SelectField name="ds-serie" label="Serie" defaultValue="honor">
              <option value="honor">Honor</option>
              <option value="segunda">Segunda</option>
            </SelectField>
            <TextareaField name="ds-mensaje" label="Mensaje" help="Máximo 280 caracteres." />
            <CheckboxField name="ds-privacidad" label="Acepto la política de privacidad." />
            <CheckboxField
              name="ds-privacidad-error"
              label="Acepto la política de privacidad."
              error="Debes aceptar la política para continuar."
            />
          </div>
        </Example>
      </Section>

      <Section id="avisos" title="Avisos y estados">
        <div className="grid gap-3">
          <Alert title="Información">Los cambios se publican al guardar.</Alert>
          <Alert variant="success" title="Listo">
            La noticia quedó publicada.
          </Alert>
          <Alert variant="warning" title="Atención">
            Este álbum contiene fotos de menores.
          </Alert>
          <Alert variant="danger" title="No se pudo guardar">
            Revisa tu conexión e inténtalo de nuevo.
          </Alert>
        </div>
        <Example title="Avisos breves del panel (toast)">
          <div className="grid gap-3">
            <Toast>Gol registrado.</Toast>
            <Toast variant="danger">No se pudo registrar el gol.</Toast>
            <Toast
              variant="info"
              action={
                <Button variant="link" className="text-paper">
                  Deshacer
                </Button>
              }
            >
              Evento eliminado.
            </Toast>
          </div>
        </Example>
        <Example title="Cargando (skeleton) y estado vacío">
          <div className="grid gap-4">
            <div className="grid gap-2" role="status" aria-label="Cargando contenido">
              <Skeleton className="h-40" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
            <EmptyState
              icon={<Inbox aria-hidden="true" />}
              title="Todavía no hay noticias"
              action={<Button variant="dark">Nueva noticia</Button>}
            >
              Publica la primera noticia para que aparezca en la portada.
            </EmptyState>
          </div>
        </Example>
        <Example title="Paginación">
          <Pagination page={4} totalPages={12} hrefFor={(page) => `?pagina=${page}#avisos-titulo`} />
        </Example>
        <Example title="Tarjeta">
          <Card interactive className="max-w-sm">
            <CardHeader>
              <CardTitle>Título de la tarjeta</CardTitle>
            </CardHeader>
            <CardContent>Contenido de la tarjeta. Se eleva al pasar el cursor.</CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Acción
              </Button>
            </CardFooter>
          </Card>
        </Example>
      </Section>

      <Section id="partidos" title="Partidos">
        <Example title="Franja matchday: próximo partido (con cuenta regresiva)">
          <MatchdayStrip
            matchday={{ kind: 'next', match: matches.scheduled, alsoToday: matches.alsoToday }}
          />
        </Example>
        <Example title="Franja matchday: en vivo (varios partidos, carrusel)">
          <MatchdayStrip matchday={{ kind: 'live', matches: [matches.live, matches.liveSecond] }} />
        </Example>
        <Example title="Franja matchday: último resultado">
          <MatchdayStrip matchday={{ kind: 'last', match: matches.finished }} />
        </Example>
        <Example title="Marcador sobre fondo oscuro" dark>
          <Scoreboard match={matches.finished} size="lg" />
        </Example>
        <Example title="Tarjetas de partido: programado, en vivo, finalizado, W.O., penales y postergado">
          <div className="grid gap-4 sm:grid-cols-2">
            <MatchCard match={matches.scheduled} />
            <MatchCard match={matches.live} />
            <MatchCard match={matches.finished} />
            <MatchCard match={matches.walkover} />
            <MatchCard match={matches.penalties} />
            <MatchCard match={matches.postponed} />
          </div>
        </Example>
        <Example title="Tarjeta compacta">
          <MatchCard match={matches.finished} variant="compact" />
          <MatchCard match={matches.scheduled} variant="compact" />
        </Example>
        <Example title="Cuenta regresiva">
          <Countdown
            target={matches.scheduled.kickoffAt}
            label={formatLongDateTime(matches.scheduled.kickoffAt)}
          />
        </Example>
        <Example title="Cronología de eventos">
          <EventTimeline events={sampleEvents} homeName="Cachorros" awayName="Rival A" />
        </Example>
        <Example title="Pestañas de series (por URL)">
          <SeriesTabs
            series={[
              { slug: 'honor', name: 'Honor' },
              { slug: 'segunda', name: 'Segunda' },
              { slug: 'tercera', name: 'Tercera' },
              { slug: 'senior-35', name: 'Senior 35' },
              { slug: 'senior-45', name: 'Senior 45' },
            ]}
            activeSlug="honor"
            hrefFor={(slug) => `?serie=${slug}#partidos-titulo`}
          />
        </Example>
        <Example title="Tabla de posiciones completa (primera columna fija)">
          <StandingsTable standings={sampleStandings} />
        </Example>
        <Example title="Tabla compacta (portada)">
          <StandingsTable standings={sampleStandings} compact />
        </Example>
      </Section>

      <Section id="contenido" title="Contenido">
        {featured && comunicado && (
          <>
            <Example title="Noticia destacada">
              <NewsCard news={featured} variant="featured" />
            </Example>
            <Example title="Noticia estándar y comunicado">
              <div className="grid gap-6 sm:grid-cols-2">
                <NewsCard news={featured} />
                <NewsCard news={comunicado} />
              </div>
            </Example>
            <Example title="Noticia compacta">
              <NewsCard news={comunicado} variant="compact" />
            </Example>
          </>
        )}
        <Example title="Evento (afiche 4:5)">
          <div className="max-w-xs">
            <EventCard event={sampleEvent} />
          </div>
        </Example>
        <Example title="Auspiciadores por nivel">
          <SponsorStrip sponsors={sampleSponsors} />
        </Example>
        <Example title="Publicaciones de redes">
          <div className="grid max-w-md grid-cols-2 gap-3">
            {sampleSocialPosts.map((post) => (
              <SocialPostCard key={post.id} post={post} />
            ))}
          </div>
        </Example>
        <Example title="WhatsApp y compartir">
          <div className="grid gap-4">
            <div>
              <WhatsAppButton phone="+56900000000" message="Hola, tengo una consulta." />
            </div>
            <ShareBar url="https://example.com/noticias/muestra" title="Titular de muestra" />
          </div>
        </Example>
      </Section>

      <Section id="iconos" title="Íconos">
        <Example title="Set de fútbol (trazo propio, mismo grosor que Lucide)">
          <ul className="flex flex-wrap gap-6">
            {(
              [
                ['Gol', <BallIcon key="i" />],
                ['Tarjeta amarilla', <CardIcon key="i" className="text-[#f5c518]" />],
                ['Tarjeta roja', <CardIcon key="i" className="text-live" />],
                ['Segunda amarilla', <SecondYellowIcon key="i" />],
                ['Cambio', <SubstitutionIcon key="i" />],
                ['Penal errado', <PenaltyMissIcon key="i" />],
                ['Silbato', <WhistleIcon key="i" />],
                ['Cancha', <PitchIcon key="i" />],
              ] as const
            ).map(([name, icon]) => (
              <li key={name} className="grid justify-items-center gap-1 text-sm">
                <span className="[&_svg]:size-8">{icon}</span>
                {name}
              </li>
            ))}
          </ul>
        </Example>
      </Section>
    </div>
  )
}
