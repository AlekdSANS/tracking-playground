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
const GTM_WORKSPACE_PATH = /^accounts\/\d+\/containers\/\d+\/workspaces\/\d+$/
const GA4_MEASUREMENT_ID = /\bG-[A-Z0-9]{5,20}\b/g
const GA4_EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const TEMPLATE_REFERENCE = /^\{\{[^{}\r\n]{1,80}\}\}$/
const MAX_AUDIT_ITEMS = 100
const MAX_AUDIT_PAGES = 3

const EVENT_PARAMETER_KEYS = new Set(['eventname', 'event_name'])
const MEASUREMENT_PARAMETER_KEYS = new Set([
  'measurementid',
  'measurement_id',
  'trackingid',
  'tracking_id',
  'tagid',
  'tag_id',
  'destinationid',
  'destination_id',
])

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

function sanitizeLabel(value, maxLength = 120) {
  return Array.from(String(value || ''), (character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127 ? ' ' : character
  }).join('')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sanitizeIdentifier(value, maxLength = 80) {
  return String(value || '').replace(/[^A-Za-z0-9_.:/-]/g, '').slice(0, maxLength)
}

function uniqueSorted(values, limit = MAX_AUDIT_ITEMS) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)).slice(0, limit)
}

function walkStrings(value, visitor, depth = 0, budget = { remaining: 2000 }) {
  if (budget.remaining <= 0 || depth > 10 || value == null) return
  budget.remaining -= 1
  if (typeof value === 'string') {
    visitor(value)
    return
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => walkStrings(entry, visitor, depth + 1, budget))
    return
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => walkStrings(entry, visitor, depth + 1, budget))
  }
}

function collectParameterStrings(parameter, output, depth = 0) {
  if (!parameter || depth > 8) return
  if (typeof parameter === 'string') {
    output.push(parameter)
    return
  }
  if (Array.isArray(parameter)) {
    parameter.forEach((entry) => collectParameterStrings(entry, output, depth + 1))
    return
  }
  if (typeof parameter !== 'object') return
  if (typeof parameter.value === 'string') output.push(parameter.value)
  collectParameterStrings(parameter.list, output, depth + 1)
  collectParameterStrings(parameter.map, output, depth + 1)
}

function extractKeyedParameterStrings(value, allowedKeys, output = [], depth = 0) {
  if (!value || depth > 10) return output
  if (Array.isArray(value)) {
    value.forEach((entry) => extractKeyedParameterStrings(entry, allowedKeys, output, depth + 1))
    return output
  }
  if (typeof value !== 'object') return output
  const key = String(value.key || '').toLowerCase()
  if (allowedKeys.has(key)) collectParameterStrings(value, output)
  Object.values(value).forEach((entry) => extractKeyedParameterStrings(entry, allowedKeys, output, depth + 1))
  return output
}

function extractMeasurementIds(value) {
  const identifiers = []
  walkStrings(value, (candidate) => {
    identifiers.push(...Array.from(String(candidate).toUpperCase().matchAll(GA4_MEASUREMENT_ID), (match) => match[0]))
  })
  return uniqueSorted(identifiers)
}

function extractEventNames(parameters) {
  return uniqueSorted(
    extractKeyedParameterStrings(parameters, EVENT_PARAMETER_KEYS)
      .map((value) => sanitizeLabel(value, 40))
      .filter((value) => GA4_EVENT_NAME.test(value)),
  )
}

function extractMeasurementReferences(parameters) {
  return uniqueSorted(
    extractKeyedParameterStrings(parameters, MEASUREMENT_PARAMETER_KEYS)
      .map((value) => sanitizeLabel(value, 84))
      .filter((value) => TEMPLATE_REFERENCE.test(value)),
  )
}

function extractDataLayerNames(variable) {
  if (String(variable?.type || '').toLowerCase() !== 'v') return []
  return uniqueSorted(
    extractKeyedParameterStrings(variable.parameter, new Set(['name']))
      .map((value) => sanitizeLabel(value, 40))
      .filter((value) => GA4_EVENT_NAME.test(value)),
  )
}

function extractConsentTypes(consentSettings) {
  const values = []
  collectParameterStrings(consentSettings?.consentType, values)
  return uniqueSorted(values.map((value) => sanitizeIdentifier(value, 64)).filter((value) => /^[a-z][a-z0-9_]{0,63}$/.test(value)))
}

