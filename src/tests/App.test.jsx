import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import App from '../App'
import ContactForm from '../components/ContactForm'
import ConsentBanner from '../components/ConsentBanner'
import { saveConsent } from '../utils/consent'
import { isValidGtmContainerId } from '../utils/tagLab'

function renderApp(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>,
  )
}

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

test('shows a fired event in the playground console', async () => {
  saveConsent({ necessary: true, analytics: true, advertising: true })
  const user = userEvent.setup()
  renderApp(['/'])

  await user.click(screen.getByRole('button', { name: /fire test event/i }))

  await waitFor(() => {
    expect(window.dataLayer).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'playground_test_event',
          trigger: 'console',
        }),
      ]),
    )
  })

  expect(screen.getAllByText('playground_test_event').length).toBeGreaterThanOrEqual(2)
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

test('shows the isolated GTM and GA4 lab guide', () => {
  renderApp(['/tag-lab'])

  expect(
    screen.getByRole('heading', { name: /gtm \+ ga4 event lab/i }),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('heading', { name: /gtm \+ ga4 field guide/i }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /launch with gtm/i })).toBeDisabled()
  expect(screen.queryByRole('button', { name: /simulate only/i })).not.toBeInTheDocument()
})

test('unlocks the sandbox only for a valid GTM container ID', async () => {
  const user = userEvent.setup()
  renderApp(['/tag-lab'])

  const launchButton = screen.getByRole('button', { name: /launch with gtm/i })
  expect(launchButton).toBeDisabled()
  expect(screen.queryByTitle(/isolated gtm datalayer runtime/i)).not.toBeInTheDocument()

  await user.type(screen.getByLabelText(/gtm container id/i), 'GTM-TEST99')

  expect(launchButton).toBeEnabled()
  await user.click(launchButton)
  expect(screen.getByTitle(/isolated gtm datalayer runtime/i)).toBeInTheDocument()
})

test('rejects pasted scripts in the GTM container field', async () => {
  const user = userEvent.setup()
  renderApp(['/tag-lab'])

  await user.type(
    screen.getByLabelText(/gtm container id/i),
    '<script>alert(1)</script>',
  )
  await user.click(screen.getByRole('button', { name: /launch with gtm/i }))

  expect(
    screen.getByText(/raw tags and scripts are rejected/i),
  ).toBeInTheDocument()
})
