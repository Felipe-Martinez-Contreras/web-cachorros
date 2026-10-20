import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { contactMessages, membershipPlans, membershipRequests } from '@/db/schema'
import { membershipFormSchema } from '@/features/members/schemas'
import type { InboxKind } from './notify'
import { contactFormSchema } from './schemas'

export type SubmissionMeta = { ipHash: string; policyVersion: string; now: Date }

export type SubmissionResult = { ok: true; id: string } | { ok: false; fieldErrors: Record<string, string[]> }

export type PublicForm = {
  /** Bandeja que recibe el envío (y avisa por correo). */
  kind: InboxKind
  /** Página del formulario: adonde vuelve el envío sin JavaScript. */
  path: string
  /** `action` de Turnstile: el token debe haberse emitido para este formulario. */
  turnstileAction: string
  /** Valida y guarda. Los controles anti-spam (origen, límite, trampa, tiempo, Turnstile) ya pasaron. */
  save: (values: Record<string, unknown>, meta: SubmissionMeta) => Promise<SubmissionResult>
}

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    errors[key] ??= []
    errors[key].push(issue.message)
  }
  return errors
}

/** Formularios públicos (especificación 6.7, 6.10 y 6.15), por su nombre en `/api/forms/[form]`. */
const PUBLIC_FORMS: Record<string, PublicForm> = {
  contacto: {
    kind: 'contacto',
    path: '/contacto',
    turnstileAction: 'contacto',
    async save(values, meta) {
      const parsed = contactFormSchema.safeParse(values)
      if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) }
      const { privacy: _consent, phone, ...data } = parsed.data
      const [row] = await db
        .insert(contactMessages)
        .values({
          ...data,
          phoneE164: phone,
          privacyConsentAt: meta.now,
          privacyPolicyVersion: meta.policyVersion,
          ipHash: meta.ipHash,
        })
        .returning({ id: contactMessages.id })
      if (!row) throw new Error('No se guardó el mensaje de contacto.')
      return { ok: true, id: row.id }
    },
  },
  socios: {
    kind: 'socios',
    path: '/socios',
    turnstileAction: 'socios',
    async save(values, meta) {
      const parsed = membershipFormSchema.safeParse(values)
      if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error) }
      const { privacy: _consent, marketing, phone, ...data } = parsed.data
      // Solo un plan vigente: uno desactivado puede seguir en una página abierta desde antes.
      const [plan] = await db
        .select({ id: membershipPlans.id })
        .from(membershipPlans)
        .where(and(eq(membershipPlans.id, data.planId), eq(membershipPlans.isActive, true)))
        .limit(1)
      if (!plan)
        return { ok: false, fieldErrors: { planId: ['Ese plan ya no está disponible. Elige otro.'] } }
      const [row] = await db
        .insert(membershipRequests)
        .values({
          ...data,
          phoneE164: phone,
          marketingConsent: marketing,
          privacyConsentAt: meta.now,
          privacyPolicyVersion: meta.policyVersion,
          ipHash: meta.ipHash,
        })
        .returning({ id: membershipRequests.id })
      if (!row) throw new Error('No se guardó la solicitud de socio.')
      return { ok: true, id: row.id }
    },
  },
}

export function getPublicForm(name: string): PublicForm | null {
  return Object.hasOwn(PUBLIC_FORMS, name) ? (PUBLIC_FORMS[name] ?? null) : null
}
