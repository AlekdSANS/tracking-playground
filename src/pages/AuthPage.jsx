import { useEffect, useState } from 'react'
import { trackAuthError, trackAuthSuccess, trackLogout } from '../utils/analytics'

async function requestAuth(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response
    .json()
    .catch(() => ({ error: `Request failed with status ${response.status}.` }))

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }

  return data
}

function getAuthErrorType(message) {
  const normalizedMessage = message.toLowerCase()

  if (normalizedMessage.includes('already exists')) {
    return 'duplicate_login'
  }

  if (normalizedMessage.includes('incorrect')) {
    return 'invalid_credentials'
  }

  if (normalizedMessage.includes('3-32') || normalizedMessage.includes('8 characters')) {
    return 'validation_error'
  }

  if (normalizedMessage.includes('public access is restricted')) {
    return 'restricted_access'
  }

  if (normalizedMessage.includes('mongodb')) {
    return 'configuration_error'
  }

  return 'server_error'
}

function AuthPage() {
  const [mode, setMode] = useState('login')
  const [user, setUser] = useState(null)
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    fetch('/api/me')
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data) => {
        if (active) {
          setUser(data.user)
        }
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setStatus('')

    try {
      const data = await requestAuth(
        mode === 'login' ? '/api/login' : '/api/register',
        {
          name,
          login,
          password,
        },
      )

      setUser(data.user)
      window.dispatchEvent(new CustomEvent('auth:user-changed', { detail: data.user }))
      trackAuthSuccess(mode, data.user)
      setPassword('')
      setStatus(mode === 'login' ? 'Logged in.' : 'Account created.')
    } catch (error) {
      trackAuthError(mode, getAuthErrorType(error.message))
      setStatus(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setStatus('')

    try {
      await fetch('/api/logout', { method: 'POST' })
      trackLogout(user)
      setUser(null)
      window.dispatchEvent(new CustomEvent('auth:user-changed', { detail: null }))
      setStatus('Logged out.')
    } catch {
      setStatus('Could not log out.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="narrow-page auth-page">
      <div className="page-intro">
        <h1>Login system</h1>
        <p>
          Create an account or log in using the MongoDB-backed API routes.
        </p>
      </div>

      <div className="form-card auth-card">
        {user ? (
          <div className="auth-panel">
            <h2>Signed in</h2>
            <p className="muted">
              {user.name ? `${user.name} ` : ''}
              {user.login}
            </p>
            <p className="muted">
              {user.admin_status === 1 ? 'Admin account' : 'Basic account'}
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
              disabled={loading}
            >
              Log out
            </button>
          </div>
        ) : (
          <>
            <div className="auth-mode-tabs" aria-label="Auth mode">
              <button
                type="button"
                className={mode === 'login' ? 'active' : undefined}
                onClick={() => {
                  setMode('login')
                  setStatus('')
                }}
              >
                Log in
              </button>
              <button
                type="button"
                className={mode === 'register' ? 'active' : undefined}
                onClick={() => {
                  setMode('register')
                  setStatus('')
                }}
              >
                Register
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              {mode === 'register' && (
                <label className="field">
                  Name
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </label>
              )}

              <label className="field">
                Login
                <input
                  type="text"
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                  autoComplete="username"
                />
              </label>

              <label className="field">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  minLength="8"
                />
              </label>

              <button type="submit" className="primary-button" disabled={loading}>
                {mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </form>
          </>
        )}

        <p className="form-status muted" aria-live="polite">
          {status}
        </p>
      </div>
    </section>
  )
}

export default AuthPage
