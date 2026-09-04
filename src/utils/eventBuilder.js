export const EVENT_PARAMETER_TYPES = ['string', 'number', 'boolean']

export const RECOMMENDED_EVENT_PRESETS = [
  {
    id: 'generate_lead',
    label: 'Generate lead',
    description: 'A visitor successfully sends a lead form.',
    action: 'Contact form succeeds',
    parameters: [
      { name: 'form_name', type: 'string', value: 'contact' },
      { name: 'lead_type', type: 'string', value: 'demo' },
      { name: 'value', type: 'number', value: '50' },
      { name: 'currency', type: 'string', value: 'PLN' },
    ],
  },
  {
    id: 'login',
    label: 'Login',
    description: 'A user successfully signs in.',
    action: 'User login succeeds',
    parameters: [{ name: 'method', type: 'string', value: 'email' }],
  },
  {
    id: 'sign_up',
    label: 'Sign up',
    description: 'A new account is successfully created.',
    action: 'Registration succeeds',
    parameters: [{ name: 'method', type: 'string', value: 'email' }],
  },
  {
    id: 'purchase',
    label: 'Purchase',
    description: 'A payment is confirmed and an order is complete.',
    action: 'Payment confirmation succeeds',
    parameters: [
      { name: 'transaction_id', type: 'string', value: 'DEMO-1001' },
      { name: 'value', type: 'number', value: '50' },
      { name: 'currency', type: 'string', value: 'PLN' },
    ],
  },
]

