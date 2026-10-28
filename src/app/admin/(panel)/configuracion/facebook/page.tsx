import { redirect } from 'next/navigation'

/** Facebook tiene su propia sección en el menú: la dirección de antes lleva a sus ajustes. */
export default function OldFacebookSettingsPage() {
  redirect('/admin/facebook/ajustes')
}
