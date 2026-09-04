import { describe, expect, test } from 'vitest'
import { compareWorkspaceToGtm, createGtmSetupAudit, readLocalEventNames, readLocalEvents } from '../utils/gtmAudit'

describe('GTM audit comparison', () => {
  const files = {
    'events/page_view.json': '{"event":"page_view"}',
    'events/generate_lead.json': '{"event":"generate_lead","form_name":"contact","lead_type":"demo"}',
    'events/invalid.json': '{bad json',
    'README.md': '# Ignore me',
  }

  test('reads valid local GA4 event names without trusting unrelated files', () => {
    expect(readLocalEventNames(files)).toEqual(['generate_lead', 'page_view'])
    expect(readLocalEvents(files)).toEqual([
      { eventName: 'generate_lead', parameterNames: ['form_name', 'lead_type'], files: ['events/generate_lead.json'] },
      { eventName: 'page_view', parameterNames: [], files: ['events/page_view.json'] },
    ])
  })

  test('compares local events with the sanitized GTM audit', () => {
    const comparison = compareWorkspaceToGtm(files, {
      audit: { ga4: { eventNames: ['page_view', 'purchase', '<script>'], measurementIds: ['G-SAFE12345', 'UA-OLD'] } },
    })
    expect(comparison).toEqual({
      localEventNames: ['generate_lead', 'page_view'],
      gtmEventNames: ['page_view', 'purchase'],
      matchedEventNames: ['page_view'],
      onlyInWorkspace: ['generate_lead'],
      onlyInGtm: ['purchase'],
      measurementIds: ['G-SAFE12345'],
      summary: { localEvents: 2, gtmEvents: 2, matchedEvents: 1, missingFromGtm: 1, missingFromWorkspace: 1 },
    })
  })

  test('separates API configuration evidence from manual browser and delivery checks', () => {
    const report = createGtmSetupAudit(files, {
      container: { publicId: 'GTM-SAFE123' },
      audit: {
        googleTagConfigs: [{ measurementIds: ['G-SAFE12345'] }],
        triggers: [{ triggerId: '3', name: 'CE - generate_lead', eventNames: ['generate_lead'] }],
        tags: [{ tagId: '7', name: 'GA4 Event - generate_lead', firingTriggerIds: ['3'], ga4: { eventNames: ['generate_lead'] } }],
        variables: [{ name: 'DLV - lead_type', type: 'v', dataLayerNames: ['lead_type'] }],
        ga4: { eventNames: ['generate_lead', 'purchase'], measurementIds: ['G-SAFE12345'] },
        consent: { types: [], tagsRequiringConsent: [] },
      },
    }, { containerId: 'GTM-SAFE123', measurementId: 'G-SAFE12345' })

    expect(report.configuration).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'verified', title: 'GTM container GTM-SAFE123 exists.' }),
      expect.objectContaining({ status: 'verified', title: 'Google tag uses G-SAFE12345.' }),
      expect.objectContaining({ status: 'verified', title: 'generate_lead trigger exists.' }),
      expect.objectContaining({ status: 'verified', title: 'generate_lead GA4 event tag exists.' }),
      expect.objectContaining({ status: 'verified', title: 'Trigger is connected to the generate_lead tag.' }),
      expect.objectContaining({ status: 'warning', title: 'form_name exists locally but no GTM Data Layer Variable was detected.' }),
      expect.objectContaining({ status: 'warning', title: 'purchase exists in GTM but not in the local workspace.' }),
      expect.objectContaining({ status: 'warning', title: 'No consent configuration was detected.' }),
    ]))
    expect(report.manual.map((finding) => finding.title)).toEqual([
      'Manual check required: Tag Assistant firing.',
      'Manual check required: GA4 DebugView reception.',
    ])
  })
})
