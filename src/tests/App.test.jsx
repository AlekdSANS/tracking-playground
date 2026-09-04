import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from '../App'
import ContactForm from '../components/ContactForm'
import ConsentBanner from '../components/ConsentBanner'
import { saveConsent } from '../utils/consent'
import { isValidGtmContainerId } from '../utils/tagLab'
import {
  formatWorkspaceJson,
  groupWorkspaceFiles,
  readWorkspaceContainerId,
  validateWorkspaceFile,
} from '../utils/tagWorkspace'
import { getGuideProgress, getWorkspaceGuideContext } from '../utils/tagWorkspaceGuide'
import { DISPOSABLE_RUNNER_DOCUMENT, RUNNER_TIMEOUT_MS, createSimulationSummary } from '../utils/tagRunner'

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

function renderAdminApp(initialEntries) {
  vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
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

    return { ok: false, json: async () => ({ error: 'Not configured.' }) }
  })

  return renderApp(initialEntries)
}

afterEach(() => vi.restoreAllMocks())

function renderContactForm() {
  return render(
    <MemoryRouter>
      <ContactForm
        formName="main_contact_form"
        formLocation="test_page"
        title="Test contact form"
      />
    </MemoryRouter>,
  )
}

async function completeContactForm(user) {
  await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/phone number/i), '+48 123 456 789')
  await user.type(screen.getByLabelText(/message/i), 'Please contact me.')
}

test('switches themes and remembers the selection', async () => {
  delete document.documentElement.dataset.theme
  window.localStorage.removeItem('tracking-playground-theme')

  const user = userEvent.setup()
  const { unmount } = renderApp()

  await waitFor(() => {
    expect(document.documentElement.dataset.theme).toBe('light')
  })
  expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /switch to dark theme/i }))

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(window.localStorage.getItem('tracking-playground-theme')).toBe('dark')
  expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument()

  unmount()
  document.documentElement.dataset.theme = 'light'
  window.localStorage.removeItem('tracking-playground-theme')
})

test('shows required field validation', async () => {
  const user = userEvent.setup()
  renderContactForm()

  await user.click(screen.getByRole('button', { name: /submit form/i }))

  expect(screen.getByText(/full name is required/i)).toBeInTheDocument()
  expect(screen.getByText(/email is required/i)).toBeInTheDocument()
  expect(screen.getByText(/phone number is required/i)).toBeInTheDocument()
  expect(screen.getByText(/message is required/i)).toBeInTheDocument()
})

test('shows invalid email validation', async () => {
  const user = userEvent.setup()
  renderContactForm()

  await user.type(screen.getByLabelText(/full name/i), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/^email$/i), 'not-an-email')
  await user.type(screen.getByLabelText(/phone number/i), '+48 123 456 789')
  await user.type(screen.getByLabelText(/message/i), 'Please contact me.')
  await user.click(screen.getByRole('button', { name: /submit form/i }))

  expect(screen.getByText(/enter a valid email address/i)).toBeInTheDocument()
})

test('redirects to thank-you page after successful simulated submission', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  })
  renderApp(['/contact'])

  await completeContactForm(user)
  await user.click(screen.getByRole('button', { name: /submit form/i }))

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /thank you/i })).toBeInTheDocument()
  })

  window.fetch.mockRestore()
})

test('pushes an analytics event on form start', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  renderContactForm()

  await user.type(screen.getByLabelText(/full name/i), 'Ada')

  expect(window.dataLayer).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'contact_form_start',
        form_name: 'main_contact_form',
        form_location: 'test_page',
      }),
    ]),
  )
})

test('pushes an analytics event on form success', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  })
  renderApp(['/contact'])

  await completeContactForm(user)
  await user.click(screen.getByRole('button', { name: /submit form/i }))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'contact_form_success',
          form_name: 'contact_page_form',
        }),
      ]),
    )
  })

  window.fetch.mockRestore()
})

test('does not include personal information in analytics events', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  })
  renderApp(['/contact'])

  await completeContactForm(user)
  await user.click(screen.getByRole('button', { name: /submit form/i }))

  await waitFor(() => {
    expect(window.dataLayer.some((event) => event.event === 'contact_form_success')).toBe(true)
  })

  const analyticsText = JSON.stringify(window.dataLayer)
  expect(analyticsText).not.toContain('Ada Lovelace')
  expect(analyticsText).not.toContain('ada@example.com')
  expect(analyticsText).not.toContain('+48 123 456 789')
  expect(analyticsText).not.toContain('Please contact me.')

  window.fetch.mockRestore()
})

