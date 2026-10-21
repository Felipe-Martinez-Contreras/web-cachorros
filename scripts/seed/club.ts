import { eq, inArray } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import {
  boardMembers,
  contactMessages,
  documents,
  events,
  members,
  membershipPlans,
  membershipRequests,
  productCategories,
  productImages,
  products,
  productVariants,
  siteSettings,
  sponsors,
  sponsorshipInquiries,
} from '@/db/schema'
import { santiagoDateTime } from '@/features/matches/lib/countdown'
import { toIsoDate } from '@/lib/format'
import { CLUB, EXAMPLE_PHONE, PRODUCTS, SPONSORS } from './data'
import type { SeedMedia } from './media'
import type { SportSeed } from './sport'
import { richText, seedId, upsert } from './util'

export type ClubSeed = {
  /** Último aniversario ya cumplido (1 de abril más reciente). */
  anniversary: { number: number; date: string }
  eventId: (key: 'aniversario' | 'completada' | 'bingo') => string
}

type Options = { tx: Tx; now: Date; media: SeedMedia; sport: SportSeed }

export async function seedClub({ tx, now, media, sport }: Options): Promise<ClubSeed> {
  // ── Configuración: lo confirmado es real; lo demás queda marcado ─────────────────────────────
  const settings = {
    clubName: CLUB.name,
    shortName: CLUB.shortName,
    foundedOn: CLUB.foundedOn,
    // Número de ejemplo: permite mostrar los botones de WhatsApp en la demo. [COMPLETAR: WhatsApp del club]
    whatsappE164: EXAMPLE_PHONE,
    address: '[COMPLETAR: dirección de la cancha]',
    commune: CLUB.commune,
    region: CLUB.region,
    geoLat: -34.995,
    geoLng: -71.38,
    // Dirección de ejemplo (dominio reservado): muestra el botón de pago en la demo. [COMPLETAR: link de pago real o vacío]
    donationUrl: 'https://example.com/aporta-a-los-cachorros',
    bankDetails: {
      holder: '[COMPLETAR: titular de la cuenta]',
      rut: '[COMPLETAR: RUT del club]',
      bank: '[COMPLETAR: banco]',
      accountType: '[COMPLETAR: tipo de cuenta]',
      accountNumber: '[COMPLETAR: número de cuenta]',
      email: '[COMPLETAR: correo para comprobantes]',
    },
    hero: {
      title: 'Los Cachorros',
      subtitle: 'Fútbol amateur de Sagrada Familia desde 1934.',
      ctaLabel: 'Hazte socio',
      ctaHref: '/socios',
      mediaId: media.id('hero'),
      ...(media.rows.some((row) => row.id === seedId('media:hero-movil'))
        ? { mobileMediaId: media.id('hero-movil') }
        : null),
    },
    featuredSeriesId: sport.seriesId('honor'),
    // Direcciones de ejemplo (dominio reservado .test): en desarrollo, los avisos llegan a Mailpit.
    // [COMPLETAR: correos de la directiva que reciben los avisos de cada formulario]
    notifyRecipients: {
      socios: ['socios@cachorros.test'],
      auspicios: ['auspicios@cachorros.test'],
      contacto: ['contacto@cachorros.test'],
    },
    seoDefaults: {
      description: `Sitio oficial del ${CLUB.name} de Sagrada Familia. Partidos, resultados, noticias y más. Desde 1934.`,
    },
  }
  const updated = await tx
    .update(siteSettings)
    .set(settings)
    .where(eq(siteSettings.id, 1))
    .returning({ id: siteSettings.id })
  if (updated.length === 0) await tx.insert(siteSettings).values({ id: 1, ...settings })

  // ── Eventos (3) ──────────────────────────────────────────────────────────────────────────────
  const today = toIsoDate(now)
  const year = Number(today.slice(0, 4))
  const anniversaryYear = today >= `${year}-04-01` ? year : year - 1
  const anniversary = { number: anniversaryYear - 1934, date: `${anniversaryYear}-04-01` }
  const eventId = (key: string) => seedId(`event:${key}`)

  await upsert(tx, events, [
    {
      id: eventId('aniversario'),
      title: `Aniversario ${anniversary.number} del club`,
      slug: `aniversario-${anniversary.number}`,
      type: 'aniversario',
      startsAt: new Date(`${anniversary.date}T23:00:00Z`),
      locationText: 'Cancha del club',
      venueId: sport.homeVenueId,
      posterMediaId: media.id('event:aniversario'),
      description: richText(
        `Celebración de los ${anniversary.number} años del ${CLUB.name}, fundado el 1 de abril de 1934.`,
        '[COMPLETAR: programa real de la celebración]',
      ),
      priceText: '[COMPLETAR: valor de la adhesión]',
      status: 'realizado',
      isPublished: true,
    },
    {
      id: eventId('completada'),
      title: 'Gran completada a beneficio de las series',
      slug: 'completada-a-beneficio',
      type: 'completada',
      startsAt: santiagoDateTime(now, 5, 13),
      endsAt: santiagoDateTime(now, 5, 17),
      locationText: 'Cancha del club',
      venueId: sport.homeVenueId,
      posterMediaId: media.id('event:completada'),
      description: richText(
        'Ven con tu familia a la completada del club. Todo lo reunido va a implementación deportiva y traslados de las series.',
        '[COMPLETAR: valores, promociones y forma de reservar]',
      ),
      priceText: '[COMPLETAR: valor del completo y de la promoción]',
      status: 'programado',
      isPublished: true,
    },
    {
      id: eventId('bingo'),
      title: 'Bingo familiar',
      slug: 'bingo-familiar',
      type: 'bingo',
      startsAt: santiagoDateTime(now, 19, 16),
      endsAt: santiagoDateTime(now, 19, 20),
      locationText: '[COMPLETAR: lugar del bingo]',
      posterMediaId: media.id('event:bingo'),
      description: richText(
        'Una tarde de bingo para compartir en familia y apoyar al club.',
        '[COMPLETAR: premios, valor del cartón y puntos de venta]',
      ),
      priceText: '[COMPLETAR: valor del cartón]',
      status: 'programado',
      isPublished: true,
    },
  ])

  // ── Auspiciadores (4, ficticios) ─────────────────────────────────────────────────────────────
  await upsert(
    tx,
    sponsors,
    SPONSORS.map((sponsor, index) => ({
      id: seedId(`sponsor:${sponsor.slug}`),
      name: sponsor.name,
      slug: sponsor.slug,
      tier: sponsor.tier,
      logoMediaId: media.id(`sponsor:${sponsor.slug}`),
      description: 'Comercio ficticio de ejemplo. [COMPLETAR: auspiciadores reales, niveles y enlaces]',
      // Enlaces de ejemplo (dominio reservado example.com) para probar el conteo de clics.
      websiteUrl: sponsor.tier === 'colaborador' ? null : `https://example.com/${sponsor.slug}`,
      instagramUrl: sponsor.tier === 'principal' ? `https://example.com/instagram/${sponsor.slug}` : null,
      whatsappE164: sponsor.tier === 'colaborador' ? EXAMPLE_PHONE : null,
      sortOrder: index,
    })),
  )

  // ── Tienda (5 productos) ─────────────────────────────────────────────────────────────────────
  const productCategoryId = (slug: string) => seedId(`product-category:${slug}`)
  await upsert(tx, productCategories, [
    { id: productCategoryId('indumentaria'), name: 'Indumentaria', slug: 'indumentaria', sortOrder: 1 },
    { id: productCategoryId('accesorios'), name: 'Accesorios', slug: 'accesorios', sortOrder: 2 },
  ])
  const productId = (slug: string) => seedId(`product:${slug}`)
  await upsert(
    tx,
    products,
    PRODUCTS.map((product, index) => ({
      id: productId(product.slug),
      name: product.name,
      slug: product.slug,
      categoryId: productCategoryId(product.category),
      description: `${product.description} [COMPLETAR: precio y tallas reales; los valores mostrados son de ejemplo]`,
      priceClp: product.priceClp,
      // El polerón muestra el control de stock: una talla sin unidades aparece «Agotada».
      trackStock: product.slug === 'poleron-del-club',
      sortOrder: index,
    })),
  )
  const seededProductIds = PRODUCTS.map((product) => productId(product.slug))
  await tx.delete(productVariants).where(inArray(productVariants.productId, seededProductIds))
  await upsert(
    tx,
    productVariants,
    PRODUCTS.flatMap((product) =>
      product.sizes.map((size, index) => ({
        id: seedId(`variant:${product.slug}:${size}`),
        productId: productId(product.slug),
        sizeLabel: size,
        stock: product.slug === 'poleron-del-club' ? (size === 'XL' ? 0 : 5) : null,
        // Ejemplo de talla agotada sin control de stock.
        isAvailable: !(product.slug === 'camiseta-oficial-local' && size === 'XXL'),
        sortOrder: index,
      })),
    ),
  )
  await upsert(
    tx,
    productImages,
    PRODUCTS.map((product) => ({
      id: seedId(`product-image:${product.slug}`),
      productId: productId(product.slug),
      mediaId: media.id(`product:${product.slug}`),
      sortOrder: 0,
    })),
  )

  // ── Planes de socio (cuotas de ejemplo) ──────────────────────────────────────────────────────
  const plans = [
    ['activo', 'Socio activo', 3000],
    ['cooperador', 'Socio cooperador', 5000],
    ['juvenil', 'Socio juvenil', 1500],
  ] as const
  await upsert(
    tx,
    membershipPlans,
    plans.map(([key, name, feeClp], index) => ({
      id: seedId(`plan:${key}`),
      name,
      feeClp,
      feePeriod: 'mensual' as const,
      benefits: [
        '[COMPLETAR: cuota y beneficios reales de este tipo de socio; el valor mostrado es de ejemplo]',
      ],
      sortOrder: index,
    })),
  )

  // ── Bandejas y padrón de ejemplo (datos ficticios, correos @cachorros.test) ──────────────────────
  const planId = (key: (typeof plans)[number][0]) => seedId(`plan:${key}`)
  await upsert(tx, members, [
    {
      id: seedId('member:1'),
      memberNumber: 1,
      fullName: 'Socio Ejemplo Uno',
      email: 'socio1@cachorros.test',
      planId: planId('activo'),
      joinedOn: '2024-04-01',
    },
    {
      id: seedId('member:2'),
      memberNumber: 2,
      fullName: 'Socia Ejemplo Dos',
      email: 'socio2@cachorros.test',
      planId: planId('cooperador'),
      joinedOn: '2024-04-01',
    },
    {
      id: seedId('member:3'),
      memberNumber: 3,
      fullName: 'Socio Ejemplo Tres',
      planId: planId('juvenil'),
      status: 'baja' as const,
      joinedOn: '2025-03-15',
    },
  ])
  const consent = { privacyConsentAt: new Date(), privacyPolicyVersion: 'sin-publicar' }
  await upsert(tx, membershipRequests, [
    {
      id: seedId('membership-request:1'),
      fullName: 'Solicitante Ejemplo',
      email: 'solicitante@cachorros.test',
      phoneE164: EXAMPLE_PHONE,
      commune: 'Sagrada Familia',
      planId: planId('activo'),
      message: 'Mensaje de ejemplo: quiero hacerme socio.',
      ...consent,
      notifiedAt: consent.privacyConsentAt,
    },
  ])
  await upsert(tx, sponsorshipInquiries, [
    {
      id: seedId('sponsorship-inquiry:1'),
      businessName: 'Almacén Ejemplo',
      contactName: 'Contacto Comercial Ejemplo',
      email: 'auspicio-ejemplo@cachorros.test',
      tierInterest: 'colaborador' as const,
      message: 'Mensaje de ejemplo: queremos aparecer en la camiseta de la Senior.',
      ...consent,
      notifiedAt: consent.privacyConsentAt,
    },
  ])
  await upsert(tx, contactMessages, [
    {
      id: seedId('contact-message:1'),
      name: 'Contacto Ejemplo',
      email: 'contacto-ejemplo@cachorros.test',
      topic: 'historia' as const,
      message: 'Mensaje de ejemplo: tengo fotos antiguas del club.',
      ...consent,
      notifiedAt: consent.privacyConsentAt,
    },
  ])

  // ── Directiva y documentos ───────────────────────────────────────────────────────────────────
  const board = [
    ['Presidente', 'María Fernanda Soto (ejemplo)'],
    ['Vicepresidente', 'Juan Carlos Rojas (ejemplo)'],
    ['Secretaria', 'Carolina Muñoz (ejemplo)'],
    ['Tesorero', 'Pedro Antonio Díaz (ejemplo)'],
    ['Director', 'Luis Alberto Contreras (ejemplo)'],
    ['Directora', 'Patricia Sepúlveda (ejemplo)'],
  ] as const
  await upsert(
    tx,
    boardMembers,
    board.map(([roleTitle, fullName], index) => ({
      id: seedId(`board:${index}`),
      fullName,
      roleTitle,
      sortOrder: index,
    })),
  )

  const docs = [
    ['estatutos', 'Estatutos del club', 'estatutos', 'Vigentes'],
    ['acta', 'Acta de asamblea ordinaria', 'acta', String(year)],
    ['balance', 'Balance anual', 'balance', String(year - 1)],
  ] as const
  await upsert(
    tx,
    documents,
    docs.map(([key, title, category, periodLabel]) => ({
      id: seedId(`document:${key}`),
      title: `${title} (ejemplo)`,
      category,
      periodLabel,
      documentDate: `${year - 1}-12-31`,
      fileMediaId: media.id(`doc:${key}`),
      description: '[COMPLETAR: documento real del club]',
      isPublished: true,
      publishedAt: santiagoDateTime(now, -30, 12),
    })),
  )

  return { anniversary, eventId }
}
