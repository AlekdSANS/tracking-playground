import { Readable } from 'node:stream'
import process from 'node:process'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const database = vi.hoisted(() => ({
  createUser: vi.fn(),
  findUserByLogin: vi.fn(),
  prepareEmailVerification: vi.fn(),
  verifyUserEmail: vi.fn(),
  isDuplicateEmailError: vi.fn(
    (error) => error?.code === '23505' && error?.constraint === 'users_email_unique_idx',
  ),
  isDuplicateLoginError: vi.fn(
    (error) => error?.code === '23505' && error?.constraint === 'users_login_unique',
  ),
}))
const emailDelivery = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }))

vi.mock('../../api/_lib/postgres.js', () => database)
vi.mock('../../api/_lib/verificationEmail.js', () => ({
  isValidEmail: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')),
  normalizeEmail: (value) => String(value || '').trim().toLowerCase(),
  sendVerificationEmail: emailDelivery.sendVerificationEmail,
}))

import loginHandler from '../../api/login.js'
import logoutHandler from '../../api/logout.js'
import registerHandler from '../../api/register.js'
import resendConfirmationHandler from '../../api/resend-confirmation.js'
import verifyEmailHandler from '../../api/verify-email.js'
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  hashPassword,
  verifyPassword,
  verifySessionToken,
} from '../../api/_lib/auth.js'

function createRequest({ method = 'POST', body = {}, query = {} } = {}) {
  const request = Readable.from([JSON.stringify(body)])
  request.method = method
  request.headers = {}
  request.query = query
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
    database.prepareEmailVerification.mockReset()
    database.verifyUserEmail.mockReset()
    database.isDuplicateEmailError.mockClear()
    database.isDuplicateLoginError.mockClear()
    emailDelivery.sendVerificationEmail.mockReset()
    emailDelivery.sendVerificationEmail.mockResolvedValue({ id: 'email-1' })
  })

  test('registers a user and sends a verification link without creating a session', async () => {
    database.createUser.mockImplementation(async ({ login, name, email, pass }) => ({
      user_id: 'e12647df-9d97-4849-8dd9-b721ab7f2352',
      login,
      name,
      email,
      pass,
      email_verified_at: null,
      admin_status: 1,
    }))
    const request = createRequest({
      body: {
        email: 'Alex@Example.com',
        login: 'FirstAdmin',
        name: 'Alex',
        password: 'password123',
      },
    })
    const response = createResponse()

    await registerHandler(request, response)

    expect(response.statusCode).toBe(201)
    expect(response.json().user).toEqual({
      user_id: 'e12647df-9d97-4849-8dd9-b721ab7f2352',
      login: 'firstadmin',
      name: 'Alex',
      email: 'alex@example.com',
      email_verified: false,
      admin_status: 1,
    })
    expect(response.json().verificationRequired).toBe(true)
    expect(response.getHeader('Set-Cookie')).toBeUndefined()
    const savedUser = database.createUser.mock.calls[0][0]
    const savedPassword = savedUser.pass
    expect(savedPassword).toMatch(/^pbkdf2:sha256:310000:/)
    expect(verifyPassword('password123', savedPassword)).toBe(true)
    const sentToken = emailDelivery.sendVerificationEmail.mock.calls[0][0].token
    expect(hashEmailVerificationToken(sentToken)).toBe(savedUser.verificationTokenHash)
    expect(emailDelivery.sendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({
      email: 'alex@example.com',
      name: 'Alex',
    }))
  })

  test('logs in with an existing compatible password hash', async () => {
    database.findUserByLogin.mockResolvedValue({
      user_id: 'legacy-mongodb-object-id',
      login: 'alex',
      name: 'Alex',
      email: 'alex@example.com',
      pass: hashPassword('password123'),
      email_verified_at: new Date(),
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
      email: 'alex@example.com',
      email_verified: true,
    })
  })

  test('blocks login until the account email is verified', async () => {
    database.findUserByLogin.mockResolvedValue({
      user_id: 'user-1',
      login: 'alex',
      name: 'Alex',
      email: 'alex@example.com',
      pass: hashPassword('password123'),
      email_verified_at: null,
      admin_status: 0,
    })
    const response = createResponse()

    await loginHandler(createRequest({
      body: { login: 'alex', password: 'password123' },
    }), response)

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
    expect(response.getHeader('Set-Cookie')).toBeUndefined()
  })

  test('rejects duplicate logins reported by the PostgreSQL constraint', async () => {
    database.createUser.mockRejectedValue({
      code: '23505',
      constraint: 'users_login_unique',
    })
    const request = createRequest({
      body: {
        email: 'alex@example.com',
        login: 'alex',
        name: 'Alex',
        password: 'password123',
      },
    })
    const response = createResponse()

    await registerHandler(request, response)

    expect(response.statusCode).toBe(409)
    expect(response.json()).toEqual({
      error: 'An account with this login already exists.',
    })
  })

  test('requires a valid email during registration', async () => {
    const response = createResponse()

    await registerHandler(createRequest({
      body: { login: 'alex', name: 'Alex', password: 'password123' },
    }), response)

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toMatch(/valid email/i)
    expect(database.createUser).not.toHaveBeenCalled()
    expect(emailDelivery.sendVerificationEmail).not.toHaveBeenCalled()
  })

  test('rejects duplicate emails reported by the PostgreSQL constraint', async () => {
    database.createUser.mockRejectedValue({
      code: '23505',
      constraint: 'users_email_unique_idx',
    })
    const response = createResponse()

    await registerHandler(createRequest({
      body: {
        email: 'alex@example.com',
        login: 'another-login',
        name: 'Alex',
        password: 'password123',
      },
    }), response)

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toMatch(/email already exists/i)
  })

  test('verifies a valid email token and redirects to login', async () => {
    const verification = createEmailVerificationToken()
    database.verifyUserEmail.mockResolvedValue({ user_id: 'user-1' })
    const response = createResponse()

    await verifyEmailHandler(createRequest({
      method: 'GET',
      query: { token: verification.token },
    }), response)

    expect(database.verifyUserEmail).toHaveBeenCalledWith(verification.tokenHash)
    expect(response.statusCode).toBe(302)
    expect(response.getHeader('Location')).toBe('/login?verification=success')
  })

  test('resends verification with a generic non-enumerating response', async () => {
    database.prepareEmailVerification.mockResolvedValue({
      user_id: 'user-1',
      name: 'Alex',
      email: 'alex@example.com',
    })
    const response = createResponse()

    await resendConfirmationHandler(createRequest({
      body: { email: 'ALEX@example.com' },
    }), response)

    expect(response.statusCode).toBe(200)
    expect(response.json().message).toMatch(/if an unverified account exists/i)
    expect(database.prepareEmailVerification).toHaveBeenCalledWith(expect.objectContaining({
      email: 'alex@example.com',
    }))
    expect(emailDelivery.sendVerificationEmail).toHaveBeenCalledOnce()
  })

  test('logs out by expiring the application and GTM cookies', async () => {
    const response = createResponse()

    await logoutHandler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ user: null })
    const cookies = response.getHeader('Set-Cookie')
    expect(cookies).toHaveLength(3)
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringMatching(/^analytics_practice_session=.*Max-Age=0/),
      expect.stringMatching(/^gtm_api_oauth_state=.*Max-Age=0/),
      expect.stringMatching(/^gtm_api_access=.*Max-Age=0/),
    ]))
  })
})
