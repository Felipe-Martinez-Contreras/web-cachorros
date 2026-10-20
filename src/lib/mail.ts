import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '@/lib/env'
import { logger, maskEmail } from '@/lib/logger'

let transporter: Transporter | undefined

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' } : undefined,
  })
  return transporter
}

export type MailMessage = {
  to: string | string[]
  subject: string
  text: string
  /** Responder llega a esta dirección (la de quien escribió por un formulario). */
  replyTo?: string
}

/** Envía un correo de texto por SMTP. Lanza si el proveedor lo rechaza: quien llama decide qué hacer. */
export async function sendMail(message: MailMessage): Promise<void> {
  await getTransporter().sendMail({ from: env.MAIL_FROM, ...message })
  const to = (Array.isArray(message.to) ? message.to : [message.to]).map(maskEmail)
  logger.info({ to, subject: message.subject }, 'correo enviado')
}
