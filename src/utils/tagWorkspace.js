import { isValidGtmContainerId } from './tagLab'

export const WORKSPACE_MAX_FILE_SIZE = 100_000
export const WORKSPACE_MAX_FILES = 40

const SAFE_FILE_NAME = /^(?![./])(?!.*(?:\\|\.\.|\/\/))[A-Za-z0-9][A-Za-z0-9._/-]{0,79}\.(?:json|md)$/
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const PARAMETER_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const CREDENTIAL_KEY = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i
const PII_KEY = /(^|_)(email|phone|mobile|first[_-]?name|last[_-]?name|full[_-]?name|address|postal|postcode|ssn|national[_-]?id|ip)(_|$)/i
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE = /(?:^|\s)\+?\d[\d .()-]{7,}\d(?:\s|$)/
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/
const GOOGLE_API_KEY = /\bAIza[A-Za-z0-9_-]{20,}\b/
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}\b/i
const SCRIPT_CONTENT = /<script\b|javascript\s*:|\bon(?:error|load|click)\s*=|\beval\s*\(|\bnew\s+Function\s*\(/i

export function readWorkspaceContainerId(hash = '') {
  const params = new URLSearchParams(String(hash).replace(/^#/, ''))
  const value = (params.get('container') || '').trim().toUpperCase()
  return isValidGtmContainerId(value) ? value : ''
}

export function isValidWorkspaceFileName(fileName) {
  return SAFE_FILE_NAME.test(fileName)
}

export function createStarterWorkspace(containerId) {
  return {
    'README.md': `# Offline-first GTM practice\n\nContainer: ${containerId}\n\nEdit an event JSON file, validate it, then run it in the network-disabled simulator. Live GTM remains off until a separate, temporary opt-in review is completed.`,
    'container.json': JSON.stringify({ containerVersion: { container: { publicId: containerId, name: 'Practice container' } } }, null, 2),
    'events/page_view.json': JSON.stringify({ event: 'page_view', page_title: 'Practice page', page_location: 'https://sandbox.invalid/tag-lab', debug_mode: true }, null, 2),
    'events/generate_lead.json': JSON.stringify({ event: 'generate_lead', currency: 'USD', value: 25, lead_source: 'practice_form', debug_mode: true }, null, 2),
    'tests/expected-events.json': JSON.stringify({ expected: ['page_view', 'generate_lead'] }, null, 2),
  }
}

export function createWorkspaceFileContent(fileName) {
  if (fileName.endsWith('.md')) return '# Practice notes\n\n'
  if (fileName.startsWith('events/')) {
    return JSON.stringify({ event: 'custom_event', debug_mode: true }, null, 2)
  }
  return '{}\n'
}

export function formatWorkspaceJson(content) {
  try {
    return { content: `${JSON.stringify(JSON.parse(content), null, 2)}\n`, error: '' }
  } catch (error) {
    return { content, error: describeJsonError(error, content) }
  }
}

export function groupWorkspaceFiles(fileNames) {
  return [...fileNames].sort().reduce((groups, fileName) => {
    const separator = fileName.indexOf('/')
    const folder = separator === -1 ? 'Project' : fileName.slice(0, separator)
    const label = separator === -1 ? fileName : fileName.slice(separator + 1)
    const current = groups.find((group) => group.folder === folder)
    if (current) current.files.push({ name: fileName, label })
    else groups.push({ folder, files: [{ name: fileName, label }] })
    return groups
  }, [])
}

function describeJsonError(error, content) {
  const position = Number(error?.message?.match(/position (\d+)/i)?.[1])
  if (!Number.isFinite(position)) return 'File must contain valid JSON.'
  const beforeError = content.slice(0, position)
  const line = beforeError.split('\n').length
  const column = position - beforeError.lastIndexOf('\n')
  return `Invalid JSON near line ${line}, column ${column}.`
}

function addIssue(state, severity, category, path, message, code) {
  const key = `${severity}:${category}:${path}:${code}`
  if (state.issueKeys.has(key) || state.issues.length >= 50) return
  state.issueKeys.add(key)
  state.issues.push({ severity, category, path, message, code })
}

function pathFor(parent, key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
}

function looksLikePaymentCard(value) {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  let doubleDigit = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (doubleDigit) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    doubleDigit = !doubleDigit
  }
  return sum % 10 === 0
}

function inspectString(value, path, state) {
  if (SCRIPT_CONTENT.test(value)) addIssue(state, 'error', 'security', path, 'Script-like content is blocked. Event values must be inert data only.', 'script-content')
  if (EMAIL.test(value)) addIssue(state, 'warning', 'privacy', path, 'Possible email address detected. Replace it with a synthetic value.', 'pii-email')
  if (PHONE.test(value)) addIssue(state, 'warning', 'privacy', path, 'Possible phone number detected. Replace it with a synthetic value.', 'pii-phone')
  if (IPV4.test(value)) addIssue(state, 'warning', 'privacy', path, 'Possible IP address detected. Do not send identifiers in analytics events.', 'pii-ip')
  if (looksLikePaymentCard(value)) addIssue(state, 'warning', 'privacy', path, 'Possible payment-card number detected. Remove it before testing.', 'pii-card')
  if (JWT.test(value)) addIssue(state, 'warning', 'credential', path, 'Possible authentication token detected. Remove all credentials.', 'secret-jwt')
  if (GOOGLE_API_KEY.test(value)) addIssue(state, 'warning', 'credential', path, 'Possible API key detected. Remove all credentials.', 'secret-api-key')
  if (PRIVATE_KEY.test(value)) addIssue(state, 'warning', 'credential', path, 'Possible private key detected. Remove all credentials.', 'secret-private-key')
  if (BEARER_TOKEN.test(value)) addIssue(state, 'warning', 'credential', path, 'Possible bearer token detected. Remove all credentials.', 'secret-bearer')
}

function inspectValue(value, path, state, depth = 0) {
  if (state.stopped) return
  state.nodes += 1
  if (state.nodes > 2000) {
    addIssue(state, 'error', 'limits', '$', 'JSON contains too many values (maximum 2,000).', 'node-limit')
    state.stopped = true
    return
  }
  if (depth > 12) {
    addIssue(state, 'error', 'limits', path, 'JSON is nested too deeply (maximum 12 levels).', 'depth-limit')
    return
  }
  if (typeof value === 'string') {
    inspectString(value, path, state)
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value)) {
    const childPath = pathFor(path, key)
    if (BLOCKED_KEYS.has(key)) addIssue(state, 'error', 'security', childPath, `Blocked key “${key}” is dangerous and not allowed.`, 'dangerous-key')
    if (CREDENTIAL_KEY.test(key)) addIssue(state, 'warning', 'credential', childPath, `“${key}” may contain a credential or secret.`, 'sensitive-key')
    if (PII_KEY.test(key)) addIssue(state, 'warning', 'privacy', childPath, `“${key}” looks like a personal-data field.`, 'pii-key')
    inspectValue(child, childPath, state, depth + 1)
    if (state.stopped) break
  }
}

function validateEventSchema(value, state) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    addIssue(state, 'error', 'schema', '$', 'Event files must contain one JSON object.', 'event-object')
    return
  }
  if (!EVENT_NAME.test(value.event || '')) addIssue(state, 'error', 'schema', '$.event', 'Use a GA4-style event name: 1–40 letters, numbers, or underscores, starting with a letter.', 'event-name')
  const parameterNames = Object.keys(value).filter((key) => key !== 'event' && !BLOCKED_KEYS.has(key))
  if (parameterNames.length > 25) addIssue(state, 'error', 'schema', '$', 'GA4 event files can define at most 25 event parameters.', 'parameter-count')
  parameterNames.forEach((key) => {
    if (!PARAMETER_NAME.test(key)) addIssue(state, 'error', 'schema', pathFor('$', key), 'Parameter names must use 1–40 letters, numbers, or underscores and start with a letter.', 'parameter-name')
    if (value[key] === null) addIssue(state, 'warning', 'schema', pathFor('$', key), 'GA4 may discard null parameter values.', 'null-parameter')
  })
}

