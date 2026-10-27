'use client' // Cliente: edita la descripción y el punto focal tocando la imagen.

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { type MouseEvent, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { FormBody } from '@/components/admin/form-body'
import { useToast } from '@/components/admin/toast'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/feedback'
import { CheckboxField, Field } from '@/components/ui/field'
import type { ActionResult } from '@/lib/action-result'
import { FOCAL_ZOOM_MAX, FOCAL_ZOOM_MIN } from '@/lib/images/focal-crop'
import type { MediaDetailDTO } from '../dto'
import { updateMediaSchema } from '../schemas'
import { FocalPreview, matchdayPanelCrop } from './focal-preview'

type FormValues = {
  altText: string
  credit: string
  focalX: number
  focalY: number
  focalZoom: number
  containsMinors: boolean
  minorsConsent: boolean
}

type Props = {
  media: MediaDetailDTO
  action: (input: unknown) => Promise<ActionResult<unknown>>
}

export function MediaEditForm({ media, action }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<FormValues>({
    resolver: zodResolver(updateMediaSchema as never) as unknown as Resolver<FormValues>,
    defaultValues: {
      altText: media.alt,
      credit: media.credit ?? '',
      focalX: media.focalX,
      focalY: media.focalY,
      focalZoom: media.focalZoom,
      containsMinors: media.containsMinors,
      minorsConsent: media.minorsConsentConfirmedAt !== null,
    },
  })
  const { errors, isSubmitting } = form.formState
  const focalX = Number(form.watch('focalX'))
  const focalY = Number(form.watch('focalY'))
  const focalZoom = Number(form.watch('focalZoom'))
  const bar = media.image
    ? matchdayPanelCrop(media.image.width, media.image.height, { focalX, focalY, focalZoom })
    : null
  const barStyle =
    bar && media.image
      ? {
          left: `${(bar.left / media.image.width) * 100}%`,
          top: `${(bar.top / media.image.height) * 100}%`,
          width: `${(bar.width / media.image.width) * 100}%`,
          height: `${(bar.height / media.image.height) * 100}%`,
        }
      : undefined
  const containsMinors = form.watch('containsMinors')

  function onImageClick(event: MouseEvent<HTMLButtonElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const clamp = (value: number) => Math.min(1, Math.max(0, Math.round(value * 100) / 100))
    form.setValue('focalX', clamp((event.clientX - box.left) / box.width), { shouldDirty: true })
    form.setValue('focalY', clamp((event.clientY - box.top) / box.height), { shouldDirty: true })
  }

  const onSubmit = form.handleSubmit(async () => {
    setFormError(null)
    const result = await action(form.getValues())
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof FormValues, { type: 'server', message: messages[0] })
      }
      setFormError(result.message)
      return
    }
    toast({ message: 'Guardado.' })
    router.refresh()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-2xl">
      <FormBody className="grid gap-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        {/* Los sliders llevan su valor desde el servidor: sin él, el navegador los pone al medio y el
            formulario tomaría ese valor al hidratarse. */}
        {media.image && (
          <div className="grid gap-2">
            <p className="font-medium">Encuadre</p>
            <div className="grid gap-4 md:grid-cols-[minmax(0,28rem)_auto] md:items-start">
              <button
                type="button"
                onClick={onImageClick}
                aria-label="Toca la parte de la imagen que siempre debe verse"
                className="relative block w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-100"
              >
                {/* biome-ignore lint/performance/noImgElement: sin optimizador de imágenes en runtime (2.7) */}
                <img
                  src={media.image.src}
                  alt={media.alt}
                  width={media.image.width}
                  height={media.image.height}
                  className="block h-auto w-full"
                />
                {/* Lo que entra en una barra del matchday: con zoom es una franja angosta de la foto. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute border-2 border-paper shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]"
                  style={barStyle}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-paper bg-accent shadow-lg"
                  style={{ left: `${focalX * 100}%`, top: `${focalY * 100}%` }}
                />
              </button>
              <FocalPreview
                src={media.image.src}
                width={media.image.width}
                height={media.image.height}
                focalX={focalX}
                focalY={focalY}
                focalZoom={focalZoom}
              />
            </div>
            <p className="text-sm text-neutral-600">
              Toca la parte que siempre debe verse cuando la foto se recorta (por ejemplo, las caras). También
              puedes moverlo con los controles. El recuadro es lo que entra en una barra del matchday; al lado
              ves cómo queda antes de guardar.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm font-medium">
                Horizontal
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  className="min-h-12 accent-ink"
                  defaultValue={media.focalX}
                  {...form.register('focalX', { valueAsNumber: true })}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Vertical
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  className="min-h-12 accent-ink"
                  defaultValue={media.focalY}
                  {...form.register('focalY', { valueAsNumber: true })}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                <span>Acercar en las tarjetas: {Math.round(focalZoom * 100)} %</span>
                <input
                  type="range"
                  min={FOCAL_ZOOM_MIN}
                  max={FOCAL_ZOOM_MAX}
                  step={0.05}
                  aria-valuetext={`${Math.round(focalZoom * 100)} %`}
                  className="min-h-12 accent-ink"
                  defaultValue={media.focalZoom}
                  {...form.register('focalZoom', { valueAsNumber: true })}
                />
              </label>
            </div>
            <p className="text-sm text-neutral-600">
              «Acercar» sirve para destacar un rostro o un número en las tarjetas para redes, alrededor del
              punto focal. El sitio muestra la foto completa.
            </p>
            {errors.focalZoom?.message && (
              <p className="text-sm font-medium text-danger">{errors.focalZoom.message}</p>
            )}
          </div>
        )}

        <Field
          label="Descripción (texto alternativo)"
          help="Qué se ve en la imagen. Lo leen los lectores de pantalla y los buscadores."
          error={errors.altText?.message}
          maxLength={300}
          required
          {...form.register('altText')}
        />
        <Field
          label="Crédito"
          help="Quién tomó la foto."
          error={errors.credit?.message}
          maxLength={120}
          required={false}
          {...form.register('credit')}
        />

        <fieldset className="grid gap-1 rounded-md border border-neutral-300 p-3">
          <legend className="px-1 font-medium">Menores de edad</legend>
          <CheckboxField
            label="En esta imagen aparecen menores de edad"
            help="Mientras el club no defina su política de fotos de menores, las imágenes marcadas no se pueden usar en el sitio."
            error={errors.containsMinors?.message}
            {...form.register('containsMinors')}
          />
          {containsMinors && (
            <CheckboxField
              label="Confirmo que el club tiene la autorización escrita del apoderado"
              error={errors.minorsConsent?.message}
              {...form.register('minorsConsent')}
            />
          )}
        </fieldset>

        <div>
          <Button type="submit" variant="dark" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </FormBody>
    </form>
  )
}