function sanitizeTag(tag) {
  const consentTypes = extractConsentTypes(tag.consentSettings)
  return {
    tagId: sanitizeIdentifier(tag.tagId),
    name: sanitizeLabel(tag.name),
    type: sanitizeIdentifier(tag.type),
    paused: tag.paused === true,
    firingTriggerIds: uniqueSorted((Array.isArray(tag.firingTriggerId) ? tag.firingTriggerId : []).map((value) => sanitizeIdentifier(value))),
    blockingTriggerIds: uniqueSorted((Array.isArray(tag.blockingTriggerId) ? tag.blockingTriggerId : []).map((value) => sanitizeIdentifier(value))),
    consent: {
      status: sanitizeIdentifier(tag.consentSettings?.consentStatus, 40),
      types: consentTypes,
    },
    ga4: {
      measurementIds: extractMeasurementIds(tag.parameter),
      eventNames: extractEventNames(tag.parameter),
      measurementReferences: extractMeasurementReferences(tag.parameter),
    },
  }
}

function sanitizeTrigger(trigger) {
  const customEventKeys = new Set(['arg2', ...EVENT_PARAMETER_KEYS])
  const eventNames = uniqueSorted(
    extractKeyedParameterStrings(trigger.customEventFilter, customEventKeys)
      .map((value) => sanitizeLabel(value, 40))
      .filter((value) => GA4_EVENT_NAME.test(value)),
  )
  return {
    triggerId: sanitizeIdentifier(trigger.triggerId),
    name: sanitizeLabel(trigger.name),
    type: sanitizeIdentifier(trigger.type),
    eventNames,
  }
}

function sanitizeVariable(variable) {
  return {
    variableId: sanitizeIdentifier(variable.variableId),
    name: sanitizeLabel(variable.name),
    type: sanitizeIdentifier(variable.type),
    measurementIds: extractMeasurementIds(variable.parameter),
    dataLayerNames: extractDataLayerNames(variable),
  }
}

function sanitizeBuiltInVariable(variable) {
  return {
    name: sanitizeLabel(variable.name),
    type: sanitizeIdentifier(variable.type),
  }
}

function sanitizeGtagConfig(config) {
  return {
    gtagConfigId: sanitizeIdentifier(config.gtagConfigId),
    type: sanitizeIdentifier(config.type),
    measurementIds: extractMeasurementIds({ id: config.gtagConfigId, parameter: config.parameter }),
  }
}

async function requestGtmApiCollection(path, key, accessToken) {
  const items = []
  let nextPageToken = ''
  let pageCount = 0
  do {
    const separator = path.includes('?') ? '&' : '?'
    const pagePath = nextPageToken ? `${path}${separator}pageToken=${encodeURIComponent(nextPageToken)}` : path
    const response = await requestGtmApi(pagePath, accessToken)
    const pageItems = Array.isArray(response[key]) ? response[key] : []
    items.push(...pageItems.slice(0, Math.max(0, MAX_AUDIT_ITEMS - items.length)))
    nextPageToken = sanitizeLabel(response.nextPageToken, 500)
    pageCount += 1
  } while (nextPageToken && items.length < MAX_AUDIT_ITEMS && pageCount < MAX_AUDIT_PAGES)
  return {
    items,
    truncated: Boolean(nextPageToken) || items.length >= MAX_AUDIT_ITEMS,
  }
}

async function requestOptionalGtmApiCollection(path, key, accessToken) {
  try {
    return await requestGtmApiCollection(path, key, accessToken)
  } catch (error) {
    if (error.statusCode === 404) return { items: [], truncated: false, unavailable: true }
    throw error
  }
}

function emptyAudit() {
  return {
    workspace: null,
    counts: { tags: 0, triggers: 0, variables: 0, builtInVariables: 0, googleTagConfigs: 0 },
    tags: [],
    triggers: [],
    variables: [],
    builtInVariables: [],
    googleTagConfigs: [],
    ga4: { measurementIds: [], eventNames: [], measurementReferences: [] },
    consent: { types: [], tagsRequiringConsent: [] },
    truncatedSections: [],
    unavailableSections: [],
  }
}

