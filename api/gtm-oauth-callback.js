import { json, requireVerifiedAdminSession } from './_lib/auth.js'
import {
  GTM_API_SESSION_SECONDS,
  clearOAuthStateCookie,
  exchangeAuthorizationCode,
  getGtmOAuthConfig,
  getOAuthStateFromRequest,
  isGtmApiConfigured,
  readOAuthState,
  sealAccessSession,
  setGtmAccessCookie,
} from './_lib/gtmOAuth.js'

function returnToWorkspace(res, containerId, result) {
  res.statusCode = 302
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', `/tag-workspace#container=${encodeURIComponent(containerId)}&gtmApi=${result}`)
  res.end()
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!requireVerifiedAdminSession(req, res)) return
  if (!isGtmApiConfigured()) return json(res, 503, { error: 'GTM API integration is not configured.' })
  const cookieState = getOAuthStateFromRequest(req)
  const queryState = String(req.query?.state || '')
  const state = readOAuthState(queryState)
  clearOAuthStateCookie(res)
  if (!state || !cookieState || cookieState !== queryState) return json(res, 400, { error: 'OAuth state is invalid or expired.' })
  if (req.query?.error || !req.query?.code) return returnToWorkspace(res, state.containerId, 'cancelled')
  try {
    const token = await exchangeAuthorizationCode(String(req.query.code), getGtmOAuthConfig())
    const expiresIn = Math.min(token.expiresIn, GTM_API_SESSION_SECONDS)
    const session = sealAccessSession({
      accessToken: token.accessToken,
      scope: 'readonly',
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    })
    setGtmAccessCookie(res, session, expiresIn)
    returnToWorkspace(res, state.containerId, 'connected')
  } catch {
    returnToWorkspace(res, state.containerId, 'error')
  }
}
