import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import AnalyticsDebugPanel from './AnalyticsDebugPanel'
import ConsentBanner from './ConsentBanner'
import Waves from './Waves'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/forms', label: 'Forms Lab' },
  { to: '/utm-builder', label: 'UTM Builder' },
  { to: '/tag-lab', label: 'GTM + GA4 Lab', requiresGtmAccess: true },
  { to: '/login', label: 'Login' },
  { to: '/privacy', label: 'Privacy' },
]

function Layout() {
  const [showConsentSettings, setShowConsentSettings] = useState(false)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [theme, setTheme] = useState(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ))

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      window.localStorage.setItem('tracking-playground-theme', theme)
    } catch {
      // Keep theme switching available when storage is blocked.
    }

    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute('content', theme === 'dark' ? '#121216' : '#5b4df0')
  }, [theme])

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
      .finally(() => {
        if (active) {
          setAuthReady(true)
        }
      })

    function handleUserChanged(event) {
      setUser(event.detail)
      setAuthReady(true)
    }

    window.addEventListener('auth:user-changed', handleUserChanged)

    return () => {
      active = false
      window.removeEventListener('auth:user-changed', handleUserChanged)
    }
  }, [])

  return (
    <>
      <Waves
        className="site-waves"
        lineColor={theme === 'dark' ? 'rgba(184, 255, 114, 0.12)' : 'rgba(25, 103, 210, 0.16)'}
        backgroundColor={theme === 'dark' ? 'rgba(18, 18, 22, 0.24)' : 'rgba(255, 255, 255, 0.22)'}
        waveSpeedX={0.0125}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={20}
        friction={0.9}
        tension={0.01}
        maxCursorMove={120}
        xGap={12}
        yGap={36}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <header className="site-header">
        <a className="site-title" href="/">
          <span aria-hidden="true">✦</span>
          Tracking Playground
        </a>
        <nav
          id="main-navigation"
          className={isMenuOpen ? 'is-open' : undefined}
          aria-label="Main navigation"
        >
          {navItems.filter((item) => (
            !item.requiresGtmAccess
            || (user?.email_verified && Number(user.admin_status) === 1)
          )).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
              end={item.to === '/'}
              onClick={() => setIsMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-header-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-pressed={theme === 'dark'}
            onClick={() => setTheme((currentTheme) => (
              currentTheme === 'dark' ? 'light' : 'dark'
            ))}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
            <strong>{theme === 'dark' ? 'Dark' : 'Light'}</strong>
          </button>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={isMenuOpen}
            aria-controls="main-navigation"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setIsMenuOpen((currentValue) => !currentValue)}
          >
            <span aria-hidden="true" />
            <span aria-hidden="true" />
            <span aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="page-shell">
        <Outlet context={{ authReady, user, theme }} />
      </main>

      <footer className="site-footer">
        <p>Practice project for GA4, GTM, Google Ads, UTM, and consent testing.</p>
        <button type="button" onClick={() => setShowConsentSettings(true)}>
          Reopen consent settings
        </button>
      </footer>

      <ConsentBanner />
      {showConsentSettings && (
        <ConsentBanner
          forceOpen
          onClose={() => setShowConsentSettings(false)}
        />
      )}
      <AnalyticsDebugPanel />
    </>
  )
}

export default Layout
