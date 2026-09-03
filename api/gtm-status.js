import { json, requireVerifiedAdminSession } from './_lib/auth.js'
import { getGtmAccessFromRequest, isGtmApiConfigured } from './_lib/gtmOAuth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  const appSession = requireVerifiedAdminSession(req, res)
  if (!appSession) return
  res.setHeader('Cache-Control', 'no-store')
  if (!isGtmApiConfigured()) return json(res, 200, { configured: false, connected: false })
  const session = getGtmAccessFromRequest(req, appSession.sub)
  return json(res, 200, {
    configured: true,
    connected: Boolean(session),
    scope: session ? 'readonly' : null,
    expiresAt: session ? session.exp * 1000 : null,
  })
}