test('pushes an analytics event when email sending fails', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockResolvedValue({
    ok: false,
    json: async () => ({ error: 'Email could not be sent.' }),
  })
  renderApp(['/contact'])

  await completeContactForm(user)
  await user.click(screen.getByRole('button', { name: /submit form/i }))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'contact_form_error',
          error_type: 'email_send_error',
        }),
      ]),
    )
  })

  expect(screen.getByText(/email could not be sent/i)).toBeInTheDocument()
  window.fetch.mockRestore()
})

test('saves consent preferences', async () => {
  const user = userEvent.setup()
  render(<ConsentBanner />)

  await user.click(screen.getByRole('button', { name: /customize/i }))
  await user.click(screen.getByLabelText(/analytics/i))
  await user.click(screen.getByRole('button', { name: /save settings/i }))

  expect(JSON.parse(localStorage.getItem('analytics_practice_consent'))).toEqual({
    necessary: true,
    analytics: true,
    advertising: false,
  })
})

test('loads Google Tag Manager only after analytics consent', async () => {
  const user = userEvent.setup()
  const firstBanner = render(<ConsentBanner />)

  await user.click(screen.getByRole('button', { name: /reject optional tracking/i }))
  expect(document.getElementById('google-tag-manager-script')).not.toBeInTheDocument()

  firstBanner.unmount()
  window.localStorage.clear()
  render(<ConsentBanner />)
  await user.click(screen.getByRole('button', { name: /accept all/i }))

  const gtmScript = document.getElementById('google-tag-manager-script')
  expect(gtmScript).toBeInTheDocument()
  expect(gtmScript).toHaveAttribute(
    'src',
    expect.stringContaining('googletagmanager.com/gtm.js'),
  )
})

test('pushes a page-view event on route change', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  renderApp(['/'])

  await user.click(screen.getByRole('link', { name: /forms lab/i }))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'page_view',
          page_path: '/forms',
        }),
      ]),
    )
  })
})

test('switches between all form experiments on one page', async () => {
  const user = userEvent.setup()
  renderApp(['/forms?experiment=callback'])

  expect(screen.getByRole('heading', { name: /request a callback/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /request callback/i })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /newsletter/i }))

  expect(screen.getByRole('heading', { name: /newsletter signup/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
})

test('does not show the event console on experiment pages', () => {
  renderApp(['/forms'])

  expect(screen.queryByRole('button', { name: /fire test event/i })).not.toBeInTheDocument()
})

test('pushes source and campaign UTM values into analytics events', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  renderApp([
    '/?utm_source=gmail&utm_medium=email&utm_campaign=bro_test&utm_content=aaaa',
  ])

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'page_view',
          traffic_source: 'gmail',
          utm_source: 'gmail',
          campaign_name: 'bro_test',
          utm_campaign: 'bro_test',
          utm_medium: 'email',
          utm_content: 'aaaa',
        }),
      ]),
    )
  })
})

test('builds a telegram UTM link', () => {
  renderApp(['/utm-builder'])

  expect(screen.getByRole('heading', { name: /utm link creator/i })).toBeInTheDocument()
  expect(document.title).toBe('UTM Link Builder — Tracking Playground')
  expect(screen.getByDisplayValue(/utm_source=telegram/)).toBeInTheDocument()
  expect(screen.getByDisplayValue(/utm_medium=chat/)).toBeInTheDocument()
  expect(screen.getByDisplayValue(/utm_campaign=bro_test/)).toBeInTheDocument()
})

test('adds custom link parameters', async () => {
  const user = userEvent.setup()
  renderApp(['/utm-builder'])

  await user.click(screen.getByRole('button', { name: /add parameter/i }))
  const nameInputs = screen.getAllByPlaceholderText(/utm_source/i)
  const valueInputs = screen.getAllByPlaceholderText(/telegram/i)

  await user.type(nameInputs.at(-1), 'ref')
  await user.type(valueInputs.at(-1), 'bro')

  expect(screen.getByDisplayValue(/ref=bro/)).toBeInTheDocument()
})

