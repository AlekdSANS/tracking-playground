import { buildEventPayload } from './eventBuilder'

const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{5,20}$/

const BASE_SCENARIOS = [
  {
    id: 'button',
    label: 'Button click',
    description: 'A visitor selects the main demo call to action.',
    event: 'button_click',
    payload: { event: 'button_click', button_name: 'get_demo', placement: 'practice_card' },
  },
  {
    id: 'form',
    label: 'Form success',
    description: 'A fake contact form finishes successfully.',
    event: 'generate_lead',
    payload: { event: 'generate_lead', form_name: 'contact', lead_type: 'demo' },
  },
  {
    id: 'purchase',
    label: 'Purchase complete',
    description: 'A test checkout reaches its confirmation state.',
    event: 'purchase',
    payload: { event: 'purchase', transaction_id: 'TEST-1001', value: 50, currency: 'PLN' },
  },
]

function chooseDraftScenario(draft) {
  const eventName = String(draft?.eventName || '').toLowerCase()
  const action = String(draft?.action || '').toLowerCase()
  if (/purchase|payment|order|checkout/.test(`${eventName} ${action}`)) return 'purchase'
  if (/form|lead|submit|registration|sign_up/.test(`${eventName} ${action}`)) return 'form'
  return 'button'
}

export function createInteractiveScenarios(draft) {
  const generatedPayload = buildEventPayload(draft)
  const generatedScenarioId = chooseDraftScenario(draft)
  return BASE_SCENARIOS.map((scenario) => {
    const isGeneratedEvent = scenario.id === generatedScenarioId
    const payload = isGeneratedEvent ? generatedPayload : scenario.payload
    return { ...scenario, event: payload.event, isGeneratedEvent, payload }
  })
}

export function simulateGtmPipeline(payload, measurementId = '') {
  const eventName = String(payload?.event || 'custom_event')
  const eventParameters = Object.fromEntries(Object.entries(payload || {}).filter(([name]) => name !== 'event'))
  const destination = GA4_MEASUREMENT_ID.test(String(measurementId).trim().toUpperCase())
    ? String(measurementId).trim().toUpperCase()
    : 'G-XXXXXXXXXX'

  return {
    dataLayerPush: `window.dataLayer = window.dataLayer || []\n\nwindow.dataLayer.push(${JSON.stringify(payload, null, 2)})`,
    eventName,
    trigger: {
      name: `CE - ${eventName}`,
      condition: `event equals ${eventName}`,
      matched: true,
    },
    tag: `GA4 Event - ${eventName}`,
    ga4Payload: {
      measurement_id: destination,
      event_name: eventName,
      event_parameters: eventParameters,
    },
  }
}

export function isValidDeployedUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)
  } catch {
    return false
  }
}
