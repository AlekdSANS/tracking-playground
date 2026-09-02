import { json } from './_lib/auth.js'
import { clearGtmAccessCookie, clearOAuthStateCookie } from './_lib/gtmOAuth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  clearOAuthStateCookie(res)
  clearGtmAccessCookie(res)
  res.setHeader('Cache-Control', 'no-store')
  return json(res, 200, { disconnected: true })
}
