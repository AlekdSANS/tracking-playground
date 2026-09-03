import { createHash } from 'node:crypto'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import {
  WORKSPACE_MAX_FILE_SIZE,
  isValidWorkspaceFileName,
  readWorkspaceContainerId,
  validateWorkspaceFile,
} from '../utils/tagWorkspace'
import { DISPOSABLE_RUNNER_DOCUMENT, RUNNER_TIMEOUT_MS } from '../utils/tagRunner'
import {
  buildLiveGtmDocument,
  LIVE_GTM_BRIDGE_HASH,
  LIVE_GTM_BRIDGE_SCRIPT,
  LIVE_GTM_SESSION_MS,
} from '../utils/liveGtm'

async function renderApp(path) {
  const existingFetch = globalThis.fetch
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (url === '/api/me') {
      return {
        ok: true,
        json: async () => ({
          user: {
            user_id: 'admin-1',
            login: 'admin',
            email: 'admin@example.com',
            email_verified: true,
            admin_status: 1,
          },
        }),
      }
    }

    return existingFetch(url, options)
  }))

  let result
  await act(async () => {
    result = render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  })
  return result
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('workspace entry isolation', () => {
  test('accepts only a single valid public GTM ID from the URL fragment', () => {
    expect(readWorkspaceContainerId('#container=GTM-SAFE123')).toBe('GTM-SAFE123')
    expect(readWorkspaceContainerId('#container=G-AAAA&container=GTM-SAFE123')).toBe('')
    expect(readWorkspaceContainerId('#container=%3Cscript%3Ealert(1)%3C/script%3E')).toBe('')
    expect(readWorkspaceContainerId('#container=GTM-ABC123%26next%3Dhttps%3A%2F%2Fevil.invalid')).toBe('')
  })

  test('keeps the workspace locked when the fragment is missing or hostile', async () => {
    await renderApp('/tag-workspace#container=javascript%3Aalert(1)')
    expect(screen.getByRole('heading', { name: /valid gtm container id is required/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  })

  test('does not mount the main site shell or tracking console in a valid workspace', async () => {
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    expect(screen.getByRole('heading', { name: /datalayer workspace/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /analytics debug console/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/consent settings/i)).not.toBeInTheDocument()
    expect(window.dataLayer).toEqual([])
  })

  test('does not persist virtual-file edits to browser storage', async () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    fireEvent.change(screen.getByRole('textbox', { name: /edit events\/page_view.json/i }), {
      target: { value: '{"event":"edited_event"}' },
    })
    expect(storageSpy).not.toHaveBeenCalled()
  })
})

describe('virtual file and parser limits', () => {
  test.each([
    '../event.json',
    'events/../../secret.json',
    '/absolute.json',
    '.hidden.json',
    'events\\windows.json',
    'events//double.json',
    'payload.js',
    'payload.html',
  ])('rejects unsafe file path %s', (fileName) => {
    expect(isValidWorkspaceFileName(fileName)).toBe(false)
  })

  test('rejects oversized content before parsing', () => {
    const content = `{"event":"safe","padding":"${'x'.repeat(WORKSPACE_MAX_FILE_SIZE)}"}`
    const result = validateWorkspaceFile('events/large.json', content)
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/larger than 100 KB/i)
  })

  test('stops deeply nested and excessively large object graphs', () => {
    let deep = { value: true }
    for (let index = 0; index < 14; index += 1) deep = { child: deep }
    const deepResult = validateWorkspaceFile('data/deep.json', JSON.stringify(deep))
    expect(deepResult.errors.join(' ')).toMatch(/nested too deeply/i)

    const wideResult = validateWorkspaceFile('data/wide.json', JSON.stringify({ values: Array.from({ length: 2100 }, (_, index) => index) }))
    expect(wideResult.errors.join(' ')).toMatch(/too many values/i)
  })
})

describe('hostile JSON and sensitive-data detection', () => {
  test.each(['__proto__', 'prototype', 'constructor'])('blocks dangerous key %s at any depth', (key) => {
    const result = validateWorkspaceFile('events/attack.json', `{"event":"safe_event","nested":{"${key}":{"polluted":true}}}`)
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ severity: 'error', category: 'security', code: 'dangerous-key' }),
    ]))
  })

  test.each([
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    '<img src=x onerror=alert(1)>',
    'eval("2+2")',
    'new Function("return 1")',
  ])('blocks script-like event value %s', (value) => {
    const result = validateWorkspaceFile('events/attack.json', JSON.stringify({ event: 'safe_event', label: value }))
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'script-content', category: 'security' }),
    ]))
  })

  test('flags common personal identifiers without echoing their values', () => {
    const result = validateWorkspaceFile('events/private.json', JSON.stringify({
      event: 'generate_lead',
      contact_email: 'person@example.com',
      phone: '+48 123 456 789',
      client_ip: '192.168.10.20',
      card_hint: '4111 1111 1111 1111',
    }))
    expect(result.valid).toBe(true)
    expect(result.safeToRun).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['pii-email', 'pii-phone', 'pii-ip', 'pii-card']))
    expect(result.warnings.join(' ')).not.toContain('person@example.com')
    expect(result.warnings.join(' ')).not.toContain('4111 1111 1111 1111')
  })

  test('flags tokens, API keys, bearer credentials, and private keys', () => {
    const result = validateWorkspaceFile('data/secrets.json', JSON.stringify({
      jwt: 'eyJabcdefghijk.abcdefghijklmnop.abcdefghijklmnop',
      api_value: 'AIza1234567890abcdefghijklmnop',
      header: 'Bearer abcdefghijklmnopqrstuvwxyz',
      key: '-----BEGIN PRIVATE KEY-----',
    }))
    expect(result.safeToRun).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['secret-jwt', 'secret-api-key', 'secret-bearer', 'secret-private-key']))
  })

  test('cannot bypass the event schema with a valid but unrelated JSON value', () => {
    for (const value of ['null', '[]', '"page_view"', '{"event":"9-invalid"}']) {
      expect(validateWorkspaceFile('events/bypass.json', value).valid).toBe(false)
    }
  })
})

