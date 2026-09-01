import { useEffect, useState } from 'react'
import { getStoredCampaignParams, getSafeCampaignParams } from '../utils/campaignParams'
import { getStoredConsent } from '../utils/consent'
import { trackEvent, trackFormError, trackFormSuccess } from '../utils/analytics'

function AnalyticsDebugPanel() {
  const [events, setEvents] = useState([])
  const [consentState, setConsentState] = useState(getStoredConsent)
  const [campaignParams, setCampaignParams] = useState(getStoredCampaignParams)

  useEffect(() => {
    function handleAnalyticsEvent(event) {
      setEvents((currentEvents) => [event.detail, ...currentEvents].slice(0, 20))
      setConsentState(getStoredConsent())
      setCampaignParams(getStoredCampaignParams())
    }

    window.addEventListener('analytics:event', handleAnalyticsEvent)

    return () => {
      window.removeEventListener('analytics:event', handleAnalyticsEvent)
    }
  }, [])

  return (
    <aside className="debug-panel" aria-label="Analytics debug console">
      <div className="debug-header">
        <div>
          <h2>Analytics debug console</h2>
          <p>Live playground details for every visitor.</p>
        </div>
        <div className="debug-actions">
          <button type="button" onClick={() => setEvents([])}>
            Clear events
          </button>
          <button
            type="button"
            onClick={() => trackEvent('debug_test_event', { test_event: true })}
          >
            Push test event
          </button>
          <button
            type="button"
            onClick={() => trackFormSuccess('main_contact_form', 'debug_panel')}
          >
            Simulate conversion
          </button>
          <button
            type="button"
            onClick={() =>
              trackFormError('main_contact_form', 'debug_panel', 'debug_error')
            }
          >
            Simulate error
          </button>
        </div>
      </div>

      <div className="debug-grid">
        <div>
          <strong>Current page</strong>
          <code>{window.location.pathname}</code>
        </div>
        <div>
          <strong>Consent</strong>
          <pre>{JSON.stringify(consentState, null, 2)}</pre>
        </div>
        <div>
          <strong>Stored UTM parameters</strong>
          <pre>{JSON.stringify(getSafeCampaignParams(), null, 2)}</pre>
        </div>
        <div>
          <strong>Development gclid check</strong>
          <code>{campaignParams.gclid ? 'gclid exists' : 'no gclid'}</code>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="muted">No debug events yet.</p>
      ) : (
        <ol className="event-list">
          {events.map((event, index) => (
            <li key={`${event.event}-${event.timestamp}-${index}`}>
              <strong>{event.event}</strong>
              <span>{event.timestamp}</span>
              <pre>{JSON.stringify(event, null, 2)}</pre>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}

export default AnalyticsDebugPanel
