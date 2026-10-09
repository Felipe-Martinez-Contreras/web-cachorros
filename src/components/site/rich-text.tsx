import { ExternalLink } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import type { RichTextDoc, RichTextNode } from '@/db/schema/_columns'
import { cn } from '@/lib/cn'
import type { ImageDTO } from '@/lib/images/dto'
import { socialPlatformLabels } from '@/lib/labels'
import { safeHref } from '@/lib/rich-text/document'
import { parseEmbedUrl } from '@/lib/rich-text/embed'
import { ClubImage } from './club-image'
import { YoutubeFacade } from './youtube-facade'

type Images = Record<string, ImageDTO>

function renderText(node: RichTextNode): ReactNode {
  let out: ReactNode = node.text ?? ''
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>
    if (mark.type === 'italic') out = <em>{out}</em>
    if (mark.type === 'link') {
      // Se vuelve a comprobar al dibujar: nunca sale un enlace con un protocolo no permitido.
      const href = safeHref(mark.attrs?.href)
      if (href) {
        out = (
          <a href={href} rel="noopener noreferrer">
            {out}
          </a>
        )
      }
    }
  }
  return out
}

function renderNode(node: RichTextNode, images: Images): ReactNode {
  const inner = () => renderNodes(node.content, images)
  switch (node.type) {
    case 'text':
      return renderText(node)
    case 'hardBreak':
      return <br />
    case 'paragraph':
      return node.content?.length ? <p>{inner()}</p> : null
    case 'heading': {
      const Heading = node.attrs?.level === 3 ? 'h3' : node.attrs?.level === 4 ? 'h4' : 'h2'
      return <Heading>{inner()}</Heading>
    }
    case 'bulletList':
      return <ul>{inner()}</ul>
    case 'orderedList':
      return <ol>{inner()}</ol>
    case 'listItem':
      return <li>{inner()}</li>
    case 'blockquote':
      return <blockquote>{inner()}</blockquote>
    case 'horizontalRule':
      return <hr />
    case 'image': {
      const image = typeof node.attrs?.mediaId === 'string' ? images[node.attrs.mediaId] : undefined
      if (!image) return null
      return (
        <figure>
          <ClubImage image={image} sizes="(min-width: 768px) 720px, 100vw" />
          {image.credit && <figcaption>Foto: {image.credit}</figcaption>}
        </figure>
      )
    }
    case 'embed': {
      const embed = parseEmbedUrl(node.attrs?.url)
      if (!embed) return null
      if (embed.provider === 'youtube' && embed.videoId) {
        return <YoutubeFacade videoId={embed.videoId} url={embed.url} />
      }
      return (
        <p>
          <a
            href={embed.url}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold"
          >
            Ver la publicación en {socialPlatformLabels[embed.provider]}
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
        </p>
      )
    }
    default:
      // Un nodo fuera de la lista blanca no se dibuja (el documento ya se validó al guardarlo).
      return null
  }
}

function renderNodes(nodes: RichTextNode[] | undefined, images: Images): ReactNode {
  return (nodes ?? []).map((node, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: los nodos del documento no tienen identidad propia
    <Fragment key={index}>{renderNode(node, images)}</Fragment>
  ))
}

/**
 * Render en el servidor del texto enriquecido con lista blanca de nodos (especificación 6.1): cada nodo se
 * convierte en su elemento de React, sin `dangerouslySetInnerHTML`. Las imágenes salen de la biblioteca.
 */
export function RichText({
  doc,
  images = {},
  className,
}: {
  doc: RichTextDoc | null
  images?: Images
  className?: string
}) {
  if (!doc?.content?.length) return null
  return <div className={cn('rich-text', className)}>{renderNodes(doc.content, images)}</div>
}
