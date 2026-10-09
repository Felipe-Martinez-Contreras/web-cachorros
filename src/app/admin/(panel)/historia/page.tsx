import { redirect } from 'next/navigation'
import { requirePanelUser } from '@/lib/auth/session'

/** Historia abre en su primera sección: la línea de tiempo. */
export default async function HistoryIndexPage() {
  await requirePanelUser('history:write')
  redirect('/admin/historia/hitos')
}