function validateContainerSchema(value, state) {
  const container = value?.containerVersion?.container
  if (!container || typeof container !== 'object' || Array.isArray(container)) {
    addIssue(state, 'error', 'schema', '$.containerVersion.container', 'container.json needs a containerVersion.container object.', 'container-object')
    return
  }
  if (!isValidGtmContainerId(container.publicId || '')) addIssue(state, 'error', 'schema', '$.containerVersion.container.publicId', 'The container publicId must be a valid GTM- container ID.', 'container-id')
  if (typeof container.name !== 'string' || !container.name.trim()) addIssue(state, 'error', 'schema', '$.containerVersion.container.name', 'The practice container needs a name.', 'container-name')
}

function validateTestSchema(value, state) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.expected)) {
    addIssue(state, 'error', 'schema', '$.expected', 'Test files need an expected array of event names.', 'test-expected')
    return
  }
  if (!value.expected.length || value.expected.length > 50) addIssue(state, 'error', 'schema', '$.expected', 'List between 1 and 50 expected events.', 'test-count')
  value.expected.forEach((eventName, index) => {
    if (!EVENT_NAME.test(eventName || '')) addIssue(state, 'error', 'schema', `$.expected[${index}]`, 'Expected events must use valid GA4-style names.', 'test-event-name')
  })
  if (new Set(value.expected).size !== value.expected.length) addIssue(state, 'warning', 'schema', '$.expected', 'Duplicate expected events may make the test ambiguous.', 'test-duplicate')
}