describe('disposable runner isolation', () => {
  test('declares a deny-by-default CSP with no external endpoints or dynamic execution', () => {
    expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/default-src 'none'/)
    expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/connect-src 'none'/)
    expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/worker-src 'none'/)
    expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/form-action 'none'/)
    expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/base-uri 'none'/)
    expect(DISPOSABLE_RUNNER_DOCUMENT).not.toMatch(/https?:\/\//i)
    expect(DISPOSABLE_RUNNER_DOCUMENT).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|eval\s*\(|new\s+Function/i)
    expect(DISPOSABLE_RUNNER_DOCUMENT).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie|caches\./i)
  })

  test('mounts an opaque script-only iframe and destroys it on cancellation', async () => {
    const user = userEvent.setup()
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))
    const iframe = screen.getByTitle(/disposable datalayer runtime/i)
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/)

    await user.click(screen.getByRole('button', { name: /cancel and dispose/i }))
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  })

  test('destroys an unresponsive iframe at the hard timeout', async () => {
    vi.useFakeTimers()
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    fireEvent.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))
    expect(screen.getByTitle(/disposable datalayer runtime/i)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(RUNNER_TIMEOUT_MS))
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/^timeout$/i)).toHaveLength(2)
    expect(screen.getByText(/timed out and was destroyed/i)).toBeInTheDocument()
  })

  test('accepts one result over the private channel and then disposes the iframe', async () => {
    class FakeMessageChannel {
      constructor() {
        const port = {
          onmessage: null,
          close: vi.fn(),
          start() {
            queueMicrotask(() => port.onmessage?.({ data: { type: 'runner:ready', runId: 'run-1' } }))
          },
          postMessage(message) {
            if (message.type !== 'runner:execute') return
            queueMicrotask(() => port.onmessage?.({
              data: {
                type: 'runner:result',
                runId: message.runId,
                payload: message.payload,
                summary: { triggerName: message.payload.event, parameterNames: ['debug_mode'], parameterCount: 1, dataLayerLength: 1, networkRequests: 0 },
              },
            }))
          },
        }
        this.port1 = port
        this.port2 = { close: vi.fn() }
      }
    }
    vi.stubGlobal('MessageChannel', FakeMessageChannel)
    const user = userEvent.setup()
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    await user.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))
    const iframe = screen.queryByTitle(/disposable datalayer runtime/i)
    if (iframe) fireEvent.load(iframe)

    await waitFor(() => expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument())
    expect(screen.getAllByText(/^complete$/i)).toHaveLength(2)
    expect(screen.getByText('0 requests')).toBeInTheDocument()
    expect(screen.getByText(/completed.*sandbox was destroyed/i)).toBeInTheDocument()
  })
})

