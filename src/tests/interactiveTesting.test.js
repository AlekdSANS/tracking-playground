import { describe, expect, test } from 'vitest'
import { createEventDraft } from '../utils/eventBuilder'
import { createInteractiveScenarios, isValidDeployedUrl, simulateGtmPipeline } from '../utils/interactiveTesting'

describe('interactive GTM testing simulator', () => {
  test('assigns the generated lead event to the fake form', () => {
    const scenarios = createInteractiveScenarios(createEventDraft('generate_lead'))
    const form = scenarios.find((scenario) => scenario.id === 'form')

    expect(form.isGeneratedEvent).toBe(true)
    expect(form.payload).toMatchObject({ event: 'generate_lead', form_name: 'contact', lead_type: 'demo' })
  })

  test('shows the data layer, exact-match trigger, tag, and GA4 payload', () => {
    const result = simulateGtmPipeline({ event: 'generate_lead', form_name: 'contact' }, 'g-abc1234567')

    expect(result.dataLayerPush).toMatch(/window\.dataLayer\.push[\s\S]*generate_lead/)
    expect(result.trigger).toEqual({ name: 'CE - generate_lead', condition: 'event equals generate_lead', matched: true })
    expect(result.tag).toBe('GA4 Event - generate_lead')
    expect(result.ga4Payload).toEqual({ measurement_id: 'G-ABC1234567', event_name: 'generate_lead', event_parameters: { form_name: 'contact' } })
  })

  test('accepts only public HTTPS URLs for real Tag Assistant testing', () => {
    expect(isValidDeployedUrl('https://tracking-playground-nu.vercel.app/')).toBe(true)
    expect(isValidDeployedUrl('http://localhost:5173')).toBe(false)
    expect(isValidDeployedUrl('https://127.0.0.1:5173')).toBe(false)
    expect(isValidDeployedUrl('not a url')).toBe(false)
  })
})
