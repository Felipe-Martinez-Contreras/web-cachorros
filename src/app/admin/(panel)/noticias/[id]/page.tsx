import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ActionButton } from '@/components/admin/action-button'
import { DeleteSection } from '@/components/admin/delete-section'
import { PageHeader } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { toSantiagoWallTime } from '@/features/matches/lib/schedule'
import {
  actualizarNoticia,
  archivarNoticia,
  eliminarNoticia,
  pasarNoticiaABorrador,
  programarNoticia,
  publicarNoticia,
} from '@/features/news/actions'
import { getNewsAdmin, newsFormOptions } from '@/features/news/admin-queries'
import { NewsForm, ScheduleNewsForm } from '@/features/news/components/forms'
import { requirePanelUser } from '@/lib/auth/session'
import { isUuid } from '@/lib/form-schemas'
import { formatLongDateTime } from '@/lib/format'
import { newsStatusLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Editar noticia' }

const STATUS_VARIANT = {
  borrador: 'neutral',
  programada: 'soft',
  publicada: 'success',
  archivada: 'dark',
} as const

const STATUS_HELP = {
  borrador: 'Solo se ve en el panel. Se guarda sola mientras escribes.',
  programada: 'Se publicará sola en la fecha indicada.',
  publicada: 'Está en el sitio. Los cambios se ven al tocar «Guardar».',
  archivada: 'Ya no se ve en el sitio.',
} as const

export default async function EditNewsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelUser('news:write')
  const { id } = await params
  const [row, options] = await Promise.all([isUuid(id) ? getNewsAdmin(id) : null, newsFormOptions()])
  if (!row) notFound()

  const live = row.status === 'publicada' && row.publishedAt !== null && row.publishedAt <= new Date()
  // Para programar se propone mañana a las 10:00 (o la fecha ya programada).
  const scheduleDefaults =
    row.status === 'programada' && row.publishedAt
      ? toSantiagoWallTime(row.publishedAt)
      : { date: toSantiagoWallTime(new Date(Date.now() + 24 * 3600_000)).date, time: '10:00' }

  return (
    <>
      <PageHeader title={row.title} back={{ href: '/admin/noticias', label: 'Noticias' }} />

      <section
        aria-labelledby="estado-titulo"
        className="mb-8 grid max-w-2xl gap-3 rounded-lg border border-neutral-200 bg-paper p-4"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="estado-titulo" className="text-lg font-bold">
            Estado
          </h2>
          <Badge variant={STATUS_VARIANT[row.status]}>{newsStatusLabels[row.status]}</Badge>
        </div>
        <p className="text-neutral-600">
          {STATUS_HELP[row.status]}
          {row.status !== 'borrador' && row.publishedAt && ` Fecha: ${formatLongDateTime(row.publishedAt)}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {row.status !== 'publicada' && (
            <ActionButton
              action={publicarNoticia.bind(null, row.id)}
              variant="dark"
              successMessage="Noticia publicada."
              confirm={{
                title: '¿Publicar ahora?',
                description: 'Quedará visible en el sitio de inmediato, con lo último que guardaste.',
                confirmLabel: 'Sí, publicar',
              }}
            >
              Publicar ahora
            </ActionButton>
          )}
          <Link
            href={`/admin/noticias/${row.id}/vista-previa`}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            Vista previa
          </Link>
          {live && (
            <a href={`/noticias/${row.slug}`} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Ver en el sitio
            </a>
          )}
          {row.status !== 'borrador' && (
            <ActionButton
              action={pasarNoticiaABorrador.bind(null, row.id)}
              successMessage="La noticia volvió a borrador."
              confirm={
                row.status === 'publicada'
                  ? {
                      title: '¿Volver a borrador?',
                      description: 'Dejará de verse en el sitio hasta que la publiques de nuevo.',
                      confirmLabel: 'Sí, despublicar',
                    }
                  : undefined
              }
            >
              Volver a borrador
            </ActionButton>
          )}
          {row.status === 'publicada' && (
            <ActionButton
              action={archivarNoticia.bind(null, row.id)}
              successMessage="Noticia archivada."
              confirm={{
                title: '¿Archivar la noticia?',
                description: 'Dejará de verse en el sitio. Puedes volver a publicarla cuando quieras.',
                confirmLabel: 'Sí, archivar',
              }}
            >
              Archivar
            </ActionButton>
          )}
        </div>
        {row.status !== 'publicada' && (
          <details className="rounded-md border border-neutral-300 p-3">
            <summary className="flex min-h-12 cursor-pointer items-center font-medium">
              {row.status === 'programada' ? 'Cambiar la fecha programada' : 'Programar para más adelante'}
            </summary>
            <div className="pt-3">
              <ScheduleNewsForm action={programarNoticia.bind(null, row.id)} defaults={scheduleDefaults} />
            </div>
          </details>
        )}
      </section>

      <NewsForm
        mode="edit"
        autosave={row.status === 'borrador'}
        action={actualizarNoticia.bind(null, row.id)}
        options={options}
        cover={row.cover}
        og={row.og}
        defaults={{
          title: row.title,
          type: row.type,
          categoryId: row.categoryId ?? '',
          excerpt: row.excerpt ?? '',
          body: row.body,
          coverMediaId: row.cover?.id ?? '',
          seriesIds: row.seriesIds,
          matchId: row.matchId ?? '',
          albumId: row.albumId ?? '',
          isFeatured: row.isFeatured,
          isPinned: row.isPinned,
          slug: row.slug,
          seoTitle: row.seoTitle ?? '',
          seoDescription: row.seoDescription ?? '',
          ogMediaId: row.og?.id ?? '',
        }}
      />

      {row.status !== 'publicada' && row.status !== 'programada' && (
        <DeleteSection
          what={`la noticia «${row.title}»`}
          description="Una noticia publicada o programada no se elimina: primero archívala o pásala a borrador."
          action={eliminarNoticia.bind(null, row.id)}
          redirectTo="/admin/noticias"
          buttonLabel="Eliminar noticia"
          successMessage="Noticia eliminada."
        />
      )}
    </>
  )
}