describe('opt-in Live GTM boundary', () => {
  class InertMessageChannel {
    constructor() {
      this.port1 = { onmessage: null, close: vi.fn(), postMessage: vi.fn(), start: vi.fn() }
      this.port2 = { close: vi.fn() }
    }
  }

  test('rejects hostile container IDs and session tokens before building HTML', () => {
    expect(() => buildLiveGtmDocument('<script>alert(1)</script>', 'live-1')).toThrow(/valid GTM/i)
    expect(() => buildLiveGtmDocument('GTM-SAFE123', '../../escape')).toThrow(/session token/i)
  })

  test('pins the static bridge hash and limits the live frame to GTM and GA endpoints', () => {
    const expectedHash = `sha256-${createHash('sha256').update(LIVE_GTM_BRIDGE_SCRIPT).digest('base64')}`
    const documentSource = buildLiveGtmDocument('GTM-SAFE123', 'live-1')
    const csp = documentSource.match(/Content-Security-Policy" content="([^"]+)"/)?.[1] || ''
    const scriptPolicy = csp.split(';').find((directive) => directive.trim().startsWith('script-src '))

    expect(LIVE_GTM_BRIDGE_HASH).toBe(expectedHash)
    expect(scriptPolicy).toContain(LIVE_GTM_BRIDGE_HASH)
    expect(scriptPolicy).toContain('https://www.googletagmanager.com')
    expect(scriptPolicy).not.toMatch(/unsafe-inline|unsafe-eval/)
    expect(csp).toMatch(/connect-src https:\/\/www\.googletagmanager\.com https:\/\/\*\.google-analytics\.com https:\/\/\*\.analytics\.google\.com/)
    expect(csp).toMatch(/frame-src 'none'/)
    expect(csp).toMatch(/worker-src 'none'/)
    expect(csp).toMatch(/form-action 'none'/)
    expect(csp).toMatch(/base-uri 'none'/)
    expect(documentSource).not.toMatch(/doubleclick|googleadservices|facebook|segment\.com/i)
    expect(LIVE_GTM_BRIDGE_SCRIPT).toMatch(/gtm\.blocklist/)
    expect(LIVE_GTM_BRIDGE_SCRIPT).toMatch(/customScripts/)
    expect(LIVE_GTM_BRIDGE_SCRIPT).toMatch(/nonGoogleScripts/)
    expect(LIVE_GTM_BRIDGE_SCRIPT).toMatch(/sandboxedScripts/)
  })

  test('does not create a live frame until every disclosure and exact ID are confirmed', async () => {
    vi.stubGlobal('MessageChannel', InertMessageChannel)
    const user = userEvent.setup()
    await renderApp('/tag-workspace#container=GTM-SAFE123')

    expect(screen.queryByTitle(/restricted live gtm/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /review and opt in/i }))
    const connectButton = screen.getByRole('button', { name: /connect for 10 minutes/i })
    expect(connectButton).toBeDisabled()

    await user.click(screen.getByLabelText(/i own or may test this container/i))
    await user.click(screen.getByLabelText(/i will use synthetic data only/i))
    await user.click(screen.getByLabelText(/i understand events can leave this browser/i))
    await user.type(screen.getByLabelText(/type GTM-SAFE123 to confirm/i), 'GTM-SAFE123')
    expect(connectButton).toBeEnabled()
    await user.click(connectButton)

    const iframe = screen.getByTitle(/restricted live gtm GTM-SAFE123/i)
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/)
    expect(iframe.getAttribute('srcdoc')).toContain(LIVE_GTM_BRIDGE_HASH)

    await user.click(screen.getByRole('button', { name: /disconnect and destroy/i }))
    expect(screen.queryByTitle(/restricted live gtm/i)).not.toBeInTheDocument()
  })

  test('destroys the live frame when its ten-minute lease expires', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('MessageChannel', InertMessageChannel)
    await renderApp('/tag-workspace#container=GTM-SAFE123')

    fireEvent.click(screen.getByRole('button', { name: /review and opt in/i }))
    fireEvent.click(screen.getByLabelText(/i own or may test this container/i))
    fireEvent.click(screen.getByLabelText(/i will use synthetic data only/i))
    fireEvent.click(screen.getByLabelText(/i understand events can leave this browser/i))
    fireEvent.change(screen.getByLabelText(/type GTM-SAFE123 to confirm/i), { target: { value: 'GTM-SAFE123' } })
    fireEvent.click(screen.getByRole('button', { name: /connect for 10 minutes/i }))
    expect(screen.getByTitle(/restricted live gtm/i)).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(LIVE_GTM_SESSION_MS))
    expect(screen.queryByTitle(/restricted live gtm/i)).not.toBeInTheDocument()
    expect(screen.getByText(/session expired and was destroyed/i)).toBeInTheDocument()
  })
})

