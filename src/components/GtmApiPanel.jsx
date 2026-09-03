import { useCallback, useEffect, useState } from 'react'

function GtmApiPanel({ containerId, onImportSnapshot }) {
  const [status, setStatus] = useState({ phase: 'checking', configured: true, expiresAt: null })
  const [snapshot, setSnapshot] = useState(null)
  const [message, setMessage] = useState('Checking the server-side GTM API connection…')

  const loadSnapshot = useCallback(async () => {
    setStatus((current) => ({ ...current, phase: 'loading' }))
    setMessage(`Verifying ${containerId} through the read-only GTM API…`)
    try {
      const response = await fetch(`/api/gtm-container?publicId=${encodeURIComponent(containerId)}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'The GTM API request failed.')
      setSnapshot(data)
      setStatus((current) => ({ ...current, phase: 'connected' }))
      setMessage(`${data.container.publicId} was verified. This snapshot is read-only.`)
    } catch (error) {
      setSnapshot(null)
      setStatus((current) => ({ ...current, phase: error.message.includes('again') ? 'disconnected' : 'error' }))
      setMessage(error.message)
    }
  }, [containerId])

  useEffect(() => {
    let active = true
    async function checkStatus() {
      if (typeof fetch !== 'function') {
        if (active) {
          setStatus({ phase: 'unavailable', configured: false, expiresAt: null })
          setMessage('Run the app with its API server to use Google authorization.')
        }
        return
      }
      try {
        const response = await fetch('/api/gtm-status', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
        const data = await response.json()
        if (!response.ok) throw new Error('The GTM API status is unavailable.')
        if (!active) return
        if (!data.configured) {
          setStatus({ phase: 'unavailable', configured: false, expiresAt: null })
          setMessage('Add the server-side Google OAuth settings to enable this integration.')
        } else if (!data.connected) {
          setStatus({ phase: 'disconnected', configured: true, expiresAt: null })
          setMessage('Connect Google with read-only permission when you want to verify this container.')
        } else {
          setStatus({ phase: 'loading', configured: true, expiresAt: data.expiresAt })
          loadSnapshot()
        }
      } catch {
        if (!active) return
        setStatus({ phase: 'unavailable', configured: false, expiresAt: null })
        setMessage('The API server is unavailable. Offline practice and Live GTM still work independently.')
      }
    }
    checkStatus()
    return () => { active = false }
  }, [loadSnapshot])

  async function disconnect() {
    try {
      await fetch('/api/gtm-disconnect', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } })
    } finally {
      setSnapshot(null)
      setStatus({ phase: 'disconnected', configured: true, expiresAt: null })
      setMessage('The encrypted API session was cleared.')
    }
  }

  const expiresLabel = status.expiresAt
    ? new Date(status.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <section className={`gtm-api-panel is-${status.phase}`} aria-labelledby="gtm-api-heading">
      <div className="gtm-api-intro">
        <div className="gtm-api-heading"><div><h2 id="gtm-api-heading">Read-only GTM API</h2></div><span><i aria-hidden="true" />{status.phase}</span></div>
        <p aria-live="polite">{message}</p>
        <div className="gtm-api-guardrails"><span>Read-only scope</span><span>HTTP-only token</span><span>10-minute expiry</span><span>No publish access</span></div>
        {status.phase === 'disconnected' && <a className="gtm-api-connect" href={`/api/gtm-oauth-start?container=${encodeURIComponent(containerId)}`}>Connect Google Tag Manager</a>}
        {status.phase === 'unavailable' && <div className="gtm-api-setup"><strong>OAuth setup required</strong><p>Configure the four GTM OAuth environment values, then run through the API-enabled development server.</p></div>}
        {['connected', 'loading', 'error'].includes(status.phase) && <div className="gtm-api-actions"><button type="button" onClick={loadSnapshot} disabled={status.phase === 'loading'}>Refresh snapshot</button><button type="button" onClick={disconnect}>Disconnect API</button></div>}
      </div>

      <div className="gtm-api-result">
        {snapshot ? <>
          <div className="gtm-api-result-heading"><div><span>Verified container</span><strong>{snapshot.container.name || snapshot.container.publicId}</strong></div><b>{snapshot.container.publicId}</b></div>
          <dl><div><dt>Account</dt><dd>{snapshot.account.name || snapshot.account.accountId}</dd></div><div><dt>Context</dt><dd>{snapshot.container.usageContext.join(', ') || 'Not specified'}</dd></div><div><dt>Domains</dt><dd>{snapshot.container.domainName.length || 0}</dd></div><div><dt>Workspaces</dt><dd>{snapshot.workspaces.length}</dd></div></dl>
          <div className="gtm-api-workspaces"><strong>Available workspaces</strong>{snapshot.workspaces.length ? <ul>{snapshot.workspaces.map((workspace) => <li key={workspace.path}><span>{workspace.name || 'Untitled workspace'}</span><code>{workspace.workspaceId}</code></li>)}</ul> : <p>No workspaces returned.</p>}</div>
          <button className="gtm-api-import" type="button" onClick={() => onImportSnapshot(snapshot)}>Import sanitized snapshot into container.json</button>
          {expiresLabel && <small>Authorization expires at {expiresLabel}. Reconnect to continue.</small>}
        </> : <div className="gtm-api-empty"><span aria-hidden="true">↯</span><strong>No account data in the browser</strong><p>The backend returns only sanitized container metadata. OAuth credentials never enter this workspace.</p></div>}
      </div>
    </section>
  )
}

export default GtmApiPanel
