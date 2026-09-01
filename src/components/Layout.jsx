import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import AnalyticsDebugPanel from './AnalyticsDebugPanel'
import ConsentBanner from './ConsentBanner'
import PlaygroundConsole from './PlaygroundConsole'
import Waves from './Waves'

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/forms', label: 'Forms Lab' },
  { to: '/utm-builder', label: 'UTM Builder' },
  { to: '/tag-lab', label: 'GTM + GA4 Lab' },
  { to: '/login', label: 'Login' },
  { to: '/privacy', label: 'Privacy' },
]

function Layout() {
  const [showConsentSettings, setShowConsentSettings] = useState(false)
  const [user, setUser] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

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

    function handleUserChanged(event) {
      setUser(event.detail)
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
        lineColor="rgba(25, 103, 210, 0.16)"
        backgroundColor="rgba(255, 255, 255, 0.22)"
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
        <nav
          id="main-navigation"
          className={isMenuOpen ? 'is-open' : undefined}
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
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
      </header>

      <PlaygroundConsole />

      <main className="page-shell">
        <Outlet context={{ user }} />
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
