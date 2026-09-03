import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { canAccessGtmLab } from '../utils/gtmAccess'

function getLoginRedirect(location) {
  const next = `${location.pathname}${location.search}${location.hash}`
  return `/login?access=verified-admin&next=${encodeURIComponent(next)}`
}

function AccessBoundary({ authReady, user }) {
  const location = useLocation()

  if (!authReady) {
    return <div className="page-loading" role="status">Checking account access…</div>
  }

  if (!canAccessGtmLab(user)) {
    return <Navigate replace to={getLoginRedirect(location)} />
  }

  return <Outlet />
}

export function RequireVerifiedAdmin() {
  const { authReady, user } = useOutletContext() || {}
  return <AccessBoundary authReady={authReady} user={user} />
}

export function StandaloneRequireVerifiedAdmin() {
  const [auth, setAuth] = useState({ ready: false, user: null })

  useEffect(() => {
    let active = true

    fetch('/api/me', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : { user: null }))
      .then((data) => {
        if (active) setAuth({ ready: true, user: data.user })
      })
      .catch(() => {
        if (active) setAuth({ ready: true, user: null })
      })

    return () => {
      active = false
    }
  }, [])

  return <AccessBoundary authReady={auth.ready} user={auth.user} />
}