const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const PARAMETER_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const EMAIL_VALUE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_VALUE = /(?:\+?\d[\s().-]*){8,}/
const PERSONAL_KEY = /(?:^|_)(?:email|phone|first_name|last_name|full_name|address|ip_address)(?:$|_)/i
const SCRIPT_LIKE_VALUE = /<\s*\/?\s*script|javascript:|onerror\s*=|eval\s*\(|new\s+Function/i

function makeParameter(parameter, index) {
  return {
    id: `parameter-${index + 1}`,
    name: parameter.name || '',
    type: EVENT_PARAMETER_TYPES.includes(parameter.type) ? parameter.type : 'string',
    value: String(parameter.value ?? ''),
    personal: Boolean(parameter.personal),
  }
}

export function createEventDraft(presetId = 'generate_lead') {
  const preset = RECOMMENDED_EVENT_PRESETS.find((item) => item.id === presetId) || {
    id: 'custom_event',
    action: '',
    parameters: [{ name: '', type: 'string', value: '' }],
  }
  return {
    presetId: RECOMMENDED_EVENT_PRESETS.some((item) => item.id === preset.id) ? preset.id : 'custom',
    eventName: preset.id,
    action: preset.action,
    parameters: preset.parameters.map(makeParameter),
  }
}

export function createEmptyParameter(existingParameters = []) {
  const nextNumber = existingParameters.reduce((highest, parameter) => {
    const number = Number(String(parameter.id || '').match(/\d+$/)?.[0]) || 0
    return Math.max(highest, number)
  }, 0) + 1
  return makeParameter({}, nextNumber - 1)
}

export function isRecommendedEvent(eventName) {
  return RECOMMENDED_EVENT_PRESETS.some((preset) => preset.id === eventName)
}

function looksPersonal(parameter) {
  return parameter.personal || PERSONAL_KEY.test(parameter.name) || EMAIL_VALUE.test(parameter.value) || PHONE_VALUE.test(parameter.value)
}

export function validateEventDraft(draft) {
  const issues = []
  const eventName = String(draft?.eventName || '').trim()
  const action = String(draft?.action || '').trim()
  const parameters = Array.isArray(draft?.parameters) ? draft.parameters : []
  if (!eventName) issues.push({ type: 'error', field: 'eventName', message: 'Enter an event name.' })
  else if (!EVENT_NAME.test(eventName)) issues.push({ type: 'error', field: 'eventName', message: 'Use letters, numbers, and underscores; start with a letter and keep it under 40 characters.' })
  if (!action) issues.push({ type: 'error', field: 'action', message: 'Describe the successful user action that should create this event.' })
  if (parameters.length > 12) issues.push({ type: 'error', field: 'parameters', message: 'Keep this beginner event to 12 parameters or fewer.' })

  const usedNames = new Set()
  parameters.forEach((parameter) => {
    const name = String(parameter.name || '').trim()
    const value = String(parameter.value ?? '').trim()
    if (!name) issues.push({ type: 'error', rowId: parameter.id, message: 'Each parameter needs a name.' })
    else if (!PARAMETER_NAME.test(name)) issues.push({ type: 'error', rowId: parameter.id, message: `${name} is not a valid GA4-style parameter name.` })
    else if (name === 'event') issues.push({ type: 'error', rowId: parameter.id, message: 'event is reserved; choose another parameter name.' })
    else if (usedNames.has(name)) issues.push({ type: 'error', rowId: parameter.id, message: `${name} is duplicated.` })
    usedNames.add(name)
    if (!EVENT_PARAMETER_TYPES.includes(parameter.type)) issues.push({ type: 'error', rowId: parameter.id, message: 'Choose string, number, or boolean.' })
    if (!value) issues.push({ type: 'error', rowId: parameter.id, message: `${name || 'This parameter'} needs an example value.` })
    if (parameter.type === 'number' && value && !Number.isFinite(Number(value))) issues.push({ type: 'error', rowId: parameter.id, message: `${name || 'This value'} must be a number.` })
    if (parameter.type === 'boolean' && value && !/^(true|false)$/i.test(value)) issues.push({ type: 'error', rowId: parameter.id, message: `${name || 'This value'} must be true or false.` })
    if (value.length > 100) issues.push({ type: 'error', rowId: parameter.id, message: `${name || 'This value'} is longer than 100 characters.` })
    if (SCRIPT_LIKE_VALUE.test(value)) issues.push({ type: 'error', rowId: parameter.id, message: `${name || 'This value'} contains code-like content and is blocked.` })
    if (looksPersonal(parameter)) issues.push({ type: 'privacy', rowId: parameter.id, message: `${name || 'This parameter'} may contain personal information and is excluded from generated code.` })
  })

  return {
    issues,
    errors: issues.filter((issue) => issue.type === 'error'),
    privacy: issues.filter((issue) => issue.type === 'privacy'),
    safe: issues.length === 0,
  }
}

function parameterValue(parameter) {
  const rawValue = String(parameter.value ?? '').trim()
  if (parameter.type === 'number') return Number(rawValue)
  if (parameter.type === 'boolean') return rawValue.toLowerCase() === 'true'
  return rawValue
}

export function buildEventPayload(draft) {
  const eventName = EVENT_NAME.test(String(draft?.eventName || '').trim()) ? String(draft.eventName).trim() : 'custom_event'
  return (Array.isArray(draft?.parameters) ? draft.parameters : []).reduce((payload, parameter) => {
    const name = String(parameter.name || '').trim()
    if (!PARAMETER_NAME.test(name) || name === 'event' || looksPersonal(parameter)) return payload
    if (Object.hasOwn(payload, name)) return payload
    payload[name] = parameterValue(parameter)
    return payload
  }, { event: eventName })
}

function toFunctionName(eventName) {
  const words = String(eventName || 'custom_event').split(/[^A-Za-z0-9]+/).filter(Boolean)
  return `track${words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('') || 'CustomEvent'}`
}

function toElementId(eventName) {
  return `track-${String(eventName || 'custom-event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom-event'}`
}

export function createEventOutputs(draft) {
  const payload = buildEventPayload(draft)
  const payloadJson = JSON.stringify(payload, null, 2)
  const indentedPayload = payloadJson.split('\n').map((line, index) => index === 0 ? line : `  ${line}`).join('\n')
  const functionName = toFunctionName(payload.event)
  const elementId = toElementId(payload.event)
  const safeHtmlPayload = payloadJson.replace(/</g, '\\u003c')
  return {
    payload,
    dataLayer: payloadJson,
    javascript: `window.dataLayer = window.dataLayer || []\n\nwindow.dataLayer.push(${payloadJson})`,
    react: `function ${functionName}() {\n  window.dataLayer = window.dataLayer || []\n\n  window.dataLayer.push(${indentedPayload})\n}`,
    html: `<button type="button" id="${elementId}">Complete action</button>\n\n<script>\n  document.querySelector('#${elementId}').addEventListener('click', function () {\n    window.dataLayer = window.dataLayer || [];\n    window.dataLayer.push(${safeHtmlPayload.split('\n').map((line, index) => index === 0 ? line : `    ${line}`).join('\n')});\n  });\n</script>`,
    gtm: [
      `In GTM, open Triggers → New → Trigger Configuration → Custom Event.`,
      `Enter ${payload.event} as the Custom event name and save the trigger.`,
      ...Object.keys(payload).filter((name) => name !== 'event').map((name) => `Create Variables → New → Data Layer Variable with Data Layer Variable Name: ${name}.`),
      `Open Tags → New → Tag Configuration → Google Analytics: GA4 Event.`,
      `Set Event Name to ${payload.event}, add the generated variables as Event Parameters, attach the ${payload.event} trigger, and save.`,
      'Use Preview and Tag Assistant before publishing.',
    ],
  }
}

export function getPlacementGuidance(action) {
  const normalized = String(action || '').toLowerCase()
  if (/form|lead/.test(normalized)) return 'Place this after the form has successfully submitted—not when the user merely clicks Submit.'
  if (/payment|purchase|order/.test(normalized)) return 'Place this after the server confirms the payment or order—not when the user first clicks Pay.'
  if (/login|sign[ -]?in/.test(normalized)) return 'Place this after authentication succeeds—not when the user first clicks Log in.'
  if (/registration|sign[ -]?up|account/.test(normalized)) return 'Place this after account creation succeeds—not when the user first clicks Register.'
  return 'Place this where the action is confirmed as successful, not on an earlier click that might fail.'
}