test('adds a custom channel preset', async () => {
  const user = userEvent.setup()
  renderApp(['/utm-builder'])

  await user.type(screen.getByPlaceholderText(/tiktok/i), 'TikTok')
  await user.click(screen.getByRole('button', { name: /add channel/i }))

  expect(screen.getByLabelText(/tiktok/i)).toBeChecked()
  expect(screen.getByDisplayValue(/utm_source=tiktok/)).toBeInTheDocument()
})

test('shows the login system page', async () => {
  renderApp(['/login'])

  expect(screen.getByRole('heading', { name: /login system/i })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /log in/i })).toHaveLength(2)
  expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
})

test('pushes safe auth analytics after login success', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/me') {
      return {
        ok: false,
        json: async () => ({ user: null }),
      }
    }

    return {
      ok: true,
      json: async () => ({
        user: {
          user_id: 'user-1',
          login: 'alexadmin',
          admin_status: 1,
        },
      }),
    }
  })

  renderApp(['/login'])

  await user.type(screen.getByLabelText(/login/i), 'alexadmin')
  await user.type(screen.getByLabelText(/password/i), 'password123')
  await user.click(screen.getAllByRole('button', { name: /^log in$/i }).at(-1))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'login_success',
          auth_method: 'password',
          account_type: 'admin',
          admin_status: 1,
          status: 'success',
        }),
      ]),
    )
  })

  const analyticsText = JSON.stringify(window.dataLayer)
  expect(analyticsText).not.toContain('alexadmin')
  expect(analyticsText).not.toContain('password123')

  window.fetch.mockRestore()
})

test('pushes auth analytics after register error', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/me') {
      return {
        ok: false,
        json: async () => ({ user: null }),
      }
    }

    return {
      ok: false,
      json: async () => ({ error: 'An account with this login already exists.' }),
    }
  })

  renderApp(['/login'])

  await user.click(screen.getByRole('button', { name: /register/i }))
  await user.type(screen.getByLabelText(/name/i), 'Alex')
  await user.type(screen.getByLabelText(/^email$/i), 'alex@example.com')
  await user.type(screen.getByLabelText(/login/i), 'alexadmin')
  await user.type(screen.getByLabelText(/password/i), 'password123')
  await user.click(screen.getByRole('button', { name: /create account/i }))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'register_error',
          auth_method: 'password',
          status: 'error',
          error_type: 'duplicate_login',
        }),
      ]),
    )
  })

  window.fetch.mockRestore()
})

test('classifies restricted auth access for analytics', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/me') {
      return {
        ok: false,
        json: async () => ({ user: null }),
      }
    }

    return {
      ok: false,
      json: async () => ({
        error: 'Public access is restricted right now. Ask an admin for permission.',
      }),
    }
  })

  renderApp(['/login'])

  await user.type(screen.getByLabelText(/login/i), 'alexadmin')
  await user.type(screen.getByLabelText(/password/i), 'password123')
  await user.click(screen.getAllByRole('button', { name: /^log in$/i }).at(-1))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'login_error',
          error_type: 'restricted_access',
        }),
      ]),
    )
  })

  window.fetch.mockRestore()
})

test('shows analytics debug for every visitor', async () => {
  renderApp(['/'])

  expect(
    screen.getByRole('complementary', {
      name: /analytics debug console/i,
    }),
  ).toBeInTheDocument()
})

test('pushes an analytics event when opening a generated UTM link', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  renderApp(['/utm-builder'])

  await user.click(screen.getByRole('link', { name: /open link/i }))

  expect(window.dataLayer).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        event: 'utm_builder_open_link',
        tool_name: 'utm_builder',
        utm_channel: 'Telegram',
        generated_source: 'telegram',
        generated_medium: 'chat',
        generated_campaign: 'bro_test',
        generated_param_count: 3,
        generated_param_names: 'utm_source,utm_medium,utm_campaign',
      }),
    ]),
  )
})

test('validates GTM container IDs without accepting scripts', () => {
  expect(isValidGtmContainerId('GTM-ABC1234')).toBe(true)
  expect(isValidGtmContainerId('  gtm-test99  ')).toBe(true)
  expect(isValidGtmContainerId('<script>alert(1)</script>')).toBe(false)
  expect(isValidGtmContainerId('G-ABC1234')).toBe(false)
})

test('shows the isolated GTM and GA4 lab guide', async () => {
  renderAdminApp(['/tag-lab'])

  expect(
    await screen.findByRole('heading', { name: /gtm \+ ga4 workspace launcher/i }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: /secure workspace field guide/i }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /open secure workspace/i })).toBeDisabled()
  expect(screen.getByText(/explicit restricted 10-minute session/i)).toBeInTheDocument()
})