function finishValidation(result, state, value) {
  result.value = value
  result.issues = state.issues
  result.errors = state.issues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.path}: ${issue.message}`)
  result.warnings = state.issues.filter((issue) => issue.severity === 'warning').map((issue) => `${issue.path}: ${issue.message}`)
  result.valid = result.errors.length === 0
  result.safeToRun = result.valid && result.warnings.length === 0
  return result
}

export function validateWorkspaceFile(fileName, content) {
  const result = { valid: false, safeToRun: false, errors: [], warnings: [], issues: [], value: null, schemaName: 'Unknown file' }
  if (!isValidWorkspaceFileName(fileName)) {
    result.errors.push('Use a safe .json or .md file name without traversal characters.')
    return result
  }
  if (new Blob([content]).size > WORKSPACE_MAX_FILE_SIZE) {
    result.errors.push('File is larger than 100 KB.')
    return result
  }
  const state = { nodes: 0, stopped: false, issues: [], issueKeys: new Set() }
  if (fileName.endsWith('.md')) {
    result.schemaName = 'Markdown document'
    inspectString(content, '$', state)
    return finishValidation(result, state, content)
  }

  try {
    const value = JSON.parse(content)
    inspectValue(value, '$', state)
    if (fileName.startsWith('events/')) {
      result.schemaName = 'GA4 event'
      validateEventSchema(value, state)
    } else if (fileName === 'container.json') {
      result.schemaName = 'Practice container'
      validateContainerSchema(value, state)
    } else if (fileName.startsWith('tests/')) {
      result.schemaName = 'Event expectation test'
      validateTestSchema(value, state)
    } else {
      result.schemaName = 'Generic JSON'
      if (!value || typeof value !== 'object') addIssue(state, 'error', 'schema', '$', 'Workspace JSON must contain an object or array.', 'json-root')
    }
    return finishValidation(result, state, value)
  } catch (error) {
    result.errors.push(describeJsonError(error, content))
    result.issues.push({ severity: 'error', category: 'syntax', path: '$', message: result.errors[0], code: 'json-syntax' })
    return result
  }
}
