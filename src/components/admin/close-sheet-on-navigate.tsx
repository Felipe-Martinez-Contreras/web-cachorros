'use client' // Cliente: cierra la hoja «Más» del celular cuando cambia la ruta (navegar no cierra un popover).

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function CloseSheetOnNavigate({ sheetId }: { sheetId: string }) {
  const pathname = usePathname()
  const shown = useRef(pathname)
  useEffect(() => {
    // Solo al cambiar de ruta, no al montar: la hoja es un popover nativo y se puede abrir antes de que
    // React tome el control (el HTML del panel llega completo); cerrarla al hidratar perdía ese toque.
    if (shown.current === pathname) return
    shown.current = pathname
    const sheet = document.getElementById(sheetId)
    if (sheet?.matches(':popover-open')) sheet.hidePopover()
  }, [pathname, sheetId])
  return null
}
