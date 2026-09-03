import process from 'node:process'
import { beforeEach, describe, expect, test } from 'vitest'
import { createSessionToken } from '../../api/_lib/auth.js'
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

function createRequest({ method = 'GET', user } = {}) {
  const headers = {}

  if (user) {
    const token = createSessionToken(user)
    headers.cookie = `analytics_practice_session=${encodeURIComponent(token)}`
  }

  return { method, headers, query: {} }
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
  })

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
    const user = {
      user_id: 'admin-1',
      login: 'admin',
      email: 'admin@example.com',
      email_verified: true,
      admin_status: 1,
    }

    await statusHandler(createRequest({ user }), response)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual(expect.objectContaining({ configured: expect.any(Boolean) }))
  })
})

