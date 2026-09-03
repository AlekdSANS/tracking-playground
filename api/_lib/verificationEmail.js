import { Resend } from 'resend'
import { loadLocalEnv } from './loadLocalEnv.js'

loadLocalEnv()

const DEFAULT_SENDER = 'Tracking Playground <onboarding@resend.dev>'

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidEmail(value) {
  const email = normalizeEmail(value)
  const [localPart = '', domain = ''] = email.split('@')

  return email.length <= 254
    && localPart.length > 0
    && localPart.length <= 64
    && domain.includes('.')
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getVerificationUrl(token) {
  const configuredUrl = process.env.APP_URL

  if (!configuredUrl) {
    throw new Error('APP_URL is not configured')
  }

  const url = new URL('/api/verify-email', configuredUrl)
  url.searchParams.set('token', token)

  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('APP_URL must use HTTPS in production')
  }

  return url.toString()
}

export async function sendVerificationEmail({ email, name, token }) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const verificationUrl = getVerificationUrl(token)
  const recipientName = String(name || '').trim() || 'there'
  const resend = new Resend(apiKey)
  const result = await resend.emails.send({
    from: process.env.AUTH_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || DEFAULT_SENDER,
    to: email,
    subject: 'Verify your Tracking Playground account',
    text: `Hi ${recipientName}, verify your account within 24 hours: ${verificationUrl}`,
    html: `
      <h1>Verify your account</h1>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p>Confirm this email address to activate your Tracking Playground account.</p>
      <p><a href="${escapeHtml(verificationUrl)}">Verify email address</a></p>
      <p>This link expires in 24 hours. If you did not create this account, ignore this email.</p>
    `,
  })

  if (result.error) {
    const error = new Error('Verification email could not be sent')
    error.cause = result.error
    throw error
  }

  return result.data
}

