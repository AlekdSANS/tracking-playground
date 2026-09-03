import { useEffect, useMemo, useState } from 'react'
import { useAnalyticsEvents } from '../hooks/useAnalyticsEvents'
import { trackEvent, trackFormError, trackFormSuccess } from '../utils/analytics'

const MAX_VISIBLE_EVENTS = 8

function formatEventTime(timestamp) {
  if (!timestamp) {
    return 'now'
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function getEventPresentation(eventName = '') {
  if (eventName.includes('error')) {
    return { tone: 'error', glyph: '!' }
  }

  if (eventName.includes('success') || eventName.includes('conversion')) {
    return { tone: 'conversion', glyph: '◆' }
  }

  if (eventName.includes('consent')) {
    return { tone: 'consent', glyph: '◐' }
  }

  if (eventName === 'page_view') {
    return { tone: 'navigation', glyph: '↗' }
  }

  return { tone: 'signal', glyph: '+' }
}

function PlaygroundConsole() {
  const [events, setEvents] = useAnalyticsEvents(MAX_VISIBLE_EVENTS)
  const [isOpen, setIsOpen] = useState(false)
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    function handleAnalyticsEvent() {
      setPulseKey((currentKey) => currentKey + 1)
    }

    window.addEventListener('analytics:event', handleAnalyticsEvent)
    return () => window.removeEventListener('analytics:event', handleAnalyticsEvent)
  }, [])

  const summary = useMemo(() => {
    return events.reduce(
      (counts, event) => {
        if (event.pushed_to_data_layer === false) {
          counts.blocked += 1
        } else {
          counts.sent += 1
        }

        if (event.event?.includes('success')) {
          counts.conversions += 1
        }

        return counts
      },
      { sent: 0, blocked: 0, conversions: 0 },
    )
  }, [events])

  const latestEvent = events[0]

  return (
    <section className={`playground-console ${isOpen ? 'is-open' : ''}`}>
      <div className="console-bar">
        <button
          type="button"
          className="console-toggle"
          aria-expanded={isOpen}
          aria-controls="playground-console-drawer"
          onClick={() => setIsOpen((currentValue) => !currentValue)}
        >
          <span className="console-live-dot" key={pulseKey} aria-hidden="true" />
          <span>
            <strong>Event console</strong>
            <small>{latestEvent?.event || 'Waiting for your first move'}</small>
          </span>
          <span className="console-count">{events.length}</span>
          <span className="console-chevron" aria-hidden="true">⌄</span>
        </button>

        <div className="console-quick-actions" aria-label="Quick lab controls">
          <button
            type="button"
            onClick={() => trackEvent('playground_test_event', { trigger: 'console' })}
          >
            Fire test event
          </button>
          <button
            type="button"
            onClick={() =>
              trackFormSuccess('main_contact_form', 'playground_console')
            }
          >
            Simulate conversion
          </button>
        </div>
      </div>

      <div id="playground-console-drawer" className="console-drawer">
        <div className="console-overview">
          <div className="console-summary" aria-label="Event summary">
            <span className="console-summary-card is-sent">
              <i aria-hidden="true" />
              <strong>{summary.sent}</strong>
              <small>Sent</small>
            </span>
            <span className="console-summary-card is-blocked">
              <i aria-hidden="true" />
              <strong>{summary.blocked}</strong>
              <small>Blocked</small>
            </span>
            <span className="console-summary-card is-conversion">
              <i aria-hidden="true" />
              <strong>{summary.conversions}</strong>
              <small>Conversions</small>
            </span>
          </div>
          <div className="console-secondary-actions">
            <button
              type="button"
              onClick={() =>
                trackFormError(
                  'main_contact_form',
                  'playground_console',
                  'simulated_error',
                )
              }
            >
              <span aria-hidden="true">!</span> Simulate error
            </button>
            <button type="button" onClick={() => setEvents([])}>
              <span aria-hidden="true">×</span> Clear
            </button>
          </div>
        </div>

        <div className="console-feed-heading">
          <div>
            <strong><span aria-hidden="true" /> Live event stream</strong>
            <small>Newest first · latest {MAX_VISIBLE_EVENTS}</small>
          </div>
          <code>{window.location.pathname}</code>
        </div>

        {events.length === 0 ? (
          <div className="console-empty">
            <strong>Nothing here yet.</strong>
            <span>Open a form, change consent, or fire a test event.</span>
          </div>
        ) : (
          <ol className="console-event-list" aria-live="polite">
            {events.map((event, index) => {
              const presentation = getEventPresentation(event.event)

              return (
                <li
                  className={`console-event-item is-${presentation.tone}`}
                  key={`${event.event}-${event.timestamp || 'event'}-${index}`}
                >
                  <span className="console-event-glyph" aria-hidden="true">
                    {presentation.glyph}
                  </span>
                  <span className="console-event-number">
                    {String(events.length - index).padStart(2, '0')}
                  </span>
                  <div className="console-event-copy">
                    <strong>{event.event}</strong>
                    <span>{event.page_path || window.location.pathname}</span>
                  </div>
                  <time dateTime={event.timestamp}>{formatEventTime(event.timestamp)}</time>
                  <span
                    className={
                      event.pushed_to_data_layer === false
                        ? 'console-event-status is-blocked'
                        : 'console-event-status is-sent'
                    }
                  >
                    {event.pushed_to_data_layer === false ? 'blocked' : 'sent'}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

export default PlaygroundConsole
