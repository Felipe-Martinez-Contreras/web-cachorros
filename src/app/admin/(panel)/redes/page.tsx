import { Share2 } from 'lucide-react'
import type { Metadata } from 'next'
import { NewLink, PageHeader, ResourceList, ResourceRow } from '@/components/admin/resource-list'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/feedback'
import { listSocialPostsAdmin } from '@/features/social/admin-queries'
import { requirePanelUser } from '@/lib/auth/session'
import { formatShortDate, fromIsoDate } from '@/lib/format'
import { socialPlatformLabels } from '@/lib/labels'

export const metadata: Metadata = { title: 'Redes sociales' }

export default async function SocialPostsPage() {
  await requirePanelUser('social:write')
  const rows = await listSocialPostsAdmin()

  return (
    <>
      <PageHeader
        title="Redes sociales"
        description="Publicaciones elegidas de Instagram, Facebook o TikTok para la portada. El sitio muestra su imagen y enlaza a la red, sin cargar nada de terceros."
        action={<NewLink href="/admin/redes/nueva">Nueva publicación</NewLink>}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Share2 aria-hidden="true" />} title="Todavía no hay publicaciones">
          Pega el enlace de una publicación del club y sube su imagen.
        </EmptyState>
      ) : (
        <ResourceList label="Publicaciones">
          {rows.map((row) => (
            <ResourceRow
              key={row.id}
              title={row.excerpt ?? `Publicación en ${socialPlatformLabels[row.platform]}`}
              href={`/admin/redes/${row.id}`}
              subtitle={[
                socialPlatformLabels[row.platform],
                row.postedOn ? formatShortDate(fromIsoDate(row.postedOn)) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              badges={
                <>
                  {!row.isPublished && <Badge>Sin publicar</Badge>}
                  {row.isPinned && <Badge variant="dark">Fijada</Badge>}
                  {row.embedEnabled && <Badge variant="soft">Ver aquí</Badge>}
                </>
              }
              media={
                row.image?.thumb ? (
                  // biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7)
                  <img src={row.image.thumb} alt="" className="size-12 rounded object-cover" />
                ) : (
                  <span className="grid size-12 place-items-center rounded bg-neutral-100 text-neutral-600">
                    <Share2 aria-hidden="true" className="size-5" />
                  </span>
                )
              }
            />
          ))}
        </ResourceList>
      )}
    </>
  )
}
