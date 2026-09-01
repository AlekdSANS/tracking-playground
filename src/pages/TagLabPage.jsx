import { useEffect, useMemo, useRef, useState } from 'react'
import { isValidGtmContainerId } from '../utils/tagLab'

const GA4_EVENT_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,39}$/

const eventPresets = [
  {
    name: 'page_view',
    label: 'Page view',
    description: 'A virtual visit to the lab landing page.',
    color: 'blue',
    parameters: {
      page_title: 'Tracking Playground Lab',
      page_location: 'https://sandbox.invalid/tag-lab',
      debug_mode: true,
    },
  },
  {
    name: 'generate_lead',
    label: 'Generate lead',
    description: 'A recommended GA4 event for a completed lead form.',
    color: 'violet',
    parameters: {
      currency: 'USD',
      value: 25,
      lead_source: 'practice_form',
      debug_mode: true,
    },
  },
  {
    name: 'sign_up',
    label: 'Sign up',
    description: 'A recommended GA4 account registration event.',
    color: 'lime',
    parameters: {
      method: 'email',
      debug_mode: true,
    },
  },
  {
    name: 'purchase',
    label: 'Purchase',
    description: 'A compact ecommerce payload with one synthetic item.',
    color: 'peach',
    parameters: {
      transaction_id: 'LAB-1001',
      currency: 'USD',
      value: 42,
      items: [
        {
          item_id: 'LAB-COURSE',
          item_name: 'Analytics practice pack',
          price: 42,
          quantity: 1,
        },
      ],
      debug_mode: true,
    },
  },
]

const guideSections = [
  {
    id: 'setup',
    label: 'Set up',
    title: 'Create disposable practice destinations',
    intro: 'Keep learning traffic separate from anything used by real visitors.',
    steps: [
      'Create a new Web container in Google Tag Manager specifically for practice.',
      'Create a test GA4 property and Web data stream, then copy its G- measurement ID.',
      'Paste only the GTM- container ID into this lab. Never paste a complete script tag.',
      'Start in simulation mode first if you want to inspect payloads before loading GTM.',
    ],
    links: [
      {
        label: 'GTM test environments',
        href: 'https://support.google.com/tagmanager/answer/6311518?hl=en',
      },
      {
        label: 'GA4 event setup',
        href: 'https://developers.google.com/analytics/devguides/collection/ga4/events',
      },
    ],
  },
  {
    id: 'gtm',
    label: 'GTM',
    title: 'Turn dataLayer pushes into tags',
    intro: 'The lab emits the same object pattern that GTM custom-event triggers consume.',
    steps: [
      'Create a Google tag in GTM using your test GA4 measurement ID and fire it on Initialization – All Pages.',
      'Create a Custom Event trigger. Use generate_lead, sign_up, purchase, or your custom event name.',
      'Create a Google Analytics Event tag and connect the matching Custom Event trigger.',
      'Create Data Layer Variables for parameters such as value, currency, method, and lead_source.',
      'Use GTM Preview to confirm which tag fired and which variables were available before publishing.',
    ],
    links: [
      {
        label: 'Custom event triggers',
        href: 'https://support.google.com/tagmanager/answer/7679219?hl=en',
      },
      {
        label: 'Preview and debug GTM',
        href: 'https://support.google.com/tagmanager/answer/6107056?hl=en',
      },
      {
        label: 'Google tag in GTM',
        href: 'https://support.google.com/tagmanager/answer/15756616?hl=en',
      },
    ],
  },
  {
    id: 'ga4',
    label: 'GA4',
    title: 'Verify names and parameters in GA4',
    intro: 'The presets include debug_mode so test events are easier to identify.',
    steps: [
      'Open GA4 Admin, then Data display → DebugView for your test property.',
      'Fire an event here and look for it in the DebugView seconds stream.',
      'Select the event and compare its parameters with the payload shown in the lab console.',
      'Prefer recommended names such as generate_lead, sign_up, and purchase when they match the behavior.',
      'Keep debug traffic out of production reporting and never send personal information in event parameters.',
    ],
    links: [
      {
        label: 'GA4 DebugView',
        href: 'https://support.google.com/analytics/answer/7201382?hl=en',
      },
      {
        label: 'Recommended GA4 events',
        href: 'https://developers.google.com/analytics/devguides/collection/ga4/reference/events',
      },
    ],
  },
  {
    id: 'safety',
    label: 'Safety',
    title: 'Know what the isolation does',
    intro: 'A GTM container can execute code, so the lab deliberately limits its reach.',
    steps: [
      'The iframe has an opaque origin and script permission only—no same-origin access, forms, popups, or top navigation.',
      'Its Content Security Policy allows Google tagging endpoints but blocks arbitrary third-party script hosts.',
      'It receives synthetic payloads only and cannot read the main app DOM, login state, or browser storage.',
      'Custom HTML and some Preview features may be restricted by the sandbox. Use a dedicated staging site for unrestricted integration testing.',
      'Reset the session whenever you switch containers or finish practicing.',
    ],
    links: [
      {
        label: 'Google dataLayer guide',
        href: 'https://developers.google.com/tag-platform/tag-manager/datalayer',
      },
      {
        label: 'GTM and Content Security Policy',
        href: 'https://developers.google.com/tag-platform/security/guides/csp',
      },
    ],
  },
]

