import type { Metadata } from 'next'
import { NotFoundContent } from '@/components/site/not-found-content'

export const metadata: Metadata = { title: 'Página no encontrada' }

export default function PublicNotFound() {
  return <NotFoundContent />
}
