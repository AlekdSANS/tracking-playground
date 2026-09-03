import { json, requireVerifiedAdminSession } from './_lib/auth.js'
import {
  buildGoogleAuthorizationUrl,
  createOAuthState,
  getGtmOAuthConfig,
  isGtmApiConfigured,
  setOAuthStateCookie,
} from './_lib/gtmOAuth.js'

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  const appSession = requireVerifiedAdminSession(req, res)
  if (!appSession) return
  if (!isGtmApiConfigured()) return json(res, 503, { error: 'GTM API integration is not configured.' })
  try {
    const state = createOAuthState(req.query?.container, appSession.sub)
    setOAuthStateCookie(res, state)
    res.statusCode = 302
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Location', buildGoogleAuthorizationUrl(state, getGtmOAuthConfig()))
    res.end()
  } catch (error) {
    json(res, 400, { error: error.message })
  }
}
