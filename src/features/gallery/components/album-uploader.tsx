'use client' // Cliente: sube varias fotos y las agrega al álbum de a una.

import { useRef } from 'react'
import { useToast } from '@/components/admin/toast'
import { Uploader } from '@/features/media/components/uploader'
import { agregarFotoAlbum } from '../actions'

/**
 * Subida de un álbum completo (especificación 7.5): las fotos se suben en secuencia y cada una se agrega
 * al final del álbum apenas termina. Si una no se puede agregar, queda en la biblioteca y se avisa.
 */
export function AlbumUploader({ albumId, nextOrder }: { albumId: string; nextOrder: number }) {
  const toast = useToast()
  const order = useRef(nextOrder)
  return (
    <Uploader
      multiple
      onUploaded={async (media) => {
        const result = await agregarFotoAlbum(albumId, {
          mediaId: media.id,
          caption: '',
          sortOrder: String(order.current),
        })
        if (result.ok) order.current += 1
        else
          toast({
            message: `Una foto quedó en la biblioteca, pero no en el álbum: ${result.message}`,
            variant: 'danger',
          })
      }}
    />
  )
}
