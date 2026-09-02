import { isValidGtmContainerId } from './tagLab'

export const WORKSPACE_MAX_FILE_SIZE = 100_000
export const WORKSPACE_MAX_FILES = 40

const SAFE_FILE_NAME = /^(?![./])(?!.*(?:\\|\.\.|\/\/))[A-Za-z0-9][A-Za-z0-9._/-]{0,79}\.(?:json|md)$/
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const SENSITIVE_KEY = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|email|phone)/i
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE = /(?:\+?\d[\d .()-]{7,}\d)/

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
    'README.md': `# Offline GTM practice\n\nContainer: ${containerId}\n\nEdit an event JSON file, validate it, then run it in the network-disabled simulator. Live GTM is intentionally locked.`,
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

function inspectValue(value, path, state, depth = 0) {
  state.nodes += 1
  if (state.nodes > 2000) state.errors.add('JSON contains too many values (maximum 2,000).')
  if (depth > 12) {
    state.errors.add('JSON is nested too deeply (maximum 12 levels).')
    return
  }
  if (!value || typeof value !== 'object') return

  Object.entries(value).forEach(([key, child]) => {
    if (BLOCKED_KEYS.has(key)) state.errors.add(`Blocked key at ${path}.${key}.`)
    if (SENSITIVE_KEY.test(key)) state.warnings.add(`“${key}” may contain personal or secret data.`)
    inspectValue(child, `${path}.${key}`, state, depth + 1)
  })
}

export function validateWorkspaceFile(fileName, content) {
  const result = { valid: false, errors: [], warnings: [], value: null }
  if (!isValidWorkspaceFileName(fileName)) {
    result.errors.push('Use a safe .json or .md file name without traversal characters.')
    return result
  }
  if (new Blob([content]).size > WORKSPACE_MAX_FILE_SIZE) {
    result.errors.push('File is larger than 100 KB.')
    return result
  }
  if (fileName.endsWith('.md')) return { ...result, valid: true, value: content }

  try {
    const value = JSON.parse(content)
    const state = { nodes: 0, errors: new Set(), warnings: new Set() }
    inspectValue(value, '$', state)
    if (EMAIL.test(content) || PHONE.test(content)) {
      state.warnings.add('Possible personal data detected. Use synthetic values only.')
    }
    if (fileName.startsWith('events/') && (!value || typeof value !== 'object' || Array.isArray(value) || !EVENT_NAME.test(value.event || ''))) {
      state.errors.add('Event files need a GA4-style event name (1–40 letters, numbers, or underscores).')
    }
    if (fileName === 'container.json' && !value?.containerVersion?.container) {
      state.errors.add('container.json needs containerVersion.container.')
    }
    result.value = value
    result.errors = [...state.errors]
    result.warnings = [...state.warnings]
    result.valid = result.errors.length === 0
    return result
  } catch (error) {
    result.errors.push(describeJsonError(error, content))
    return result
  }
}
