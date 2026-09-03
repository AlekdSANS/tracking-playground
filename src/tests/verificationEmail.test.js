import process from 'node:process'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const resendSend = vi.hoisted(() => vi.fn())

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: resendSend }
  },
}))

import { sendVerificationEmail } from '../../api/_lib/verificationEmail.js'

describe('verification email delivery', () => {
  beforeEach(() => {
    process.env.APP_URL = 'https://tracking.example.com'
    process.env.RESEND_API_KEY = 're_test'
    process.env.AUTH_FROM_EMAIL = 'Tracking Playground <accounts@tracking.example.com>'
    resendSend.mockReset()
    resendSend.mockResolvedValue({ data: { id: 'email-1' }, error: null })
  })

  test('sends the account token only in a server-generated verification URL', async () => {
    await sendVerificationEmail({
      email: 'alex@example.com',
      name: 'Alex',
      token: 'safe-token',
    })

    expect(resendSend).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Tracking Playground <accounts@tracking.example.com>',
      to: 'alex@example.com',
      subject: expect.stringMatching(/verify/i),
      text: expect.stringContaining(
        'https://tracking.example.com/api/verify-email?token=safe-token',
      ),
    }))
  })

  test('reports a rejected Resend delivery to the registration handler', async () => {
    resendSend.mockResolvedValue({ data: null, error: { message: 'rejected' } })

    await expect(sendVerificationEmail({
      email: 'alex@example.com',
      name: 'Alex',
      token: 'safe-token',
    })).rejects.toThrow('Verification email could not be sent')
  })
})

