import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import App from '../App'
import { canAccessGtmLab } from '../utils/gtmAccess'

function renderWithSession(path, user) {
  vi.spyOn(window, 'fetch').mockImplementation(async (url) => {
    if (url === '/api/me') {
      return {
        ok: Boolean(user),
        json: async () => ({ user }),
      }
    }

    return { ok: false, json: async () => ({ error: 'Unavailable.' }) }
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('GTM and GA4 lab route access', () => {
  test.each([
    ['anonymous visitors', null],
    ['unverified administrators', {
      user_id: 'admin-1',
      login: 'admin',
      email_verified: false,
      admin_status: 1,
    }],
    ['verified basic users', {
      user_id: 'user-1',
      login: 'student',
      email_verified: true,
      admin_status: 0,
    }],
  ])('lets %s view the lab while keeping its launcher locked', async (_label, user) => {
    const visitor = userEvent.setup()
    renderWithSession('/tag-lab', user)

    expect(await screen.findByRole('heading', { name: /gtm \+ ga4 workspace launcher/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /gtm \+ ga4 lab/i })).toBeInTheDocument()
    await visitor.type(screen.getByLabelText(/gtm container id/i), 'GTM-TEST99')
    expect(screen.getByRole('button', { name: /open secure workspace/i })).toBeDisabled()
    expect(screen.queryByRole('heading', { name: /login system/i })).not.toBeInTheDocument()
  })

  test('offers anonymous visitors a login path back to the public lab', async () => {
    renderWithSession('/tag-lab', null)

    const loginLink = await screen.findByRole('link', { name: /sign in to unlock/i })
    expect(loginLink).toHaveAttribute('href', '/login?access=verified-admin&next=%2Ftag-lab')
  })

  test('redirects an unverified session away from the standalone workspace', async () => {
    renderWithSession('/tag-workspace#container=GTM-TEST99', {
      user_id: 'admin-1',
      login: 'admin',
      email_verified: false,
      admin_status: 1,
    })

    expect(await screen.findByRole('heading', { name: /login system/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /datalayer workspace/i })).not.toBeInTheDocument()
  })

  test('grants access only to a verified administrator', () => {
    expect(canAccessGtmLab({ email_verified: true, admin_status: 1 })).toBe(true)
    expect(canAccessGtmLab({ email_verified: false, admin_status: 1 })).toBe(false)
    expect(canAccessGtmLab({ email_verified: true, admin_status: 0 })).toBe(false)
    expect(canAccessGtmLab(null)).toBe(false)
  })
})
