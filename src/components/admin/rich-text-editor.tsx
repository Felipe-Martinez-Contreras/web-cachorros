'use client' // Cliente: editor Tiptap (ProseMirror) del panel; necesita el DOM y el estado de la selección.

import Image from '@tiptap/extension-image'
import { EditorContent, mergeAttributes, Node, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Redo2,
  Undo2,
  Video,
} from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { RichTextDoc } from '@/db/schema/_columns'
import { MediaPicker } from '@/features/media/components/media-picker'
import { cn } from '@/lib/cn'
import { safeHref } from '@/lib/rich-text/document'
import { parseEmbedUrl } from '@/lib/rich-text/embed'

// Imagen de la biblioteca: guarda su id (el sitio la dibuja desde ahí) y la miniatura para verla al editar.
const LibraryImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), mediaId: { default: null } }
  },
})

// Video o publicación incrustada: en el editor se ve como una tarjeta con su enlace.
const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,
  addAttributes() {
    return { provider: { default: null }, url: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'div[data-embed]' }]
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-embed': node.attrs.provider, class: 'rich-text-embed' }),
      `Video o publicación: ${node.attrs.url}`,
    ]
  },
})

const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    link: { openOnClick: false, autolink: true, protocols: ['mailto', 'tel'] },
  }),
  LibraryImage,
  Embed,
]

type RichTextEditorProps = {
  label: string
  help?: string
  error?: string
  required?: boolean
  value: RichTextDoc | null
  onChange: (doc: RichTextDoc) => void
}

type UrlDialog = { kind: 'link' | 'embed'; error?: string }