test('opens and closes the GTM container setup guide', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-lab'])

  const guideButton = await screen.findByRole('button', { name: /how to get an id/i })
  expect(guideButton).toHaveAttribute('aria-expanded', 'false')

  await user.click(guideButton)
  expect(guideButton).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByRole('complementary', { name: /how to create a google tag manager container/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /create a web container/i })).toBeInTheDocument()
  expect(document.documentElement).toHaveClass('gtm-setup-guide-open')

  await user.keyboard('{Escape}')
  expect(guideButton).toHaveAttribute('aria-expanded', 'false')
  expect(document.documentElement).not.toHaveClass('gtm-setup-guide-open')
})

test('opens the offline workspace only for a valid GTM container ID', async () => {
  const user = userEvent.setup()
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
  renderAdminApp(['/tag-lab'])

  const launchButton = await screen.findByRole('button', { name: /open secure workspace/i })
  expect(launchButton).toBeDisabled()

  await user.type(screen.getByLabelText(/gtm container id/i), 'GTM-TEST99')

  expect(launchButton).toBeEnabled()
  await user.click(launchButton)
  expect(openSpy).toHaveBeenCalledWith(
    '/tag-workspace#container=GTM-TEST99',
    'tag-workspace',
    'popup,noopener,noreferrer',
  )
  openSpy.mockRestore()
})

test('rejects pasted scripts in the GTM container field', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-lab'])

  await user.type(
    await screen.findByLabelText(/gtm container id/i),
    '<script>alert(1)</script>',
  )

  expect(screen.getByRole('button', { name: /open secure workspace/i })).toBeDisabled()
  expect(
    screen.getByText(/raw tags and scripts are rejected/i),
  ).toBeInTheDocument()
})

test('validates workspace files and flags unsafe data', () => {
  const validEvent = validateWorkspaceFile(
    'events/demo.json',
    '{"event":"demo_event","debug_mode":true}',
  )
  expect(validEvent.valid).toBe(true)

  const dangerous = validateWorkspaceFile(
    'events/demo.json',
    '{"event":"demo_event","__proto__":{"polluted":true}}',
  )
  expect(dangerous.valid).toBe(false)
  expect(dangerous.errors.join(' ')).toMatch(/blocked key/i)

  const personal = validateWorkspaceFile(
    'events/demo.json',
    '{"event":"demo_event","email":"person@example.com"}',
  )
  expect(personal.valid).toBe(true)
  expect(personal.warnings.join(' ')).toMatch(/personal|secret/i)
  expect(readWorkspaceContainerId('#container=gtm-test99')).toBe('GTM-TEST99')
  expect(readWorkspaceContainerId('#container=%3Cscript%3E')).toBe('')
})

test('renders the workspace without the site shell or tracking console', async () => {
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  expect(await screen.findByRole('heading', { name: /datalayer workspace/i })).toBeInTheDocument()
  expect(screen.getByRole('complementary', { name: /gtm and ga4 setup course/i })).toBeInTheDocument()
  expect(screen.getByText(/^live gtm opt-in$/i)).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('complementary', { name: /analytics debug console/i })).not.toBeInTheDocument()
})

test('groups virtual files and formats JSON safely', () => {
  expect(groupWorkspaceFiles(['events/lead.json', 'README.md'])).toEqual([
    { folder: 'Project', files: [{ name: 'README.md', label: 'README.md' }] },
    { folder: 'events', files: [{ name: 'events/lead.json', label: 'lead.json' }] },
  ])
  expect(formatWorkspaceJson('{"event":"lead"}').content).toBe('{\n  "event": "lead"\n}\n')
  expect(formatWorkspaceJson('{"event":}').error).toMatch(/invalid json|valid json/i)
})

test('creates and edits a virtual event file in memory', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  await user.click(await screen.findByRole('button', { name: /create new file/i }))
  await user.type(screen.getByLabelText(/new file path/i), 'events/signup.json')
  await user.click(screen.getByRole('button', { name: /^create$/i }))

  const editor = screen.getByRole('textbox', { name: /edit events\/signup.json/i })
  expect(editor.value).toContain('custom_event')
  fireEvent.change(editor, { target: { value: '{"event":"sign_up","debug_mode":true}' } })
  await user.click(screen.getByRole('button', { name: /^format$/i }))
  expect(editor.value).toContain('\n  "event": "sign_up"')
  expect(screen.getByText(/1 changed/i)).toBeInTheDocument()
})

