import crypto from 'node:crypto'
import { loadLocalEnv } from './loadLocalEnv.js'

loadLocalEnv()

const COOKIE_NAME = 'analytics_practice_session'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
const HASH_ITERATIONS = 310000
const HASH_KEY_LENGTH = 32
const HASH_DIGEST = 'sha256'
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET

  if (!secret) {
    throw new Error('SESSION_SECRET is not configured')
  }

  return secret
}

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url')
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function json(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''

    req.on('data', (chunk) => {
      body += chunk

      if (body.length > 100000) {
        reject(new Error('Request body is too large'))
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })

    req.on('error', reject)
  })
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url')
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, HASH_DIGEST)
    .toString('base64url')

  return `pbkdf2:${HASH_DIGEST}:${HASH_ITERATIONS}:${salt}:${hash}`
}

export function verifyPassword(password, storedHash) {
  const [method, digest, iterations, salt, hash] = storedHash.split(':')

  if (method !== 'pbkdf2' || !digest || !iterations || !salt || !hash) {
    return false
  }

  const candidate = crypto
    .pbkdf2Sync(password, salt, Number(iterations), HASH_KEY_LENGTH, digest)
    .toString('base64url')

  return timingSafeEqual(candidate, hash)
}

export function createEmailVerificationToken(now = Date.now()) {
  const token = crypto.randomBytes(32).toString('base64url')

  return {
    token,
    tokenHash: hashEmailVerificationToken(token),
    expiresAt: new Date(now + EMAIL_VERIFICATION_TTL_MS),
  }
}

export function hashEmailVerificationToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

export function createSessionToken(user) {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = toBase64Url(
    JSON.stringify({
      sub: user.user_id || user._id.toString(),
      login: user.login,
      name: user.name || '',
      email: user.email || '',
      email_verified: Boolean(user.email_verified_at || user.email_verified),
      admin_status: Number(user.admin_status) === 1 ? 1 : 0,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  )
  const unsignedToken = `${header}.${payload}`

  return `${unsignedToken}.${sign(unsignedToken)}`
}

export function verifySessionToken(token) {
  if (!token) {
    return null
  }

  const [header, payload, signature] = token.split('.')

  if (!header || !payload || !signature) {
    return null
  }

  const unsignedToken = `${header}.${payload}`
  const expectedSignature = sign(unsignedToken)

  if (!timingSafeEqual(signature, expectedSignature)) {
    return null
  }

  try {
    const session = JSON.parse(fromBase64Url(payload))

    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return session
  } catch {
    return null
  }
}

export function getCookie(req, name) {
  const cookieHeader = req.headers.cookie || ''
  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim())
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.slice(name.length + 1)) : ''
}

export function getSessionFromRequest(req) {
  return verifySessionToken(getCookie(req, COOKIE_NAME))
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(
      token,
    )}; HttpOnly; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; SameSite=Lax${secure}`,
  )
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`,
  )
}

export function serializeUser(user) {
  return {
    user_id: user.user_id || user._id?.toString() || user.sub,
    login: user.login,
    name: user.name || '',
    email: user.email || '',
    email_verified: Boolean(user.email_verified_at || user.email_verified),
    admin_status: Number(user.admin_status) === 1 ? 1 : 0,
  }
}
