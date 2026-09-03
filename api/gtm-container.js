import { json, requireVerifiedAdminSession } from './_lib/auth.js'
import { getGtmAccessFromRequest, readContainerSnapshot } from './_lib/gtmOAuth.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  if (!requireVerifiedAdminSession(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  const session = getGtmAccessFromRequest(req)
  if (!session) return json(res, 401, { error: 'Connect Google Tag Manager again.' })
  try {
    const snapshot = await readContainerSnapshot(req.query?.publicId, session.accessToken)
    return json(res, 200, snapshot)
  } catch (error) {
    return json(res, error.statusCode === 401 ? 401 : error.statusCode === 403 ? 403 : 400, { error: error.message })
  }
}
