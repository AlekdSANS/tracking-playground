import { createUser, isDuplicateLoginError } from './_lib/postgres.js'
import {
  createSessionToken,
  hashPassword,
  json,
  parseJsonBody,
  serializeUser,
  setSessionCookie,
} from './_lib/auth.js'

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
    const password = String(body.password || '')

    if (!isValidLogin(login) || password.length < 8) {
      json(res, 400, {
        error:
          'Use a 3-32 character login and a password with at least 8 characters.',
      })
      return
    }

    const user = await createUser({
      login,
      name,
      pass: hashPassword(password),
    })

    setSessionCookie(res, createSessionToken(user))
    json(res, 201, { user: serializeUser(user) })
  } catch (error) {
    if (isDuplicateLoginError(error)) {
      json(res, 409, { error: 'An account with this login already exists.' })
      return
    }

    console.error('Register API error:', error)
    json(res, 500, { error: getRegisterErrorMessage(error) })
  }
}
