'use client' // Cliente: formularios de Configuración (react-hook-form + Zod).

import type { ZodType } from 'zod'
import { EntityForm, type FieldDef } from '@/components/admin/entity-form'
import type { MediaThumbDTO } from '@/features/media/dto'
import type { ActionResult } from '@/lib/action-result'
import {
  clubSettingsSchema,
  contactSettingsSchema,
  featuredSettingsSchema,
  heroSettingsSchema,
  locationSettingsSchema,
  seoSettingsSchema,
  socialSettingsSchema,
  supportSettingsSchema,
} from '../schemas'
import type { SettingsSection } from '../sections'

type Option = { value: string; label: string }

const RECIPIENTS_HELP = 'Uno o más correos separados por comas. Si lo dejas vacío, nadie recibe el aviso.'
const URL_FIELD = { type: 'url', inputMode: 'url', placeholder: 'https://', required: false } as const

const SCHEMAS = {
  club: clubSettingsSchema,
  contacto: contactSettingsSchema,
  redes: socialSettingsSchema,
  ubicacion: locationSettingsSchema,
  aportes: supportSettingsSchema,
  portada: heroSettingsSchema,
  destacados: featuredSettingsSchema,
  seo: seoSettingsSchema,
} as const

function fieldsOf(section: SettingsSection, options: { series: Option[]; sponsors: Option[] }): FieldDef[] {
  switch (section) {
    case 'club':
      return [
        { name: 'clubName', label: 'Nombre del club', type: 'text' },
        {
          name: 'shortName',
          label: 'Nombre corto',
          type: 'text',
          help: 'Para los espacios pequeños, como el encabezado en el celular.',
        },
      ]
    case 'contacto':
      return [
        {
          name: 'whatsapp',
          label: 'WhatsApp del club',
          type: 'tel',
          inputMode: 'tel',
          required: false,
          placeholder: '+56 9 1234 5678',
          help: 'Con él funcionan los botones de WhatsApp del sitio.',
        },
        { name: 'phone', label: 'Teléfono', type: 'tel', inputMode: 'tel', required: false },
        { name: 'publicEmail', label: 'Correo público', type: 'email', inputMode: 'email', required: false },
        {
          name: 'notifySocios',
          label: 'Avisar las solicitudes de socios a',
          type: 'textarea',
          rows: 2,
          required: false,
          help: RECIPIENTS_HELP,
        },
        {
          name: 'notifyAuspicios',
          label: 'Avisar las consultas de auspicio a',
          type: 'textarea',
          rows: 2,
          required: false,
          help: RECIPIENTS_HELP,
        },
        {
          name: 'notifyContacto',
          label: 'Avisar los mensajes de contacto a',
          type: 'textarea',
          rows: 2,
          required: false,
          help: RECIPIENTS_HELP,
        },
      ]
    case 'redes':
      return [
        { name: 'instagram', label: 'Instagram', ...URL_FIELD },
        { name: 'facebook', label: 'Facebook', ...URL_FIELD },
        { name: 'tiktok', label: 'TikTok', ...URL_FIELD },
        { name: 'youtube', label: 'YouTube', ...URL_FIELD },
        {
          name: 'x',
          label: 'X',
          ...URL_FIELD,
          help: 'Solo aparecen en el sitio las redes que tengan dirección.',
        },
      ]
    case 'ubicacion':
      return [
        { name: 'address', label: 'Dirección de la cancha', type: 'text', required: false },
        { name: 'commune', label: 'Comuna', type: 'text', required: false },
        { name: 'region', label: 'Región', type: 'text', required: false },
        {
          name: 'location',
          label: 'Ubicación en el mapa',
          type: 'text',
          required: false,
          placeholder: '-35.0123, -71.4567',
          help: 'Pega el enlace de Google Maps (el largo, copiado desde la barra del navegador) o las coordenadas.',
        },
      ]
    case 'aportes':
      return [
        { name: 'holder', label: 'Titular de la cuenta', type: 'text', required: false },
        { name: 'rut', label: 'RUT del titular', type: 'text', required: false, placeholder: '12.345.678-5' },
        { name: 'bank', label: 'Banco', type: 'text', required: false },
        { name: 'accountType', label: 'Tipo de cuenta', type: 'text', required: false },
        { name: 'accountNumber', label: 'Número de cuenta', type: 'text', required: false },
        {
          name: 'email',
          label: 'Correo para los comprobantes',
          type: 'email',
          inputMode: 'email',
          required: false,
          help: 'La cuenta se publica completa o no se publica: llena los cinco datos o déjalos todos vacíos.',
        },
        {
          name: 'donationUrl',
          label: 'Enlace de pago',
          ...URL_FIELD,
          help: 'Opcional: un botón de pago en línea para quien quiera aportar.',
        },
      ]
    case 'portada':
      return [
        {
          name: 'mediaId',
          label: 'Foto de la portada',
          type: 'media',
          required: false,
          help: 'Horizontal y de buena calidad: es lo primero que se ve.',
        },
        {
          name: 'mobileMediaId',
          label: 'Foto para el celular',
          type: 'media',
          required: false,
          help: 'Vertical. Si no eliges una, se usa la misma foto recortada.',
        },
        { name: 'title', label: 'Título', type: 'text', required: false },
        { name: 'subtitle', label: 'Bajada', type: 'text', required: false },
        { name: 'ctaLabel', label: 'Texto del botón', type: 'text', required: false },
        {
          name: 'ctaHref',
          label: 'A dónde lleva el botón',
          type: 'text',
          required: false,
          placeholder: '/socios',
          help: 'Una página del sitio (/socios, /partidos) o una dirección completa con https://',
        },
      ]
    case 'destacados':
      return [
        {
          name: 'featuredSeriesId',
          label: 'Serie destacada',
          type: 'select',
          options: options.series,
          emptyLabel: 'La primera de la lista',
          required: false,
          help: 'La que se muestra primero en la portada, Partidos y Plantel.',
        },
        {
          name: 'shareCardSponsorId',
          label: 'Auspiciador en las tarjetas para redes',
          type: 'select',
          options: options.sponsors,
          emptyLabel: 'Ninguno',
          required: false,
          help: 'Su logo irá en las tarjetas de resultados cuando estén disponibles.',
        },
      ]
    case 'seo':
      return [
        {
          name: 'description',
          label: 'Descripción del sitio',
          type: 'textarea',
          rows: 3,
          maxLength: 160,
          required: false,
          help: 'Una o dos frases. Es el texto que muestra Google bajo el nombre del club.',
        },
        {
          name: 'ogMediaId',
          label: 'Imagen al compartir el sitio',
          type: 'media',
          required: false,
          help: 'La que aparece en WhatsApp o Facebook cuando alguien comparte una página sin foto propia.',
        },
      ]
  }
}

/** Formulario de una sección de Configuración. */
export function SettingsForm({
  section,
  action,
  defaults,
  options,
  previews,
}: {
  section: SettingsSection
  action: (input: unknown) => Promise<ActionResult<unknown>>
  defaults: Record<string, string>
  options: { series: Option[]; sponsors: Option[] }
  previews: Record<string, MediaThumbDTO | null>
}) {
  return (
    <EntityForm<Record<string, unknown>>
      // Cada sección tiene su esquema; todos reciben textos del formulario.
      schema={SCHEMAS[section] as ZodType<unknown, Record<string, unknown>>}
      action={action}
      defaultValues={defaults}
      mediaPreviews={previews}
      fields={fieldsOf(section, options)}
      successMessage="Configuración guardada."
      cancelHref="/admin/configuracion"
    />
  )
}
