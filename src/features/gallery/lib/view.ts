/** Pestañas de `/galeria`: «Fotos» (los álbumes) y «Videos» (antes `/videos`). */
export type GalleryView = 'fotos' | 'videos'

export const GALLERY_VIEWS: { view: GalleryView; label: string }[] = [
  { view: 'fotos', label: 'Fotos' },
  { view: 'videos', label: 'Videos' },
]

/** `?vista=videos` → videos; cualquier otro valor (o ninguno) → fotos. */
export function galleryView(param: string | string[] | undefined): GalleryView {
  return param === 'videos' ? 'videos' : 'fotos'
}

export function galleryViewHref(view: GalleryView): string {
  return view === 'videos' ? '/galeria?vista=videos' : '/galeria'
}
