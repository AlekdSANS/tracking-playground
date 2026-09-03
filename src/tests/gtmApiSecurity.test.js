import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  GTM_API_SESSION_SECONDS,
  GTM_READONLY_SCOPE,
  buildGoogleAuthorizationUrl,
  createOAuthState,
  openAccessSession,
  readContainerSnapshot,
  readOAuthState,
  sealAccessSession,
} from '../../api/_lib/gtmOAuth.js'

const SECRET = 'a-test-secret-that-is-more-than-thirty-two-characters-long'

afterEach(() => vi.unstubAllGlobals())

describe('GTM OAuth boundary', () => {
  test('signs short-lived state and rejects tampering or expiry', () => {
    const now = Date.parse('2026-09-02T12:00:00Z')
    const state = createOAuthState('gtm-safe123', 'admin-1', SECRET, now)
    expect(readOAuthState(state, 'admin-1', SECRET, now)).toEqual(expect.objectContaining({ containerId: 'GTM-SAFE123' }))
    expect(readOAuthState(state, 'admin-2', SECRET, now)).toBeNull()
    expect(readOAuthState(`${state}x`, 'admin-1', SECRET, now)).toBeNull()
    expect(readOAuthState(state, 'admin-1', `${SECRET}-wrong`, now)).toBeNull()
    expect(readOAuthState(state, 'admin-1', SECRET, now + (11 * 60 * 1000))).toBeNull()
  })

  test('encrypts access tokens and enforces their expiry', () => {
    const now = Date.parse('2026-09-02T12:00:00Z')
    const accessToken = 'ya29.private-practice-token'
    const sealed = sealAccessSession({ accessToken, userId: 'admin-1', scope: 'readonly', exp: Math.floor(now / 1000) + GTM_API_SESSION_SECONDS }, SECRET)
    const [iv, encrypted, tag] = sealed.split('.')
    const tamperedTag = `${tag.startsWith('A') ? 'B' : 'A'}${tag.slice(1)}`
    expect(sealed).not.toContain(accessToken)
    expect(openAccessSession(sealed, SECRET, now)).toEqual(expect.objectContaining({ accessToken, userId: 'admin-1', scope: 'readonly' }))
    expect(openAccessSession(`${iv}.${encrypted}.${tamperedTag}`, SECRET, now)).toBeNull()
    expect(openAccessSession(sealed, SECRET, now + ((GTM_API_SESSION_SECONDS + 1) * 1000))).toBeNull()
  })

  test('requests only the read-only GTM scope with an exact redirect URI', () => {
    const url = new URL(buildGoogleAuthorizationUrl('signed-state', {
      clientId: 'client-id',
      clientSecret: 'server-only',
      redirectUri: 'https://practice.example/api/gtm-oauth-callback',
    }))
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('scope')).toBe(GTM_READONLY_SCOPE)
    expect(url.searchParams.get('redirect_uri')).toBe('https://practice.example/api/gtm-oauth-callback')
    expect(url.searchParams.get('access_type')).toBe('online')
    expect(url.searchParams.get('scope')).not.toMatch(/edit\.containers|publish|delete\.containers|manage\.users|manage\.accounts/i)
  })

  test('returns a bounded, sanitized container snapshot', async () => {
    const responses = {
      lookup: { publicId: 'GTM-SAFE123', name: 'Practice', accountId: '10', containerId: '20', path: 'accounts/10/containers/20', domainName: ['practice.invalid'], usageContext: ['web'], tagManagerUrl: 'https://tagmanager.google.com/example', notes: 'not returned' },
      account: { name: 'Learning account', fingerprint: 'not returned' },
      workspaces: { workspace: [{ name: 'Default Workspace', workspaceId: '1', path: 'accounts/10/containers/20/workspaces/1', description: 'not returned' }] },
      tags: { tag: [{
        tagId: '7',
        name: 'GA4 purchase',
        type: 'gaawe',
        firingTriggerId: ['3'],
        parameter: [
          { type: 'template', key: 'measurementId', value: 'G-SAFE12345' },
          { type: 'template', key: 'eventName', value: 'purchase' },
          { type: 'template', key: 'html', value: '<script>private-tag-code</script>' },
        ],
        notes: 'private notes are not returned',
        consentSettings: { consentStatus: 'needed', consentType: { type: 'list', list: [{ type: 'template', value: 'analytics_storage' }] } },
      }] },
      triggers: { trigger: [{ triggerId: '3', name: 'Purchase event', type: 'customEvent', customEventFilter: [{ parameter: [{ key: 'arg2', value: 'purchase' }] }] }] },
      variables: { variable: [{ variableId: '5', name: 'GA4 ID', type: 'c', parameter: [{ key: 'value', value: 'G-SAFE12345' }], notes: 'another private value' }] },
      builtInVariables: { builtInVariable: [{ name: 'Event', type: 'event' }] },
      gtagConfigs: { gtagConfig: [{ gtagConfigId: 'G-OTHER1234', type: 'googleTag', parameter: [{ key: 'secret', value: 'must-not-leak' }] }] },
    }
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      expect(options.headers.Authorization).toBe('Bearer server-token')
      const payload = url.includes('containers:lookup') ? responses.lookup
        : url.endsWith('/accounts/10') ? responses.account
          : url.endsWith('/workspaces') ? responses.workspaces
            : url.endsWith('/tags') ? responses.tags
              : url.endsWith('/triggers') ? responses.triggers
                : url.endsWith('/variables') ? responses.variables
                  : url.endsWith('/built_in_variables') ? responses.builtInVariables
                    : responses.gtagConfigs
      return { ok: true, status: 200, json: async () => payload }
    }))
    const snapshot = await readContainerSnapshot('GTM-SAFE123', 'server-token')
    expect(snapshot.container).toEqual(expect.objectContaining({ publicId: 'GTM-SAFE123', path: 'accounts/10/containers/20' }))
    expect(snapshot.account).toEqual({ name: 'Learning account', accountId: '10' })
    expect(snapshot.workspaces).toEqual([{ name: 'Default Workspace', workspaceId: '1', path: 'accounts/10/containers/20/workspaces/1' }])
    expect(snapshot.audit).toEqual(expect.objectContaining({
      workspace: expect.objectContaining({ workspaceId: '1' }),
      counts: { tags: 1, triggers: 1, variables: 1, builtInVariables: 1, googleTagConfigs: 1 },
      ga4: {
        measurementIds: ['G-OTHER1234', 'G-SAFE12345'],
        eventNames: ['purchase'],
        measurementReferences: [],
      },
      consent: { types: ['analytics_storage'], tagsRequiringConsent: ['GA4 purchase'] },
    }))
    expect(snapshot.audit.tags[0]).toEqual(expect.objectContaining({ tagId: '7', firingTriggerIds: ['3'] }))
    expect(snapshot.audit.triggers[0].eventNames).toEqual(['purchase'])
    expect(JSON.stringify(snapshot)).not.toMatch(/not returned|server-token|private-tag-code|private notes|must-not-leak|fingerprint/)
  })
})