test('applies schemas for event, container, and expectation files', () => {
  const badEvent = validateWorkspaceFile(
    'events/bad.json',
    '{"event":"9 invalid","bad-param":true}',
  )
  expect(badEvent.valid).toBe(false)
  expect(badEvent.schemaName).toBe('GA4 event')
  expect(badEvent.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: 'schema', path: '$.event', severity: 'error' }),
    expect.objectContaining({ category: 'schema', path: '$["bad-param"]', severity: 'error' }),
  ]))

  const badContainer = validateWorkspaceFile(
    'container.json',
    '{"containerVersion":{"container":{"publicId":"G-INVALID","name":""}}}',
  )
  expect(badContainer.errors.join(' ')).toMatch(/valid GTM-|needs a name/i)

  const duplicateTest = validateWorkspaceFile(
    'tests/events.json',
    '{"expected":["page_view","page_view"]}',
  )
  expect(duplicateTest.valid).toBe(true)
  expect(duplicateTest.safeToRun).toBe(false)
  expect(duplicateTest.warnings.join(' ')).toMatch(/duplicate/i)
})

test('reports dangerous keys, PII, and credentials with safe paths', () => {
  const result = validateWorkspaceFile(
    'events/private.json',
    JSON.stringify({
      event: 'generate_lead',
      customer: {
        email: 'person@example.com',
        ip: '192.168.1.25',
        authorization: 'Bearer abcdefghijklmnopqrstuvwxyz',
      },
    }).replace('"customer"', '"__proto__"'),
  )

  expect(result.valid).toBe(false)
  expect(result.safeToRun).toBe(false)
  expect(result.issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: 'security', code: 'dangerous-key', severity: 'error' }),
    expect.objectContaining({ category: 'privacy', code: 'pii-email', path: '$.__proto__.email' }),
    expect.objectContaining({ category: 'privacy', code: 'pii-ip', path: '$.__proto__.ip' }),
    expect.objectContaining({ category: 'credential', code: 'secret-bearer' }),
  ]))
})

test('scans Markdown for personal data without parsing it as JSON', () => {
  const result = validateWorkspaceFile('notes.md', 'Call +48 123 456 789 or person@example.com')

  expect(result.valid).toBe(true)
  expect(result.safeToRun).toBe(false)
  expect(result.schemaName).toBe('Markdown document')
  expect(result.warnings.join(' ')).toMatch(/email address|phone number/i)
})

test('builds contextual guidance and learning progress from workspace state', () => {
  const validation = validateWorkspaceFile('events/lead.json', '{"event":"generate_lead"}')
  const context = getWorkspaceGuideContext('events/lead.json', validation)
  const progress = getGuideProgress({
    selectedFile: 'events/lead.json',
    validation,
    modified: true,
    output: [{ payload: { event: 'generate_lead' } }],
  })

  expect(context.title).toBe('Build generate_lead')
  expect(context.steps.map((step) => step.title).join(' ')).toMatch(/run the simulation|test it with GTM/i)
  expect(progress.every((step) => step.complete)).toBe(true)
})

test('shows the GTM to GA4 flow and adds safe guide examples', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  expect(await screen.findByRole('complementary', { name: /contextual gtm and ga4 guide/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /create a ga4 property/i })).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: /^file$/i }))
  expect(screen.getByRole('heading', { name: /build page_view/i })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /^flow$/i }))
  expect(screen.getByRole('heading', { name: /from website to debugview/i })).toBeInTheDocument()
  expect(screen.getByText('page_view')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /^examples$/i }))
  await user.click(screen.getByRole('button', { name: /add sign up example to workspace/i }))

  expect(screen.getByRole('textbox', { name: /edit events\/example-sign_up.json/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /build sign_up/i })).toBeInTheDocument()
})

