import { Readable } from 'node:stream'
import process from 'node:process'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const database = vi.hoisted(() => ({
  createUser: vi.fn(),
  findUserByLogin: vi.fn(),
  isDuplicateLoginError: vi.fn(
    (error) => error?.code === '23505' && error?.constraint === 'users_login_unique',
  ),
}))

vi.mock('../../api/_lib/postgres.js', () => database)

import loginHandler from '../../api/login.js'
import logoutHandler from '../../api/logout.js'
import registerHandler from '../../api/register.js'
import { hashPassword, verifyPassword, verifySessionToken } from '../../api/_lib/auth.js'

function createRequest({ method = 'POST', body = {} } = {}) {
  const request = Readable.from([JSON.stringify(body)])
  request.method = method
  request.headers = {}
  request.query = {}
  return request
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

function readSession(response) {
  const cookie = response.getHeader('Set-Cookie')
  const token = String(cookie).match(/analytics_practice_session=([^;]+)/)?.[1]
  return verifySessionToken(decodeURIComponent(token || ''))
}

describe('authentication API with PostgreSQL persistence', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret-with-enough-entropy'
    database.createUser.mockReset()
    database.findUserByLogin.mockReset()
    database.isDuplicateLoginError.mockClear()
  })

  test('registers a user without changing the password or session formats', async () => {
    database.createUser.mockImplementation(async ({ login, name, pass }) => ({
      user_id: 'e12647df-9d97-4849-8dd9-b721ab7f2352',
      login,
      name,
      pass,
      admin_status: 1,
    }))
    const request = createRequest({
      body: { login: 'FirstAdmin', name: 'Alex', password: 'password123' },
    })
    const response = createResponse()

    await registerHandler(request, response)

    expect(response.statusCode).toBe(201)
    expect(response.json().user).toEqual({
      user_id: 'e12647df-9d97-4849-8dd9-b721ab7f2352',
      login: 'firstadmin',
      name: 'Alex',
      admin_status: 1,
    })
    const savedPassword = database.createUser.mock.calls[0][0].pass
    expect(savedPassword).toMatch(/^pbkdf2:sha256:310000:/)
    expect(verifyPassword('password123', savedPassword)).toBe(true)
    expect(readSession(response)).toMatchObject({
      sub: 'e12647df-9d97-4849-8dd9-b721ab7f2352',
      login: 'firstadmin',
      admin_status: 1,
    })
  })

  test('logs in with an existing compatible password hash', async () => {
    database.findUserByLogin.mockResolvedValue({
      user_id: 'legacy-mongodb-object-id',
      login: 'alex',
      name: 'Alex',
      pass: hashPassword('password123'),
      admin_status: 0,
    })
    const request = createRequest({
      body: { login: 'ALEX', password: 'password123' },
    })
    const response = createResponse()

    await loginHandler(request, response)

    expect(database.findUserByLogin).toHaveBeenCalledWith('alex')
    expect(response.statusCode).toBe(200)
    expect(response.json().user.user_id).toBe('legacy-mongodb-object-id')
    expect(readSession(response)).toMatchObject({
      sub: 'legacy-mongodb-object-id',
      login: 'alex',
    })
  })

  test('rejects duplicate logins reported by the PostgreSQL constraint', async () => {
    database.createUser.mockRejectedValue({
      code: '23505',
      constraint: 'users_login_unique',
    })
    const request = createRequest({
      body: { login: 'alex', name: 'Alex', password: 'password123' },
    })
    const response = createResponse()

    await registerHandler(request, response)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'An account with this login already exists.',
    })
  })

  test('logs out by expiring the existing session cookie', async () => {
    const response = createResponse()

    await logoutHandler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ user: null })
    expect(response.getHeader('Set-Cookie')).toContain('Max-Age=0')
  })
})