function ToolButton({
  icon: Icon,
  label,
  pressed,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="aria-pressed:bg-ink aria-pressed:text-paper"
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

/** Editor de texto enriquecido del panel (noticias y textos de páginas). Entrega JSON de ProseMirror. */
export function RichTextEditor({ label, help, error, required, value, onChange }: RichTextEditorProps) {
  const uid = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [dialog, setDialog] = useState<UrlDialog>({ kind: 'link' })
  const [url, setUrl] = useState('')

  const editor = useEditor({
    extensions,
    content: value ?? undefined,
    // Este componente se carga con `ssr: false`: el editor puede crearse en el primer render.
    immediatelyRender: true,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': `${uid}-label`,
        class: 'rich-text min-h-64 px-3 py-3 outline-none',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextDoc),
  })

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            h2: current.isActive('heading', { level: 2 }),
            h3: current.isActive('heading', { level: 3 }),
            bulletList: current.isActive('bulletList'),
            orderedList: current.isActive('orderedList'),
            blockquote: current.isActive('blockquote'),
            link: current.isActive('link'),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  })

  if (!editor || !state) {
    return (
      <p className="min-h-64 rounded-md border border-neutral-300 p-3 text-neutral-600">
        Cargando el editor…
      </p>
    )
  }

  function openDialog(kind: UrlDialog['kind']) {
    setDialog({ kind })
    setUrl(kind === 'link' ? String(editor?.getAttributes('link').href ?? '') : '')
    dialogRef.current?.showModal()
  }

  function submitUrl() {
    if (!editor) return
    if (dialog.kind === 'link') {
      const href = safeHref(/^[a-z][a-z0-9+.-]*:/i.test(url.trim()) ? url : `https://${url.trim()}`)
      if (!href) {
        setDialog({
          kind: 'link',
          error: 'Escribe una dirección web, un correo (mailto:) o un teléfono (tel:).',
        })
        return
      }
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    } else {
      const embed = parseEmbedUrl(url)
      if (!embed) {
        setDialog({
          kind: 'embed',
          error: 'Pega el enlace de un video de YouTube o de una publicación de Facebook o Instagram.',
        })
        return
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: 'embed', attrs: { provider: embed.provider, url: embed.url } })
        .run()
    }
    dialogRef.current?.close()
  }

  const chain = () => editor.chain().focus()

  return (
    <div className="grid gap-1">
      <p id={`${uid}-label`} className="font-medium">
        {label}
        {required === false && <span className="font-normal text-neutral-600"> (opcional)</span>}
      </p>
      <div
        className={cn(
          'rounded-md border border-neutral-500 bg-paper focus-within:outline-2 focus-within:outline-(--focus)',
          error && 'border-2 border-danger',
        )}
      >
        <div
          role="toolbar"
          aria-label="Formato del texto"
          className="sticky top-0 z-10 flex flex-wrap gap-0.5 border-b border-neutral-300 bg-paper p-1"
        >
          <ToolButton
            icon={Bold}
            label="Negrita"
            pressed={state.bold}
            onClick={() => chain().toggleBold().run()}
          />
          <ToolButton
            icon={Italic}
            label="Cursiva"
            pressed={state.italic}
            onClick={() => chain().toggleItalic().run()}
          />
          <ToolButton
            icon={Heading2}
            label="Título"
            pressed={state.h2}
            onClick={() => chain().toggleHeading({ level: 2 }).run()}
          />
          <ToolButton
            icon={Heading3}
            label="Subtítulo"
            pressed={state.h3}
            onClick={() => chain().toggleHeading({ level: 3 }).run()}
          />
          <ToolButton
            icon={List}
            label="Lista"
            pressed={state.bulletList}
            onClick={() => chain().toggleBulletList().run()}
          />
          <ToolButton
            icon={ListOrdered}
            label="Lista numerada"
            pressed={state.orderedList}
            onClick={() => chain().toggleOrderedList().run()}
          />
          <ToolButton
            icon={Quote}
            label="Cita"
            pressed={state.blockquote}
            onClick={() => chain().toggleBlockquote().run()}
          />
          <ToolButton
            icon={Link2}
            label={state.link ? 'Cambiar enlace' : 'Enlace'}
            pressed={state.link}
            onClick={() => openDialog('link')}
          />
          <ToolButton icon={Video} label="Video o publicación" onClick={() => openDialog('embed')} />
          <ToolButton icon={Minus} label="Separador" onClick={() => chain().setHorizontalRule().run()} />
          <ToolButton
            icon={Undo2}
            label="Deshacer"
            disabled={!state.canUndo}
            onClick={() => chain().undo().run()}
          />
          <ToolButton
            icon={Redo2}
            label="Rehacer"
            disabled={!state.canRedo}
            onClick={() => chain().redo().run()}
          />
        </div>
        <EditorContent editor={editor} />
      </div>
      {help && <p className="text-sm text-neutral-600">{help}</p>}
      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <MediaPicker
        label="Foto dentro del texto"
        help="Se inserta donde está el cursor."
        required={false}
        value={null}
        onChange={(media) => {
          if (!media?.thumb) return
          chain()
            .insertContent({ type: 'image', attrs: { src: media.thumb, alt: media.alt, mediaId: media.id } })
            .run()
        }}
      />

      <dialog
        ref={dialogRef}
        aria-labelledby={`${uid}-dialog`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-paper p-5 text-ink shadow-2xl backdrop:bg-ink/60"
      >
        {/* Sin <form>: el editor ya vive dentro del formulario de la pantalla. */}
        <div className="grid gap-3">
          <h2 id={`${uid}-dialog`} className="text-h3">
            {dialog.kind === 'link' ? 'Enlace' : 'Video o publicación'}
          </h2>
          <label className="grid gap-1">
            <span className="font-medium">
              {dialog.kind === 'link' ? 'Dirección del enlace' : 'Enlace de YouTube, Facebook o Instagram'}
            </span>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                // Enter confirma el diálogo; no debe enviar el formulario de la pantalla.
                event.preventDefault()
                submitUrl()
              }}
              placeholder="https://"
              aria-invalid={dialog.error ? true : undefined}
              className="block min-h-12 w-full rounded-md border border-neutral-500 bg-paper px-3 text-base"
            />
          </label>
          {dialog.error && <p className="text-sm font-medium text-danger">{dialog.error}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" size="lg" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </Button>
            <Button variant="dark" size="lg" onClick={submitUrl}>
              {dialog.kind === 'link' ? 'Poner enlace' : 'Insertar'}
            </Button>
          </div>
          {dialog.kind === 'link' && state.link && (
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                chain().extendMarkRange('link').unsetLink().run()
                dialogRef.current?.close()
              }}
            >
              Quitar el enlace
            </Button>
          )}
        </div>
      </dialog>
    </div>
  )
}
