import crypto from 'node:crypto'
import { getCookie } from './auth.js'
import { loadLocalEnv } from './loadLocalEnv.js'

loadLocalEnv()

export const GTM_READONLY_SCOPE = 'https://www.googleapis.com/auth/tagmanager.readonly'
export const GTM_API_SESSION_SECONDS = 10 * 60
export const GTM_STATE_COOKIE = 'gtm_api_oauth_state'
export const GTM_ACCESS_COOKIE = 'gtm_api_access'

const GTM_CONTAINER_ID = /^GTM-[A-Z0-9]{4,20}$/
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GTM_API_ROOT = 'https://tagmanager.googleapis.com/tagmanager/v2'

function getSecret() {
  const secret = process.env.GTM_OAUTH_COOKIE_SECRET
  if (!secret || secret.length < 32) throw new Error('GTM_OAUTH_COOKIE_SECRET must be at least 32 characters')
  return secret
}

function getEncryptionKey(secret) {
  return crypto.createHash('sha256').update(secret).digest()
}

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url')
}

function getAccountBinding(userId, secret) {
  const normalized = String(userId || '').trim()
  if (!normalized || normalized.length > 200) throw new Error('An authenticated account is required')
  return sign(`account:${normalized}`, secret)
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '')
  const rightBuffer = Buffer.from(right || '')
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

function cookieSuffix(maxAge, sameSite = 'Lax') {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `; HttpOnly; Path=/api; Max-Age=${maxAge}; SameSite=${sameSite}${secure}`
}

function appendCookie(res, value) {
  const current = res.getHeader('Set-Cookie')
  const values = current ? (Array.isArray(current) ? current : [current]) : []
  res.setHeader('Set-Cookie', [...values, value])
}

export function isValidGtmApiContainerId(value) {
  return GTM_CONTAINER_ID.test(String(value || '').trim().toUpperCase())
}

export function isGtmApiConfigured() {
  return Boolean(
    process.env.GTM_GOOGLE_CLIENT_ID
    && process.env.GTM_GOOGLE_CLIENT_SECRET
    && process.env.GTM_OAUTH_REDIRECT_URI
    && process.env.GTM_OAUTH_COOKIE_SECRET?.length >= 32,
  )
}

export function getGtmOAuthConfig() {
  if (!isGtmApiConfigured()) throw new Error('GTM API OAuth is not configured')
  return {
    clientId: process.env.GTM_GOOGLE_CLIENT_ID,
    clientSecret: process.env.GTM_GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GTM_OAUTH_REDIRECT_URI,
  }
}

