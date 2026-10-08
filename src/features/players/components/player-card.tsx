import Link from 'next/link'
import { ClubImage } from '@/components/site/club-image'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { ImageDTO } from '@/lib/images/dto'
import { staffRoleLabels } from '@/lib/labels'
import type { SquadPlayerDTO, StaffDTO } from '../dto'

/** Retrato 4:5 con la silueta de reemplazo cuando no hay foto (especificación 4.6). */
function Portrait({ photo, sizes }: { photo: ImageDTO | null; sizes: string }) {
  return (
    <span className="block aspect-[4/5] overflow-hidden rounded-md bg-neutral-100">
      {photo ? (
        <ClubImage image={photo} alt="" sizes={sizes} className="size-full object-cover" />
      ) : (
        // biome-ignore lint/performance/noImgElement: archivo estático pequeño, sin optimizador (2.7)
        <img
          src="/placeholder/jugador.svg"
          alt=""
          width={320}
          height={400}
          loading="lazy"
          className="size-full object-cover"
        />
      )}
    </span>
  )
}

const PORTRAIT_SIZES = '(min-width: 1024px) 220px, (min-width: 640px) 30vw, 45vw'

/** Tarjeta de jugador del plantel. Solo enlaza a la ficha si el jugador tiene una (los menores no). */
export function PlayerCard({ player, className }: { player: SquadPlayerDTO; className?: string }) {
  return (
    <div className={cn('relative grid gap-2', className)}>
      <Portrait photo={player.photo} sizes={PORTRAIT_SIZES} />
      <div className="flex items-start gap-2">
        {player.shirtNumber !== null && (
          <span
            className="font-tight text-3xl leading-none font-black tabular-nums [font-stretch:62.5%]"
            aria-hidden="true"
          >
            {player.shirtNumber}
          </span>
        )}
        <div className="grid min-w-0 grid-cols-1 gap-0.5">
          <h3 className="leading-tight font-semibold wrap-anywhere">
            {player.slug ? (
              <Link
                href={`/jugadores/${player.slug}`}
                className="after:absolute after:inset-0 hover:underline hover:underline-offset-4"
              >
                {player.name}
              </Link>
            ) : (
              player.name
            )}
            {player.shirtNumber !== null && <span className="sr-only">, camiseta {player.shirtNumber}</span>}
          </h3>
          {player.nickname && <p className="text-meta text-(--muted)">«{player.nickname}»</p>}
          {player.isCaptain && (
            <Badge variant="dark" className="justify-self-start">
              Capitán
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

/** Tarjeta del cuerpo técnico: nombre y cargo. */
export function StaffCard({ member, className }: { member: StaffDTO; className?: string }) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Portrait photo={member.photo} sizes={PORTRAIT_SIZES} />
      <div className="grid gap-0.5">
        <h3 className="leading-tight font-semibold wrap-anywhere">{member.name}</h3>
        <p className="text-meta text-(--muted)">{staffRoleLabels[member.role]}</p>
      </div>
    </div>
  )
}
