import {
  createUser,
  isDuplicateEmailError,
  isDuplicateLoginError,
} from './_lib/postgres.js'
import {
  createEmailVerificationToken,
  hashPassword,
  json,
  parseJsonBody,
  serializeUser,
} from './_lib/auth.js'
import {
  isValidEmail,
  normalizeEmail,
  sendVerificationEmail,
} from './_lib/verificationEmail.js'

function isValidLogin(login) {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(login)
}

function getRegisterErrorMessage(error) {
  if (error.message === 'DATABASE_URL is not configured') {
    return 'PostgreSQL is not configured.'
  }

  if (
    error.code === 'CONNECT_TIMEOUT' ||
    error.code === 'ECONNREFUSED' ||
    error.message?.includes('timed out') ||
    error.message?.includes('ENOTFOUND')
  ) {
    return 'The database is temporarily unavailable.'
  }

  return 'Could not create account.'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const body = await parseJsonBody(req)
    const login = String(body.login || '').trim().toLowerCase()
    const name = String(body.name || '').trim()
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')

    if (!isValidLogin(login) || !isValidEmail(email) || password.length < 8) {
      json(res, 400, {
        error:
          'Use a valid email, a 3-32 character login, and a password with at least 8 characters.',
      })
      return
    }

    const verification = createEmailVerificationToken()
    const user = await createUser({
      login,
      name,
      email,
      pass: hashPassword(password),
      verificationTokenHash: verification.tokenHash,
      verificationExpiresAt: verification.expiresAt,
    })

    try {
      await sendVerificationEmail({ email, name, token: verification.token })
    } catch (error) {
      console.error('Registration verification email error:', error)
      json(res, 502, {
        error: 'Account created, but the verification email could not be sent. Request a new link.',
      })
      return
    }

    json(res, 201, {
      user: serializeUser(user),
      verificationRequired: true,
      message: 'Account created. Check your email to verify it before logging in.',
    })
  } catch (error) {
    if (isDuplicateLoginError(error)) {
      json(res, 409, { error: 'An account with this login already exists.' })
      return
    }

    if (isDuplicateEmailError(error)) {
      json(res, 409, { error: 'An account with this email already exists.' })
      return
    }

    console.error('Register API error:', error)
    json(res, 500, { error: getRegisterErrorMessage(error) })
  }
}