test('guides a beginner through validated GTM and GA4 setup lessons', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  expect(await screen.findByRole('heading', { name: /create a ga4 property/i })).toBeInTheDocument()
  expect(screen.getByText(/admin/i, { selector: '.setup-menu-path li' })).toBeInTheDocument()
  expect(screen.getByText(/the property is the home/i)).toBeInTheDocument()
  expect(screen.getByText(/0\/10 complete/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /^mark complete$/i }))
  expect(screen.getByRole('status')).toHaveTextContent(/enter your ga4 property name/i)
  await user.type(screen.getByLabelText(/your ga4 property name/i), 'Tracking Playground')
  await user.click(screen.getByRole('button', { name: /^mark complete$/i }))
  expect(screen.getByText(/1\/10 complete/i)).toBeInTheDocument()

  await user.click(screen.getAllByRole('button', { name: /lesson 3: copy the measurement id/i })[0])
  const measurementInput = screen.getByLabelText(/your ga4 measurement id/i)
  await user.type(measurementInput, 'GTM-WRONG99')
  await user.click(screen.getByRole('button', { name: /^mark complete$/i }))
  expect(screen.getByRole('status')).toHaveTextContent(/measurement ID begins with G-/i)
  await user.clear(measurementInput)
  await user.type(measurementInput, 'G-ABC1234567')
  await user.click(screen.getByRole('button', { name: /^mark complete$/i }))
  expect(screen.getByRole('status')).toHaveTextContent(/lesson 3 complete/i)
})

test('builds a recommended event without code and keeps the code editor optional', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  expect(await screen.findByRole('heading', { name: /describe the action.*get the implementation/i })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /no-code builder/i })).toHaveAttribute('aria-selected', 'true')
  expect(screen.queryByRole('region', { name: /file editor/i })).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /sign up.*new account/i }))
  expect(screen.getByLabelText(/^event name$/i)).toHaveValue('sign_up')
  expect(screen.getByLabelText(/when should it happen/i)).toHaveValue('Registration succeeds')
  await user.click(screen.getByRole('tab', { name: /^react$/i }))
  expect(screen.getByLabelText(/react output/i)).toHaveTextContent(/function trackSignUp/)
  expect(screen.getByText(/after account creation succeeds/i)).toBeInTheDocument()

  const personalCheckbox = screen.getByLabelText(/this value could contain personal information/i)
  await user.click(personalCheckbox)
  expect(screen.getByText(/personal information blocked/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /save and open in code editor/i })).toBeDisabled()
  await user.click(personalCheckbox)
  await user.click(screen.getByRole('button', { name: /save and open in code editor/i }))

  const editor = screen.getByRole('textbox', { name: /edit events\/sign_up\.json/i })
  expect(editor.value).toContain('"event": "sign_up"')
  expect(editor.value).toContain('"method": "email"')
  expect(screen.getByRole('tab', { name: /code editor/i })).toHaveAttribute('aria-selected', 'true')
})

test('walks a generated event through the exact GTM configuration and parameter map', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  await screen.findByRole('heading', { name: /describe the action.*get the implementation/i })
  await user.click(screen.getByRole('button', { name: /configure this event in gtm/i }))

  const walkthrough = screen.getByRole('region', { name: /configure generate_lead in gtm/i })
  expect(screen.getByRole('tab', { name: /gtm walkthrough/i })).toHaveAttribute('aria-selected', 'true')
  expect(within(walkthrough).getByRole('columnheader', { name: /website event/i })).toBeInTheDocument()
  expect(within(walkthrough).getByRole('columnheader', { name: /gtm variable or trigger/i })).toBeInTheDocument()
  expect(within(walkthrough).getAllByText('form_name').length).toBeGreaterThan(1)
  expect(within(walkthrough).getByText('DLV - form_name')).toBeInTheDocument()
  expect(within(walkthrough).getByText('Custom Event trigger')).toBeInTheDocument()
  expect(within(walkthrough).getByText('Event name')).toBeInTheDocument()
  expect(within(walkthrough).getAllByRole('listitem')).toHaveLength(10)
  await user.click(within(walkthrough).getByRole('button', { name: /create a ga4 event tag/i }))
  expect(within(walkthrough).getAllByText(/Google Analytics: GA4 Event/i)).toHaveLength(2)

  await user.click(within(walkthrough).getByRole('button', { name: /^mark complete$/i }))
  expect(within(walkthrough).getByLabelText(/1 of 10 GTM steps complete/i)).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /no-code builder/i }))
  await user.click(screen.getByRole('tab', { name: /gtm walkthrough/i }))
  expect(screen.getByLabelText(/1 of 10 GTM steps complete/i)).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: /no-code builder/i }))
  await user.click(screen.getByRole('button', { name: /sign up.*new account/i }))
  await user.click(screen.getByRole('tab', { name: /gtm walkthrough/i }))
  expect(screen.getByRole('heading', { name: /configure sign_up in gtm/i })).toBeInTheDocument()
  expect(screen.getByLabelText(/0 of 10 GTM steps complete/i)).toBeInTheDocument()
})

