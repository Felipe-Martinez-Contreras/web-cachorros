'use client' // Cliente: cierra la hoja «Más» del celular cuando cambia la ruta (navegar no cierra un popover).

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export function CloseSheetOnNavigate({ sheetId }: { sheetId: string }) {
  const pathname = usePathname()
  useEffect(() => {
    // `pathname` es la dependencia: el efecto corre en cada navegación del panel.
    void pathname
    const sheet = document.getElementById(sheetId)
    if (sheet?.matches(':popover-open')) sheet.hidePopover()
  }, [pathname, sheetId])
  return null
}