describe('read-only GTM API surface', () => {
  test('keeps OAuth on the server and imports a sanitized audit with local comparison', async () => {
    const snapshot = {
      account: { name: 'Learning account', accountId: '10' },
      container: { name: 'Practice container', publicId: 'GTM-SAFE123', accountId: '10', containerId: '20', path: 'accounts/10/containers/20', domainName: ['practice.invalid'], usageContext: ['web'], tagManagerUrl: 'https://tagmanager.google.com/' },
      workspaces: [{ name: 'Default Workspace', workspaceId: '1', path: 'accounts/10/containers/20/workspaces/1' }],
      audit: {
        workspace: { name: 'Default Workspace', workspaceId: '1', path: 'accounts/10/containers/20/workspaces/1' },
        counts: { tags: 2, triggers: 1, variables: 1, builtInVariables: 1, googleTagConfigs: 1 },
        tags: [{ tagId: '7', name: 'GA4 page view', type: 'gaawe', paused: false, firingTriggerIds: ['3'], blockingTriggerIds: [], consent: { status: 'needed', types: ['analytics_storage'] }, ga4: { measurementIds: ['G-SAFE12345'], eventNames: ['page_view'], measurementReferences: [] } }],
        triggers: [{ triggerId: '3', name: 'Page view', type: 'pageview', eventNames: [] }],
        variables: [],
        builtInVariables: [{ name: 'Event', type: 'event' }],
        googleTagConfigs: [{ gtagConfigId: 'G-SAFE12345', type: 'googleTag', measurementIds: ['G-SAFE12345'] }],
        ga4: { measurementIds: ['G-SAFE12345'], eventNames: ['page_view', 'purchase'], measurementReferences: [] },
        consent: { types: ['analytics_storage'], tagsRequiringConsent: ['GA4 page view'] },
        truncatedSections: [],
        unavailableSections: [],
      },
    }
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url === '/api/gtm-status') return { ok: true, json: async () => ({ configured: true, connected: true, scope: 'readonly', expiresAt: Date.now() + 600000 }) }
      if (String(url).startsWith('/api/gtm-container')) return { ok: true, json: async () => snapshot }
      return { ok: true, json: async () => ({ disconnected: true }) }
    }))
    const user = userEvent.setup()
    await renderApp('/tag-workspace#container=GTM-SAFE123')

    expect(await screen.findByText(/GTM-SAFE123 was audited/i)).toBeInTheDocument()
    expect(screen.getByText(/^read-only GTM API$/i)).toBeInTheDocument()
    expect(screen.getByText('G-SAFE12345')).toBeInTheDocument()
    expect(screen.getByText('page_view, purchase')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/access[_ -]?token|server-token/i)
    await user.click(screen.getByRole('button', { name: /import audit and local comparison/i }))

    const editor = screen.getByRole('textbox', { name: /edit container\.json/i })
    expect(editor.value).toContain('tracking-playground/gtm-api-snapshot/v2')
    expect(editor.value).toContain('"readOnly": true')
    expect(editor.value).toContain('Default Workspace')
    expect(editor.value).toContain('"matchedEventNames": [')
    expect(editor.value).toContain('"page_view"')
    expect(editor.value).toContain('"onlyInWorkspace": [')
    expect(editor.value).toContain('"generate_lead"')
    expect(editor.value).toContain('"onlyInGtm": [')
    expect(editor.value).toContain('"purchase"')
    expect(editor.value).not.toMatch(/access[_ -]?token/i)
  })

  test('shows setup guidance without exposing a connect action when OAuth is unconfigured', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ configured: false, connected: false }) })))
    await renderApp('/tag-workspace#container=GTM-SAFE123')
    expect(await screen.findByText(/add the server-side Google OAuth settings/i)).toBeInTheDocument()
    expect(screen.getByText(/OAuth setup required/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /connect Google Tag Manager/i })).not.toBeInTheDocument()
  })
})
