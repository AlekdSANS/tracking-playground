import process from 'node:process'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createSessionToken } from '../../api/_lib/auth.js'
import {
  GTM_ACCESS_COOKIE,
  GTM_API_SESSION_SECONDS,
  GTM_STATE_COOKIE,
  createOAuthState,
  readOAuthState,
  sealAccessSession,
} from '../../api/_lib/gtmOAuth.js'
import containerHandler from '../../api/gtm-container.js'
import disconnectHandler from '../../api/gtm-disconnect.js'
import oauthCallbackHandler from '../../api/gtm-oauth-callback.js'
import oauthStartHandler from '../../api/gtm-oauth-start.js'
import statusHandler from '../../api/gtm-status.js'

const endpoints = [
  ['status', statusHandler, 'GET'],
  ['OAuth start', oauthStartHandler, 'GET'],
  ['OAuth callback', oauthCallbackHandler, 'GET'],
  ['container', containerHandler, 'GET'],
  ['disconnect', disconnectHandler, 'POST'],
]

const GTM_SECRET = 'test-gtm-cookie-secret-with-more-than-thirty-two-characters'
const VERIFIED_ADMIN = {
  user_id: 'admin-1',
  login: 'admin',
  email: 'admin@example.com',
  email_verified: true,
  admin_status: 1,
}

function createRequest({ method = 'GET', user, cookies = [], query = {} } = {}) {
  const headers = {}
  const cookieValues = [...cookies]

  if (user) {
    const token = createSessionToken(user)
    cookieValues.unshift(`analytics_practice_session=${encodeURIComponent(token)}`)
  }

  if (cookieValues.length) headers.cookie = cookieValues.join('; ')
  return { method, headers, query }
}

function createResponse() {
  const headers = new Map()

  return {
    statusCode: 200,
    body: '',
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value)
    },
    getHeader(name) {
      return headers.get(name.toLowerCase())
    },
    end(body = '') {
      this.body = body
    },
    json() {
      return JSON.parse(this.body)
    },
  }
}

describe('GTM API authorization', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy'
    process.env.GTM_GOOGLE_CLIENT_ID = 'client-id'
    process.env.GTM_GOOGLE_CLIENT_SECRET = 'client-secret'
    process.env.GTM_OAUTH_REDIRECT_URI = 'https://practice.example/api/gtm-oauth-callback'
    process.env.GTM_OAUTH_COOKIE_SECRET = GTM_SECRET
  })

  afterEach(() => vi.unstubAllGlobals())

  test.each(endpoints)('rejects anonymous requests to %s', async (_name, handler, method) => {
    const response = createResponse()

    await handler(createRequest({ method }), response)

    expect(response.statusCode).toBe(401)
    expect(response.json().error).toMatch(/sign in/i)
  })

  test.each([
    ['an unverified administrator', { email_verified: false, admin_status: 1 }],
    ['a verified basic user', { email_verified: true, admin_status: 0 }],
  ])('rejects %s', async (_label, access) => {
    const response = createResponse()
    const user = {
      user_id: 'user-1',
      login: 'user',
      email: 'user@example.com',
      ...access,
    }

    await statusHandler(createRequest({ user }), response)

    expect(response.statusCode).toBe(403)
  })

  test('allows the verified administrator through the API boundary', async () => {
    const response = createResponse()

    await statusHandler(createRequest({ user: VERIFIED_ADMIN }), response)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ configured: true }))
  })

  test('accepts a GTM authorization only for the application account that created it', async () => {
    const accessSession = sealAccessSession({
      accessToken: 'google-access-token',
      userId: VERIFIED_ADMIN.user_id,
      scope: 'readonly',
      exp: Math.floor(Date.now() / 1000) + GTM_API_SESSION_SECONDS,
    }, GTM_SECRET)
    const gtmCookie = `${GTM_ACCESS_COOKIE}=${encodeURIComponent(accessSession)}`
    const ownerResponse = createResponse()
    const otherResponse = createResponse()

    await statusHandler(createRequest({ user: VERIFIED_ADMIN, cookies: [gtmCookie] }), ownerResponse)
    await statusHandler(createRequest({
      user: { ...VERIFIED_ADMIN, user_id: 'admin-2', email: 'other-admin@example.com' },
      cookies: [gtmCookie],
    }), otherResponse)

    expect(ownerResponse.json()).toMatchObject({ connected: true, scope: 'readonly' })
    expect(otherResponse.json()).toMatchObject({ connected: false, scope: null })
  })

  test('does not call Google when another account presents the GTM access cookie', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const accessSession = sealAccessSession({
      accessToken: 'google-access-token',
      userId: VERIFIED_ADMIN.user_id,
      scope: 'readonly',
      exp: Math.floor(Date.now() / 1000) + GTM_API_SESSION_SECONDS,
    }, GTM_SECRET)
    const response = createResponse()

    await containerHandler(createRequest({
      user: { ...VERIFIED_ADMIN, user_id: 'admin-2' },
      cookies: [`${GTM_ACCESS_COOKIE}=${encodeURIComponent(accessSession)}`],
      query: { publicId: 'GTM-SAFE123' },
    }), response)

    expect(response.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('binds OAuth state to the administrator who starts the flow', async () => {
    const response = createResponse()

    await oauthStartHandler(createRequest({
      user: VERIFIED_ADMIN,
      query: { container: 'GTM-SAFE123' },
    }), response)

    const state = new URL(response.getHeader('Location')).searchParams.get('state')
    expect(response.statusCode).toBe(302)
    expect(readOAuthState(state, VERIFIED_ADMIN.user_id, GTM_SECRET)).toMatchObject({ containerId: 'GTM-SAFE123' })
    expect(readOAuthState(state, 'admin-2', GTM_SECRET)).toBeNull()
  })

  test('rejects an OAuth callback after the signed-in account changes', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const state = createOAuthState('GTM-SAFE123', VERIFIED_ADMIN.user_id, GTM_SECRET)
    const response = createResponse()

    await oauthCallbackHandler(createRequest({
      user: { ...VERIFIED_ADMIN, user_id: 'admin-2' },
      cookies: [`${GTM_STATE_COOKIE}=${encodeURIComponent(state)}`],
      query: { state, code: 'authorization-code' },
    }), response)

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/state is invalid/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
