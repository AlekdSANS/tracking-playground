import { describe, expect, test } from 'vitest'
import {
  RECOMMENDED_EVENT_PRESETS,
  buildEventPayload,
  createEventDraft,
  createEventOutputs,
  getPlacementGuidance,
  validateEventDraft,
} from '../utils/eventBuilder'

describe('no-code GA4 event builder', () => {
  test('offers the four requested recommended GA4 events before custom events', () => {
    expect(RECOMMENDED_EVENT_PRESETS.map((preset) => preset.id)).toEqual(['generate_lead', 'login', 'sign_up', 'purchase'])
  })

  test('generates synchronized dataLayer, JavaScript, React, HTML, and GTM outputs', () => {
    const draft = createEventDraft('generate_lead')
    const outputs = createEventOutputs(draft)

    expect(validateEventDraft(draft).safe).toBe(true)
    expect(outputs.payload).toEqual({ event: 'generate_lead', form_name: 'contact', lead_type: 'demo', value: 50, currency: 'PLN' })
    expect(outputs.dataLayer).toContain('"event": "generate_lead"')
    expect(outputs.javascript).toMatch(/window\.dataLayer\.push/)
    expect(outputs.react).toMatch(/function trackGenerateLead\(\)/)
    expect(outputs.html).toMatch(/addEventListener\('click'/)
    expect(outputs.gtm.join(' ')).toMatch(/Custom Event.*Data Layer Variable.*GA4 Event.*Preview/i)
  })

  test('blocks and excludes possible personal information from generated code', () => {
    const draft = createEventDraft('generate_lead')
    draft.parameters.push({ id: 'parameter-99', name: 'customer_email', type: 'string', value: 'person@example.com', personal: true })
    const validation = validateEventDraft(draft)
    const payload = buildEventPayload(draft)

    expect(validation.safe).toBe(false)
    expect(validation.privacy.map((issue) => issue.message).join(' ')).toMatch(/personal information/i)
    expect(payload).not.toHaveProperty('customer_email')
    expect(JSON.stringify(createEventOutputs(draft))).not.toContain('person@example.com')
  })

  test('validates duplicate names and typed example values', () => {
    const draft = createEventDraft('custom')
    draft.eventName = 'demo_event'
    draft.action = 'Demo completes'
    draft.parameters = [
      { id: 'parameter-1', name: 'value', type: 'number', value: 'not-a-number', personal: false },
      { id: 'parameter-2', name: 'value', type: 'boolean', value: 'maybe', personal: false },
    ]
    expect(validateEventDraft(draft).errors.map((issue) => issue.message).join(' ')).toMatch(/must be a number.*duplicated.*true or false/i)
  })

  test('blocks code-like parameter values before they can be copied', () => {
    const draft = createEventDraft('login')
    draft.parameters[0].value = '<script>alert(1)</script>'
    expect(validateEventDraft(draft).safe).toBe(false)
    expect(validateEventDraft(draft).errors[0].message).toMatch(/code-like content.*blocked/i)
  })

  test('explains placement at the successful outcome rather than the first click', () => {
    expect(getPlacementGuidance('Contact form succeeds')).toMatch(/successfully submitted.*not.*clicks Submit/i)
    expect(getPlacementGuidance('Payment confirmation succeeds')).toMatch(/server confirms.*not.*clicks Pay/i)
  })
})
