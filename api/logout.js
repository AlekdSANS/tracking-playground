import { clearSessionCookie, json } from './_lib/auth.js'
import { clearGtmAccessCookie, clearOAuthStateCookie } from './_lib/gtmOAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { error: 'Method not allowed' })
    return
  }

  clearSessionCookie(res)
  clearOAuthStateCookie(res)
  clearGtmAccessCookie(res)
  json(res, 200, { user: null })
}
