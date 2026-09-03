import { createEmailVerificationToken, json, parseJsonBody } from './_lib/auth.js'
import { prepareEmailVerification } from './_lib/postgres.js'
import {
  isValidEmail,
  normalizeEmail,
  sendVerificationEmail,
} from './_lib/verificationEmail.js'

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an unverified account exists for that email, a new link has been sent.',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const body = await parseJsonBody(req)
    const email = normalizeEmail(body.email)

    if (!isValidEmail(email)) {
      return json(res, 400, { error: 'Enter a valid email address.' })
    }

    const verification = createEmailVerificationToken()
    const user = await prepareEmailVerification({
      email,
      verificationTokenHash: verification.tokenHash,
      verificationExpiresAt: verification.expiresAt,
    })

    if (user) {
      try {
        await sendVerificationEmail({
          email: user.email,
          name: user.name,
          token: verification.token,
        })
      } catch (error) {
        console.error('Resend verification email error:', error)
      }
    }

    return json(res, 200, GENERIC_RESPONSE)
  } catch (error) {
    console.error('Resend confirmation error:', error)
    return json(res, 500, { error: 'Could not process the confirmation request.' })
  }
}

