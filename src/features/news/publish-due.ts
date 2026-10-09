import 'server-only'
import { and, eq, lte, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { auditLog, news } from '@/db/schema'

/**
 * Publica las noticias programadas cuya hora ya llegó (especificación 3.4). La llama la tarea `tick`;
 * es idempotente: una segunda llamada no encuentra nada que publicar.
 */
export async function publishDueNews(): Promise<{ id: string; title: string }[]> {
  return db.transaction(async (tx) => {
    const published = await tx
      .update(news)
      .set({ status: 'publicada' })
      .where(and(eq(news.status, 'programada'), lte(news.publishedAt, sql`now()`)))
      .returning({ id: news.id, title: news.title })
    if (published.length > 0) {
      // Sin usuario: lo hizo la tarea programada.
      await tx.insert(auditLog).values(
        published.map((row) => ({
          action: 'news.publish.scheduled',
          entityType: 'news',
          entityId: row.id,
          summary: `Se publicó la noticia programada «${row.title}»`,
        })),
      )
    }
    return published
  })
}
