import { Images } from 'lucide-react'
import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { formatShortDate, fromIsoDate } from '@/lib/format'
import type { AlbumCardDTO } from '../dto'

/** Tarjeta de un álbum: portada, nombre, fecha y cantidad de fotos (6.5). */
export function AlbumCard({ album }: { album: AlbumCardDTO }) {
  return (
    <article className="group relative grid content-start gap-2">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg bg-(--surface)">
        {album.cover ? (
          <ClubImage
            image={album.cover}
            alt=""
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <Images aria-hidden="true" className="size-12 text-(--muted)" />
        )}
      </div>
      <h2 className="text-lg leading-snug font-bold">
        <Link
          href={`/galeria/${album.slug}`}
          className="after:absolute after:inset-0 hover:underline hover:underline-offset-4"
        >
          {album.title}
        </Link>
      </h2>
      <p className="text-meta text-(--muted)">
        {album.takenOn && (
          <time dateTime={album.takenOn}>{formatShortDate(fromIsoDate(album.takenOn))} · </time>
        )}
        {album.photoCount === 1 ? '1 foto' : `${album.photoCount} fotos`}
      </p>
    </article>
  )
}