test('simulates button, form, and purchase events before real Tag Assistant testing', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  await screen.findByRole('heading', { name: /describe the action.*get the implementation/i })
  await user.click(screen.getByRole('tab', { name: /test simulator/i }))

  const lab = screen.getByRole('region', { name: /watch an event travel from website to ga4/i })
  expect(within(lab).getByText(/0 network requests/i)).toBeInTheDocument()
  const publishStep = within(lab).getByText(/publish only after verification/i).closest('li')
  expect(within(publishStep).getByRole('button', { name: /mark complete/i })).toBeDisabled()

  await user.click(within(lab).getByRole('tab', { name: /button click/i }))
  await user.click(within(lab).getByRole('button', { name: /click demo button/i }))
  expect(within(lab).getByText('dataLayer.push()', { selector: 'strong' })).toBeInTheDocument()
  expect(within(lab).getAllByText(/CE - button_click/).length).toBeGreaterThan(0)
  expect(within(lab).getByText(/GA4 payload produced/i)).toBeInTheDocument()

  await user.click(within(lab).getByRole('tab', { name: /form success/i }))
  await user.click(within(lab).getByRole('button', { name: /submit fake form/i }))
  expect(within(lab).getAllByText(/CE - generate_lead/).length).toBeGreaterThan(0)

  await user.click(within(lab).getByRole('tab', { name: /purchase complete/i }))
  await user.click(within(lab).getByRole('button', { name: /complete fake purchase/i }))
  expect(within(lab).getAllByText(/GA4 Event - purchase/).length).toBeGreaterThan(0)
  expect(within(lab).getAllByRole('listitem').length).toBeGreaterThanOrEqual(10)

  const realChecklist = within(lab).getByRole('region', { name: /test with tag assistant before publishing/i })
  const realSteps = within(realChecklist).getAllByRole('listitem')
  await user.type(within(realChecklist).getByRole('textbox', { name: /deployed website url/i }), 'https://tracking-playground-nu.vercel.app/')
  for (const step of realSteps.slice(0, 6)) await user.click(within(step).getByRole('button', { name: /mark complete/i }))
  expect(within(realSteps[6]).getByRole('button', { name: /mark complete/i })).toBeEnabled()
  await user.click(within(realSteps[6]).getByRole('button', { name: /mark complete/i }))
  expect(within(realChecklist).getByLabelText(/7 of 7 real testing steps complete/i)).toBeInTheDocument()
})

test('defines a network-disabled single-use runner contract', () => {
  expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/connect-src 'none'/)
  expect(DISPOSABLE_RUNNER_DOCUMENT).toMatch(/worker-src 'none'/)
  expect(DISPOSABLE_RUNNER_DOCUMENT).not.toMatch(/googletagmanager|google-analytics/i)
  expect(RUNNER_TIMEOUT_MS).toBe(4000)
  expect(createSimulationSummary({ event: 'sign_up', method: 'practice', debug_mode: true })).toEqual({
    triggerName: 'sign_up',
    parameterNames: ['method', 'debug_mode'],
    parameterCount: 2,
    dataLayerLength: 1,
    networkRequests: 0,
  })
})

test('creates and destroys a disposable runner iframe for each run', async () => {
  const user = userEvent.setup()
  renderAdminApp(['/tag-workspace#container=GTM-TEST99'])

  await screen.findByRole('heading', { name: /datalayer workspace/i })
  expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /run in fresh sandbox/i }))

  const runner = screen.getByTitle(/disposable datalayer runtime run-1/i)
  expect(runner).toHaveAttribute('sandbox', 'allow-scripts')
  expect(runner.getAttribute('srcdoc')).toMatch(/connect-src 'none'/)
  expect(screen.getByText(/this frame will be removed after one result/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /cancel and dispose/i }))
  expect(screen.queryByTitle(/disposable datalayer runtime/i)).not.toBeInTheDocument()
  expect(screen.getAllByText(/^cancelled$/i)).toHaveLength(2)
  expect(screen.getByText(/no result retained for this disposed run/i)).toBeInTheDocument()
})