async function readWorkspaceAudit(workspace, accessToken) {
  const path = workspace.path
  const [tagResult, triggerResult, variableResult, builtInResult, gtagConfigResult] = await Promise.all([
    requestGtmApiCollection(`/${path}/tags`, 'tag', accessToken),
    requestGtmApiCollection(`/${path}/triggers`, 'trigger', accessToken),
    requestGtmApiCollection(`/${path}/variables`, 'variable', accessToken),
    requestOptionalGtmApiCollection(`/${path}/built_in_variables`, 'builtInVariable', accessToken),
    requestOptionalGtmApiCollection(`/${path}/gtag_config`, 'gtagConfig', accessToken),
  ])
  const tags = tagResult.items.map(sanitizeTag)
  const triggers = triggerResult.items.map(sanitizeTrigger)
  const variables = variableResult.items.map(sanitizeVariable)
  const builtInVariables = builtInResult.items.map(sanitizeBuiltInVariable)
  const googleTagConfigs = gtagConfigResult.items.map(sanitizeGtagConfig)
  const measurementIds = uniqueSorted([
    ...tags.flatMap((tag) => tag.ga4.measurementIds),
    ...variables.flatMap((variable) => variable.measurementIds),
    ...googleTagConfigs.flatMap((config) => config.measurementIds),
  ])
  const eventNames = uniqueSorted([
    ...tags.flatMap((tag) => tag.ga4.eventNames),
    ...triggers.flatMap((trigger) => trigger.eventNames),
  ])
  const measurementReferences = uniqueSorted(tags.flatMap((tag) => tag.ga4.measurementReferences))
  const consentTypes = uniqueSorted(tags.flatMap((tag) => tag.consent.types))
  return {
    workspace: {
      name: workspace.name,
      workspaceId: workspace.workspaceId,
      path: workspace.path,
    },
    counts: {
      tags: tags.length,
      triggers: triggers.length,
      variables: variables.length,
      builtInVariables: builtInVariables.length,
      googleTagConfigs: googleTagConfigs.length,
    },
    tags,
    triggers,
    variables,
    builtInVariables,
    googleTagConfigs,
    ga4: { measurementIds, eventNames, measurementReferences },
    consent: {
      types: consentTypes,
      tagsRequiringConsent: tags
        .filter((tag) => tag.consent.status || tag.consent.types.length > 0)
        .map((tag) => tag.name)
        .slice(0, MAX_AUDIT_ITEMS),
    },
    truncatedSections: [
      tagResult.truncated && 'tags',
      triggerResult.truncated && 'triggers',
      variableResult.truncated && 'variables',
      builtInResult.truncated && 'builtInVariables',
      gtagConfigResult.truncated && 'googleTagConfigs',
    ].filter(Boolean),
    unavailableSections: [
      builtInResult.unavailable && 'builtInVariables',
      gtagConfigResult.unavailable && 'googleTagConfigs',
    ].filter(Boolean),
  }
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
  const workspaces = (Array.isArray(workspaceResponse.workspace) ? workspaceResponse.workspace : [])
    .slice(0, 30)
    .map((workspace) => ({
      name: sanitizeLabel(workspace.name),
      workspaceId: sanitizeIdentifier(workspace.workspaceId),
      path: String(workspace.path || ''),
    }))
    .filter((workspace) => GTM_WORKSPACE_PATH.test(workspace.path) && workspace.path.startsWith(`${container.path}/workspaces/`))
  const auditedWorkspace = workspaces.find((workspace) => /default workspace/i.test(workspace.name)) || workspaces[0]
  const audit = auditedWorkspace ? await readWorkspaceAudit(auditedWorkspace, accessToken) : emptyAudit()
  return {
    account: { name: sanitizeLabel(account.name), accountId: sanitizeIdentifier(container.accountId) },
    container: {
      name: sanitizeLabel(container.name),
      publicId: normalized,
      accountId: sanitizeIdentifier(container.accountId),
      containerId: sanitizeIdentifier(container.containerId),
      path: container.path,
      domainName: Array.isArray(container.domainName) ? container.domainName.slice(0, 20).map((value) => sanitizeLabel(value, 253)) : [],
      usageContext: Array.isArray(container.usageContext) ? container.usageContext.slice(0, 10).map((value) => sanitizeIdentifier(value, 40)) : [],
      tagManagerUrl: String(container.tagManagerUrl || ''),
    },
    workspaces,
    audit,
  }
}
