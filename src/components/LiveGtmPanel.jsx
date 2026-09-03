import { useEffect, useMemo, useRef, useState } from 'react'
import { buildLiveGtmDocument, LIVE_GTM_SESSION_MS } from '../utils/liveGtm'

const EMPTY_CONSENT = { permission: false, synthetic: false, destinations: false }

function LiveGtmPanel({ containerId, payload, canSend, selectedFile }) {
  const iframeRef = useRef(null)
  const portRef = useRef(null)
  const sessionCounterRef = useRef(0)
  const [showConsent, setShowConsent] = useState(false)
  const [consent, setConsent] = useState(EMPTY_CONSENT)
  const [confirmation, setConfirmation] = useState('')
  const [session, setSession] = useState(null)
  const [documentSource, setDocumentSource] = useState('')
  const [phase, setPhase] = useState('off')
  const [activity, setActivity] = useState([])
  const [feedback, setFeedback] = useState('Live GTM is off. Offline tools remain available.')

  const readyToConfirm = useMemo(
    () => Object.values(consent).every(Boolean) && confirmation.trim().toUpperCase() === containerId,
    [confirmation, consent, containerId],
  )

  useEffect(() => () => portRef.current?.close(), [])

  useEffect(() => {
    if (!session) return undefined
    const timer = window.setTimeout(() => {
      portRef.current?.close()
      portRef.current = null
      setSession(null)
      setDocumentSource('')
      setPhase('expired')
      setFeedback('The 10-minute Live GTM session expired and was destroyed.')
    }, LIVE_GTM_SESSION_MS)
    return () => window.clearTimeout(timer)
  }, [session])

  function record(type, message) {
    setActivity((items) => [{ id: `${session?.token || 'session'}-${items.length + 1}`, type, message }, ...items].slice(0, 20))
  }

  function beginSession() {
    if (!readyToConfirm) return
    sessionCounterRef.current += 1
    const token = `live-${sessionCounterRef.current}`
    setDocumentSource(buildLiveGtmDocument(containerId, token))
    setSession({ token })
    setPhase('connecting')
    setActivity([])
    setShowConsent(false)
    setFeedback(`Connecting ${containerId} inside the restricted live frame…`)
  }

  function disconnect(message = 'Live GTM disconnected. The isolated frame was destroyed.') {
    portRef.current?.close()
    portRef.current = null
    setSession(null)
    setDocumentSource('')
    setPhase('off')
    setFeedback(message)
    setConsent(EMPTY_CONSENT)
    setConfirmation('')
  }

  function connectFrame() {
    if (!session || !iframeRef.current?.contentWindow || portRef.current) return
    if (typeof MessageChannel === 'undefined') {
      disconnect('This browser does not support the secure message channel. Live GTM stayed off.')
      return
    }
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      const message = event.data
      if (!message || message.sessionToken !== session.token) return
      if (message.type === 'live:status') {
        const status = message.detail?.status
        if (status === 'connected') {
          setPhase('connected')
          setFeedback(`${containerId} connected. Only clean event files can be sent.`)
          record('connected', `${containerId} loaded in the isolated frame.`)
        } else if (status === 'loading') {
          setPhase('connecting')
        } else if (status === 'error') {
          record('error', 'The container could not load and the frame was destroyed.')
          disconnect('The GTM container could not load. The isolated frame was destroyed.')
        }
      }
      if (message.type === 'live:event' && message.detail?.payload?.event) {
        record('event', `${message.detail.payload.event} entered the live dataLayer.`)
      }
    }
    channel.port1.start()
    portRef.current = channel.port1
    iframeRef.current.contentWindow.postMessage({ type: 'live:connect', sessionToken: session.token }, '*', [channel.port2])
  }

  function sendSelectedEvent() {
    if (phase !== 'connected' || !canSend || !payload || !session) return
    portRef.current?.postMessage({ type: 'live:push', sessionToken: session.token, payload: JSON.parse(JSON.stringify(payload)) })
    setFeedback(`${payload.event} was sent to the isolated live dataLayer. Tags in ${containerId} may now contact allowed analytics endpoints.`)
  }

  return (
    <section className={`live-gtm-panel is-${phase}`} aria-labelledby="live-gtm-heading">
      <div className="live-gtm-overview">
        <div className="live-gtm-heading"><div><h2 id="live-gtm-heading">Opt-in Live GTM connection</h2></div><span><i aria-hidden="true" />{phase === 'off' ? 'Off' : phase}</span></div>
        <p>{feedback}</p>
        <div className="live-gtm-boundaries"><span>Opaque iframe</span><span>Google-only CSP</span><span>Custom scripts blocked</span><span>10-minute limit</span></div>
        {!session ? <button className="live-gtm-review" type="button" onClick={() => setShowConsent(true)}>Review and opt in</button> : <button className="live-gtm-disconnect" type="button" onClick={() => disconnect()}>Disconnect and destroy</button>}
      </div>

      <div className="live-gtm-runtime">
        {session ? <><div><span>Restricted live frame</span><code>{session.token}</code></div><iframe ref={iframeRef} title={`Restricted Live GTM ${containerId}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={documentSource} onLoad={connectFrame} /><button type="button" onClick={sendSelectedEvent} disabled={phase !== 'connected' || !canSend}>Send selected event live</button><small>{canSend ? `${selectedFile} passed every safety check.` : 'Select a warning-free event file before sending.'}</small></> : <div className="live-gtm-off"><span aria-hidden="true">◎</span><strong>No live frame exists</strong><p>Nothing contacts Google until you complete the opt-in review.</p></div>}
      </div>

      <div className="live-gtm-activity"><div><strong>Live activity</strong><button type="button" onClick={() => setActivity([])} disabled={!activity.length}>Clear</button></div>{activity.length ? <ol>{activity.map((item) => <li className={`is-${item.type}`} key={item.id}><span>{item.type}</span><p>{item.message}</p></li>)}</ol> : <p>No live activity.</p>}</div>

      {showConsent && <div className="live-gtm-consent-backdrop" role="presentation">
        <section className="live-gtm-consent" role="dialog" aria-modal="true" aria-labelledby="live-consent-heading">
          <div className="live-consent-heading"><span aria-hidden="true">!</span><div><h2 id="live-consent-heading">Before connecting {containerId}</h2></div></div>
          <p>This loads code configured by the container owner. The frame cannot read the main site, and its policy blocks custom scripts and non-Google destinations, but allowed events may reach Google Analytics destinations owned by the container owner.</p>
          <div className="live-consent-checks">
            <label><input type="checkbox" checked={consent.permission} onChange={(event) => setConsent((current) => ({ ...current, permission: event.target.checked }))} /><span><strong>I own or may test this container</strong><small>I have permission to generate practice traffic.</small></span></label>
            <label><input type="checkbox" checked={consent.synthetic} onChange={(event) => setConsent((current) => ({ ...current, synthetic: event.target.checked }))} /><span><strong>I will use synthetic data only</strong><small>No customer data, credentials, or identifiers.</small></span></label>
            <label><input type="checkbox" checked={consent.destinations} onChange={(event) => setConsent((current) => ({ ...current, destinations: event.target.checked }))} /><span><strong>I understand events can leave this browser</strong><small>Allowed analytics endpoints may receive the event.</small></span></label>
          </div>
          <label className="live-consent-confirm">Type <code>{containerId}</code> to confirm<input value={confirmation} onChange={(event) => setConfirmation(event.target.value.toUpperCase())} autoComplete="off" /></label>
          <div className="live-consent-actions"><button type="button" onClick={() => { setShowConsent(false); setConsent(EMPTY_CONSENT); setConfirmation('') }}>Keep Live GTM off</button><button type="button" onClick={beginSession} disabled={!readyToConfirm}>Connect for 10 minutes</button></div>
        </section>
      </div>}
    </section>
  )
}

export default LiveGtmPanel
