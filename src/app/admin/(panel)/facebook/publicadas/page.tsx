import type { Metadata } from 'next'
import { PageHeader, ResourceList } from '@/components/admin/resource-list'
import { publishedPublications } from '@/features/social-publishing/admin-queries'
import { FacebookTabs } from '@/features/social-publishing/components/facebook-notices'
import { PublicationRow } from '@/features/social-publishing/components/publication-row'
import { requirePanelUser } from '@/lib/auth/session'
import { can } from '@/lib/permissions'

export const metadata: Metadata = { title: 'Facebook: publicadas' }

export default async function FacebookPublishedPage() {
  const user = await requirePanelUser('social:write')
  const publications = await publishedPublications()

  return (
    <>
      <PageHeader
        title="Facebook"
        description="Lo que ya salió o intentó salir, con su estado. Lo que falló se puede reintentar o descartar."
      />
      <FacebookTabs current="/admin/facebook/publicadas" canConfigure={can(user, 'settings:write')} />
      <section aria-labelledby="publicadas" className="grid gap-3">
        <h2 id="publicadas" className="text-lg font-bold">
          Publicadas
        </h2>
        {publications.length === 0 ? (
          <p className="text-neutral-600">Todavía no se ha publicado nada.</p>
        ) : (
          <ResourceList label="Publicaciones en Facebook">
            {publications.map((publication) => (
              <PublicationRow key={publication.id} publication={publication} />
            ))}
          </ResourceList>
        )}
      </section>
    </>
  )
}
