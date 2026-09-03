import { findUserByLogin } from './_lib/postgres.js'
import {
  createSessionToken,
  json,
  parseJsonBody,
  serializeUser,
  setSessionCookie,
  verifyPassword,
} from './_lib/auth.js'

function getLoginErrorMessage(error) {
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

  return 'Could not log in.'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const body = await parseJsonBody(req)
    const login = String(body.login || '').trim().toLowerCase()
    const password = String(body.password || '')

    const user = await findUserByLogin(login)

    if (!user || !verifyPassword(password, user.pass)) {
      json(res, 401, { error: 'Login or password is incorrect.' })
      return
    }

    setSessionCookie(res, createSessionToken(user))
    json(res, 200, { user: serializeUser(user) })
  } catch (error) {
    console.error('Login API error:', error)
    json(res, 500, { error: getLoginErrorMessage(error) })
  }
}
