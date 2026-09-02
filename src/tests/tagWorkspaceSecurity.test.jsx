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

function renderApp(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
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

  test('keeps the workspace locked when the fragment is missing or hostile', () => {
    renderApp('/tag-workspace#container=javascript%3Aalert(1)')
    expect(screen.getByRole('heading', { name: /valid gtm container id is required/i })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  })

  test('does not mount the main site shell or tracking console in a valid workspace', () => {
    renderApp('/tag-workspace#container=GTM-SAFE123')
    expect(screen.getByRole('heading', { name: /datalayer workspace/i })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('complementary', { name: /analytics debug console/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/consent settings/i)).not.toBeInTheDocument()
    expect(window.dataLayer).toEqual([])
  })

  test('does not persist virtual-file edits to browser storage', () => {
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
    renderApp('/tag-workspace#container=GTM-SAFE123')
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
    renderApp('/tag-workspace#container=GTM-SAFE123')
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))
    const iframe = screen.getByTitle(/disposable datalayer runtime/i)
    expect(iframe).toHaveAttribute('sandbox', 'allow-scripts')
    expect(iframe.getAttribute('sandbox')).not.toMatch(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/)

    await user.click(screen.getByRole('button', { name: /cancel and dispose/i }))
    expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  })

  test('destroys an unresponsive iframe at the hard timeout', () => {
    vi.useFakeTimers()
    renderApp('/tag-workspace#container=GTM-SAFE123')
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
    renderApp('/tag-workspace#container=GTM-SAFE123')
    await user.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))
    const iframe = screen.queryByTitle(/disposable datalayer runtime/i)
    if (iframe) fireEvent.load(iframe)

    await waitFor(() => expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument())
    expect(screen.getAllByText(/^complete$/i)).toHaveLength(2)
    expect(screen.getByText('0 requests')).toBeInTheDocument()
    expect(screen.getByText(/completed.*sandbox was destroyed/i)).toBeInTheDocument()
  })
})
