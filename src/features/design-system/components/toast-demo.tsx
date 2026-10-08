'use client' // Cliente: dispara avisos de muestra con el hook del panel.

import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'

export function ToastDemo() {
  const toast = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="lg" onClick={() => toast({ message: 'Guardado.' })}>
        Aviso de éxito
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={() => toast({ variant: 'danger', message: 'No se pudo guardar. Inténtalo de nuevo.' })}
      >
        Aviso de error
      </Button>
    </div>
  )
}