function buildSandboxDocument(containerId) {
  const safeContainerId = isValidGtmContainerId(containerId)
    ? containerId.trim().toUpperCase()
    : ''
  const containerLiteral = JSON.stringify(safeContainerId)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://www.googletagmanager.com https://tagmanager.google.com; connect-src https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; img-src data: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; style-src 'unsafe-inline'; frame-src https://www.googletagmanager.com https://tagmanager.google.com; form-action 'none'; base-uri 'none'; object-src 'none'">
    <meta name="referrer" content="no-referrer">
    <style>
      :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 16px; color: #f7f6ff; background: #252238; }
      .frame-shell { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: center; min-height: 82px; border: 1px solid #48445e; border-radius: 12px; padding: 14px; background: #1d1b2c; }
      .dot { width: 11px; height: 11px; border-radius: 50%; background: #c9f45b; box-shadow: 0 0 0 7px rgba(201, 244, 91, .1); }
      strong, small { display: block; }
      strong { margin-bottom: 4px; font-size: 14px; }
      small { color: #aaa6c3; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
    </style>
  </head>
  <body>
    <div class="frame-shell">
      <span class="dot" aria-hidden="true"></span>
      <div>
        <strong>Isolated dataLayer runtime</strong>
        <small id="frame-status">Starting sandbox…</small>
      </div>
    </div>
    <script>
      (function () {
        var containerId = ${containerLiteral};
        var statusElement = document.getElementById('frame-status');

        function send(type, detail) {
          window.parent.postMessage({ type: type, detail: detail || {} }, '*');
        }

        function safePayload(payload) {
          try {
            return JSON.parse(JSON.stringify(payload));
          } catch (error) {
            return { event: String(payload && payload.event || 'unknown_event') };
          }
        }

        window.dataLayer = window.dataLayer || [];
        var nativePush = window.dataLayer.push.bind(window.dataLayer);
        window.dataLayer.push = function () {
          var items = Array.prototype.slice.call(arguments);
          var result = nativePush.apply(window.dataLayer, items);
          items.forEach(function (item) {
            if (item && typeof item === 'object' && typeof item.event === 'string') {
              send('tag-lab:event', { payload: safePayload(item) });
            }
          });
          return result;
        };

        window.addEventListener('message', function (message) {
          if (message.source !== window.parent) return;
          var data = message.data;
          if (!data || data.type !== 'tag-lab:push') return;
          if (typeof data.eventName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(data.eventName)) return;
          var parameters = data.parameters;
          if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) parameters = {};
          var payload = Object.assign({ event: data.eventName }, safePayload(parameters));
          payload.event = data.eventName;
          window.dataLayer.push(payload);
        });

        send('tag-lab:status', { status: 'ready', containerId: containerId });

        if (!containerId) {
          statusElement.textContent = 'Simulation mode · no external container';
          return;
        }

        statusElement.textContent = 'Loading ' + containerId + ' from Google…';
        send('tag-lab:status', { status: 'loading', containerId: containerId });
        window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });

        var script = document.createElement('script');
        script.async = true;
        script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(containerId);
        script.onload = function () {
          statusElement.textContent = containerId + ' loaded · ready for events';
          send('tag-lab:status', { status: 'loaded', containerId: containerId });
        };
        script.onerror = function () {
          statusElement.textContent = 'Container could not load · simulation still works';
          send('tag-lab:status', { status: 'error', containerId: containerId });
        };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>`
}

function formatLabTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp))
}

function TagLabPage() {
  const iframeRef = useRef(null)
  const [containerId, setContainerId] = useState('')
  const [loadedContainerId, setLoadedContainerId] = useState('')
  const [sessionNumber, setSessionNumber] = useState(0)
  const [sandboxStatus, setSandboxStatus] = useState('idle')
  const [events, setEvents] = useState([])
  const [feedback, setFeedback] = useState('')
  const [customEventName, setCustomEventName] = useState('demo_interaction')
  const [customParameters, setCustomParameters] = useState(
    '{\n  "interaction_type": "button_click",\n  "debug_mode": true\n}',
  )
  const [activeGuideId, setActiveGuideId] = useState('setup')

  const sandboxDocument = useMemo(
    () => buildSandboxDocument(loadedContainerId),
    [loadedContainerId],
  )

  const activeGuide =
    guideSections.find((section) => section.id === activeGuideId) || guideSections[0]

  useEffect(() => {
    function handleSandboxMessage(event) {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      const message = event.data
      if (!message || typeof message.type !== 'string') {
        return
      }

      if (message.type === 'tag-lab:status') {
        setSandboxStatus(message.detail?.status || 'ready')
        return
      }

      if (message.type !== 'tag-lab:event') {
        return
      }

      const payload = message.detail?.payload
      if (!payload || typeof payload.event !== 'string') {
        return
      }

      const serializedPayload = JSON.stringify(payload)
      if (serializedPayload.length > 12000) {
        return
      }

      setEvents((currentEvents) => [
        {
          payload,
          timestamp: new Date().toISOString(),
        },
        ...currentEvents,
      ].slice(0, 20))
    }

    window.addEventListener('message', handleSandboxMessage)
    return () => window.removeEventListener('message', handleSandboxMessage)
  }, [])

  useEffect(() => {
    if (!sessionNumber) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setLoadedContainerId('')
      setSessionNumber(0)
      setSandboxStatus('idle')
      setEvents([])
      setFeedback('The 10-minute sandbox session expired and was cleared.')
    }, 10 * 60 * 1000)

    return () => window.clearTimeout(timeoutId)
  }, [sessionNumber])

  function startSession(nextContainerId = '') {
    setLoadedContainerId(nextContainerId)
    setSessionNumber((currentNumber) => currentNumber + 1)
    setSandboxStatus(nextContainerId ? 'loading' : 'ready')
    setEvents([])
    setFeedback(
      nextContainerId
        ? `Starting an isolated session for ${nextContainerId}.`
        : 'Simulation-only sandbox started.',
    )
  }

  function handleContainerSubmit(event) {
    event.preventDefault()
    const normalizedId = containerId.trim().toUpperCase()

    if (!isValidGtmContainerId(normalizedId)) {
      setFeedback('Enter a container ID like GTM-ABC1234. Raw tags and scripts are rejected.')
      return
    }

    startSession(normalizedId)
  }

  function resetSession() {
    setLoadedContainerId('')
    setContainerId('')
    setSessionNumber(0)
    setSandboxStatus('idle')
    setEvents([])
    setFeedback('Sandbox reset. No container is running.')
  }

  function pushEvent(eventName, parameters) {
    if (!sessionNumber || !iframeRef.current?.contentWindow) {
      setFeedback('Start the sandbox before firing an event.')
      return
    }

    iframeRef.current.contentWindow.postMessage(
      {
        type: 'tag-lab:push',
        eventName,
        parameters,
      },
      '*',
    )
    setFeedback(`${eventName} was pushed into the isolated dataLayer.`)
  }

  function handleCustomEvent(event) {
    event.preventDefault()
    const normalizedName = customEventName.trim()

    if (!GA4_EVENT_PATTERN.test(normalizedName)) {
      setFeedback('Use 1–40 letters, numbers, or underscores, starting with a letter.')
      return
    }

    try {
      const parameters = JSON.parse(customParameters)

      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
        throw new Error('Parameters must be an object.')
      }

      pushEvent(normalizedName, parameters)
    } catch {
      setFeedback('Custom parameters must be a valid JSON object.')
    }
  }

  const statusLabel = {
    idle: 'Sandbox offline',
    ready: 'Simulation ready',
    loading: 'Loading GTM',
    loaded: 'GTM connected',
    error: 'GTM blocked · simulation ready',
  }[sandboxStatus]

  return (
    <section className="tag-lab-page">
      <div className="tag-lab-intro">
        <div>
          <p className="eyebrow">Isolated practice environment</p>
          <h1>GTM + GA4 event lab</h1>
          <p>
            Load a test container in a disposable sandbox, push realistic
            dataLayer events, and follow the guide from trigger to DebugView.
          </p>
        </div>
        <div className="lab-safety-note">
          <span aria-hidden="true">◉</span>
          <div>
            <strong>Main site protected</strong>
            <p>Only a GTM container ID is accepted. Raw scripts never touch this page.</p>
          </div>
        </div>
      </div>

      <div className="tag-lab-workbench">
        <div className="tag-lab-sidebar">
          <form className="tag-lab-setup" onSubmit={handleContainerSubmit}>
            <div className="lab-panel-heading">
              <span>01</span>
              <div>
                <p>Connect the sandbox</p>
                <h2>Add a practice container</h2>
              </div>
            </div>
            <label className="field">
              GTM container ID
              <input
                type="text"
                value={containerId}
                onChange={(event) => setContainerId(event.target.value.toUpperCase())}
                placeholder="GTM-ABC1234"
                autoComplete="off"
                maxLength="28"
                aria-describedby="container-id-help"
              />
            </label>
            <p id="container-id-help" className="lab-field-help">
              Use a container you own. The ID stays in memory and expires after 10 minutes.
            </p>
            <div className="tag-lab-setup-actions">
              <button type="submit" className="primary-button">
                Launch with GTM
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => startSession('')}
              >
                Simulate only
              </button>
            </div>
            <button type="button" className="tag-lab-reset" onClick={resetSession}>
              Reset session
            </button>
            <p className="form-status muted" aria-live="polite">{feedback}</p>
          </form>

          <nav className="lab-guide-shortcuts" aria-label="GTM and GA4 guide sections">
            <p className="eyebrow">Quick guide</p>
            {guideSections.map((section, index) => (
              <button
                type="button"
                className={section.id === activeGuideId ? 'is-active' : undefined}
                onClick={() => setActiveGuideId(section.id)}
                key={section.id}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="tag-lab-stage" aria-label="GTM sandbox and event controls">
          <div className="tag-lab-stage-header">
            <span className={`lab-stage-status is-${sandboxStatus}`}>{statusLabel}</span>
            <code>{loadedContainerId || 'No external container'}</code>
          </div>

          {sessionNumber ? (
            <iframe
              key={`${loadedContainerId || 'simulation'}-${sessionNumber}`}
              ref={iframeRef}
              className="tag-lab-frame"
              title="Isolated GTM dataLayer runtime"
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={sandboxDocument}
            />
          ) : (
            <div className="tag-lab-placeholder">
              <span aria-hidden="true">↳</span>
              <strong>Your isolated runtime starts here.</strong>
              <p>Connect a disposable GTM container or begin in simulation mode.</p>
            </div>
          )}

          <section className="lab-event-section" aria-labelledby="preset-events-heading">
            <div className="lab-section-heading">
              <div>
                <span>02</span>
                <div>
                  <p>Push and inspect</p>
                  <h2 id="preset-events-heading">Fire a practice event</h2>
                </div>
              </div>
              <small>Every preset includes debug_mode: true</small>
            </div>
            <div className="lab-event-grid">
              {eventPresets.map((preset) => (
                <button
                  type="button"
                  className={`lab-event-card is-${preset.color}`}
                  onClick={() => pushEvent(preset.name, preset.parameters)}
                  key={preset.name}
                >
                  <span>{preset.label}</span>
                  <code>{preset.name}</code>
                  <small>{preset.description}</small>
                  <strong aria-hidden="true">Push ↗</strong>
                </button>
              ))}
            </div>
          </section>

          <form className="lab-custom-event" onSubmit={handleCustomEvent}>
            <div className="lab-section-heading">
              <div>
                <span>03</span>
                <div>
                  <p>Make your own</p>
                  <h2>Custom event</h2>
                </div>
              </div>
            </div>
            <div className="lab-custom-grid">
              <label className="field">
                Event name
                <input
                  type="text"
                  value={customEventName}
                  onChange={(event) => setCustomEventName(event.target.value)}
                  maxLength="40"
                />
              </label>
              <label className="field">
                Parameters (JSON object)
                <textarea
                  value={customParameters}
                  onChange={(event) => setCustomParameters(event.target.value)}
                  rows="5"
                  spellCheck="false"
                />
              </label>
            </div>
            <button type="submit" className="secondary-button">Push custom event</button>
          </form>

          <section className="lab-output" aria-labelledby="lab-output-heading">
            <div className="lab-output-header">
              <div>
                <p className="eyebrow">Isolated dataLayer</p>
                <h2 id="lab-output-heading">Event output</h2>
              </div>
              <button type="button" onClick={() => setEvents([])}>Clear output</button>
            </div>
            {events.length ? (
              <ol className="lab-output-list" aria-live="polite">
                {events.map((entry, index) => (
                  <li key={`${entry.payload.event}-${entry.timestamp}-${index}`}>
                    <div>
                      <span>{String(events.length - index).padStart(2, '0')}</span>
                      <strong>{entry.payload.event}</strong>
                      <time dateTime={entry.timestamp}>{formatLabTime(entry.timestamp)}</time>
                    </div>
                    <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="lab-output-empty">
                <strong>No sandbox events yet.</strong>
                <span>Start a session, then push a preset or custom event.</span>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="tag-guide" aria-labelledby="tag-guide-heading">
        <div className="tag-guide-heading">
          <div>
            <p className="eyebrow">From first tag to DebugView</p>
            <h2 id="tag-guide-heading">GTM + GA4 field guide</h2>
          </div>
          <p>Follow one section at a time while keeping the event lab open above.</p>
        </div>
        <div className="tag-guide-card">
          <div className="tag-guide-tabs" role="tablist" aria-label="Guide topics">
            {guideSections.map((section, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={section.id === activeGuideId}
                className={section.id === activeGuideId ? 'is-active' : undefined}
                onClick={() => setActiveGuideId(section.id)}
                key={section.id}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {section.label}
              </button>
            ))}
          </div>
          <article className="tag-guide-content" role="tabpanel">
            <p className="eyebrow">{activeGuide.label}</p>
            <h3>{activeGuide.title}</h3>
            <p>{activeGuide.intro}</p>
            <ol>
              {activeGuide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <div className="tag-guide-links">
              {activeGuide.links.map((link) => (
                <a href={link.href} target="_blank" rel="noreferrer" key={link.href}>
                  {link.label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </article>
        </div>
      </section>
    </section>
  )
}

export default TagLabPage
