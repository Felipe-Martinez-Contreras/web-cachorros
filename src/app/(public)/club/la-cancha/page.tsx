import { ComingSoon, comingSoonMetadata } from '@/components/site/coming-soon'

// Página provisional: esta sección se construye en una fase posterior (especificación, sección 14).
export const metadata = comingSoonMetadata('La cancha')

export default function Page() {
  return <ComingSoon title="La cancha" />
}
