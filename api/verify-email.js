import { hashEmailVerificationToken, json } from './_lib/auth.js'
import { verifyUserEmail } from './_lib/postgres.js'

function redirectToLogin(res, result) {
  res.statusCode = 302
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', `/login?verification=${result}`)
  res.end()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  const token = String(req.query?.token || '')

  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return redirectToLogin(res, 'invalid')
  }

  try {
    const user = await verifyUserEmail(hashEmailVerificationToken(token))
    return redirectToLogin(res, user ? 'success' : 'invalid')
  } catch (error) {
    console.error('Email verification error:', error)
    return redirectToLogin(res, 'error')
  }
}

