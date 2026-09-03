import { render, screen } from '@testing-library/react'
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
  ])('redirects %s from the lab to login', async (_label, user) => {
    renderWithSession('/tag-lab', user)

    expect(await screen.findByRole('heading', { name: /login system/i })).toBeInTheDocument()
    expect(screen.getByText(/verified administrator account/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /gtm \+ ga4 workspace launcher/i })).not.toBeInTheDocument()
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
