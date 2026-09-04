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
  const gtmConfiguration = createGtmConfiguration(draft)
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
      ...gtmConfiguration.steps.map((step) => `${step.title}: ${step.instruction}`),
    ],
  }
}

export function createGtmConfiguration(draft) {
  const payload = buildEventPayload(draft)
  const eventName = payload.event
  const parameters = Object.keys(payload).filter((name) => name !== 'event').map((name) => ({
    source: name,
    gtmVariable: `DLV - ${name}`,
    variableReference: `{{DLV - ${name}}}`,
    ga4Parameter: name,
  }))
  const parameterNames = parameters.map((parameter) => parameter.source)
  const parameterSummary = parameterNames.length ? parameterNames.join(', ') : 'No event parameters'

  return {
    eventName,
    triggerName: `CE - ${eventName}`,
    tagName: `GA4 Event - ${eventName}`,
    parameters,
    mapping: [
      { source: 'event', gtmVariable: 'Custom Event trigger', ga4Parameter: 'Event name' },
      ...parameters,
    ],
    steps: [
      {
        id: 'open-variables',
        area: 'Variables',
        title: 'Open Variables',
        path: 'Workspace → Variables',
        instruction: 'In the left GTM menu, select Variables. User-Defined Variables is where GTM will learn the extra values pushed by the website.',
        valueLabel: 'Menu',
        value: 'Variables',
      },
      {
        id: 'create-data-layer-variables',
        area: 'Variables',
        title: 'Create Data Layer Variables',
        path: 'User-Defined Variables → New → Variable Configuration → Data Layer Variable',
        instruction: parameterNames.length
          ? `Create one variable for each website parameter: ${parameterSummary}. Enter the parameter name exactly in Data Layer Variable Name and name the GTM variable “DLV - parameter_name”.`
          : 'This event has no extra parameters, so no Data Layer Variable is required. Mark this step complete and continue.',
        valueLabel: 'Variables to create',
        value: parameters.map((parameter) => `${parameter.gtmVariable} = ${parameter.source}`).join('\n') || 'None for this event',
      },
      {
        id: 'open-triggers',
        area: 'Triggers',
        title: 'Open Triggers',
        path: 'Workspace → Triggers',
        instruction: 'Select Triggers in the left GTM menu. A trigger listens for the event value pushed into the data layer.',
        valueLabel: 'Menu',
        value: 'Triggers',
      },
      {
        id: 'create-custom-event-trigger',
        area: 'Triggers',
        title: 'Create the Custom Event trigger',
        path: 'New → Trigger Configuration → Custom Event',
        instruction: `Enter “${eventName}” in Custom event name, choose All Custom Events, and name the trigger “CE - ${eventName}”.`,
        valueLabel: 'Custom event name',
        value: eventName,
      },
      {
        id: 'open-tags',
        area: 'Tags',
        title: 'Open Tags',
        path: 'Workspace → Tags',
        instruction: 'Select Tags in the left GTM menu. The tag turns the website event into an event sent to Google Analytics.',
        valueLabel: 'Menu',
        value: 'Tags',
      },
      {
        id: 'create-ga4-event-tag',
        area: 'Tags',
        title: 'Create a GA4 Event tag',
        path: 'New → Tag Configuration → Google Analytics → Google Analytics: GA4 Event',
        instruction: `Choose Google Analytics: GA4 Event and name the tag “GA4 Event - ${eventName}”. Select the Google tag you created during setup when GTM asks for a Measurement ID or Google tag.`,
        valueLabel: 'Tag name',
        value: `GA4 Event - ${eventName}`,
      },
      {
        id: 'enter-event-name',
        area: 'Tags',
        title: 'Enter the event name',
        path: 'Tag Configuration → Event Name',
        instruction: `Enter “${eventName}” exactly. This must match the event value in the website dataLayer push and the Custom Event trigger.`,
        valueLabel: 'Event Name',
        value: eventName,
      },
      {
        id: 'add-event-parameters',
        area: 'Tags',
        title: 'Add event parameters',
        path: 'Event Parameters → Add parameter',
        instruction: parameterNames.length
          ? 'For each row, use the website parameter name as Parameter Name and its matching Data Layer Variable as Value.'
          : 'This event has no extra parameters, so leave Event Parameters empty.',
        valueLabel: 'Parameter Name → Value',
        value: parameters.map((parameter) => `${parameter.ga4Parameter} → ${parameter.variableReference}`).join('\n') || 'No parameters to add',
      },
      {
        id: 'attach-trigger',
        area: 'Tags',
        title: 'Attach the trigger',
        path: 'Triggering → Choose a trigger',
        instruction: `Select “CE - ${eventName}”. The tag will now fire only when GTM receives the ${eventName} event.`,
        valueLabel: 'Trigger',
        value: `CE - ${eventName}`,
      },
      {
        id: 'save-tag',
        area: 'Tags',
        title: 'Save the tag',
        path: 'Save',
        instruction: 'Select Save. Then use Preview to test the website action in Tag Assistant before you publish the container.',
        valueLabel: 'Final check',
        value: 'Save → Preview → test the successful action',
      },
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
