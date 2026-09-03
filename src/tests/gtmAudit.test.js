import { describe, expect, test } from 'vitest'
import { compareWorkspaceToGtm, readLocalEventNames } from '../utils/gtmAudit'

describe('GTM audit comparison', () => {
  const files = {
    'events/page_view.json': '{"event":"page_view"}',
    'events/generate_lead.json': '{"event":"generate_lead"}',
    'events/invalid.json': '{bad json',
    'README.md': '# Ignore me',
  }

  test('reads valid local GA4 event names without trusting unrelated files', () => {
    expect(readLocalEventNames(files)).toEqual(['generate_lead', 'page_view'])
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
})