export function createOAuthState(containerId, userId, secret = getSecret(), now = Date.now()) {
  const normalized = String(containerId || '').trim().toUpperCase()
  if (!isValidGtmApiContainerId(normalized)) throw new Error('A valid GTM container ID is required')
  const payload = Buffer.from(JSON.stringify({
    containerId: normalized,
    accountBinding: getAccountBinding(userId, secret),
    nonce: crypto.randomBytes(24).toString('base64url'),
    exp: Math.floor(now / 1000) + 10 * 60,
  })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function readOAuthState(value, userId, secret = getSecret(), now = Date.now()) {
  const [payload, signature] = String(value || '').split('.')
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null
  try {
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    const expectedBinding = getAccountBinding(userId, secret)
    if (
      !isValidGtmApiContainerId(state.containerId)
      || !state.nonce
      || !safeEqual(state.accountBinding, expectedBinding)
      || state.exp <= Math.floor(now / 1000)
    ) return null
    return state
  } catch {
    return null
  }
}

export function sealAccessSession(session, secret = getSecret()) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()])
  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`
}

export function openAccessSession(value, secret = getSecret(), now = Date.now()) {
  try {
    const [ivValue, encryptedValue, tagValue] = String(value || '').split('.')
    if (!ivValue || !encryptedValue || !tagValue) return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(secret), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, 'base64url')), decipher.final()])
    const session = JSON.parse(decrypted.toString('utf8'))
    if (!session.accessToken || !session.userId || !session.exp || session.exp <= Math.floor(now / 1000)) return null
    return session
  } catch {
    return null
  }
}

export function setOAuthStateCookie(res, value) {
  appendCookie(res, `${GTM_STATE_COOKIE}=${encodeURIComponent(value)}${cookieSuffix(10 * 60)}`)
}

export function clearOAuthStateCookie(res) {
  appendCookie(res, `${GTM_STATE_COOKIE}=${cookieSuffix(0)}`)
}

export function setGtmAccessCookie(res, value, maxAge = GTM_API_SESSION_SECONDS) {
  appendCookie(res, `${GTM_ACCESS_COOKIE}=${encodeURIComponent(value)}${cookieSuffix(maxAge, 'Strict')}`)
}

export function clearGtmAccessCookie(res) {
  appendCookie(res, `${GTM_ACCESS_COOKIE}=${cookieSuffix(0, 'Strict')}`)
}

export function getOAuthStateFromRequest(req) {
  return getCookie(req, GTM_STATE_COOKIE)
}

export function getGtmAccessFromRequest(req, userId) {
  if (!isGtmApiConfigured()) return null
  const value = getCookie(req, GTM_ACCESS_COOKIE)
  const session = value ? openAccessSession(value) : null
  if (!session) return null
  return safeEqual(session.userId, String(userId || '')) ? session : null
}

export function buildGoogleAuthorizationUrl(state, config = getGtmOAuthConfig()) {
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GTM_READONLY_SCOPE,
    access_type: 'online',
    include_granted_scopes: 'false',
    prompt: 'select_account',
    state,
  }).toString()
  return url.toString()
}

export async function exchangeAuthorizationCode(code, config = getGtmOAuthConfig()) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const data = await response.json()
  if (!response.ok || !data.access_token) throw new Error('Google did not issue an access token')
  const scopes = String(data.scope || GTM_READONLY_SCOPE).split(/\s+/)
  if (!scopes.includes(GTM_READONLY_SCOPE)) throw new Error('The read-only GTM scope was not granted')
  return {
    accessToken: data.access_token,
    expiresIn: Math.max(1, Math.min(Number(data.expires_in) || GTM_API_SESSION_SECONDS, GTM_API_SESSION_SECONDS)),
  }
}

export async function requestGtmApi(path, accessToken) {
  const response = await fetch(`${GTM_API_ROOT}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  const data = await response.json()
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'GTM authorization expired' : response.status === 403 ? 'This Google account cannot read the container' : 'GTM API request failed')
    error.statusCode = response.status
    throw error
  }
  return data
}

export async function readContainerSnapshot(publicId, accessToken) {
  const normalized = String(publicId || '').trim().toUpperCase()
  if (!isValidGtmApiContainerId(normalized)) throw new Error('A valid GTM container ID is required')
  const container = await requestGtmApi(`/accounts/containers:lookup?tagId=${encodeURIComponent(normalized)}`, accessToken)
  if (container.publicId !== normalized || !/^accounts\/\d+\/containers\/\d+$/.test(container.path || '')) throw new Error('Google returned an unexpected container')
  const [account, workspaceResponse] = await Promise.all([
    requestGtmApi(`/accounts/${encodeURIComponent(container.accountId)}`, accessToken),
    requestGtmApi(`/${container.path}/workspaces`, accessToken),
  ])
  return {
    account: { name: String(account.name || ''), accountId: String(container.accountId || '') },
    container: {
      name: String(container.name || ''),
      publicId: normalized,
      accountId: String(container.accountId || ''),
      containerId: String(container.containerId || ''),
      path: container.path,
      domainName: Array.isArray(container.domainName) ? container.domainName.slice(0, 20).map(String) : [],
      usageContext: Array.isArray(container.usageContext) ? container.usageContext.slice(0, 10).map(String) : [],
      tagManagerUrl: String(container.tagManagerUrl || ''),
    },
    workspaces: (Array.isArray(workspaceResponse.workspace) ? workspaceResponse.workspace : []).slice(0, 30).map((workspace) => ({
      name: String(workspace.name || ''),
      workspaceId: String(workspace.workspaceId || ''),
      path: String(workspace.path || ''),
    })),
  }
}
