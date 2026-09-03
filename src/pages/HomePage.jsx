import { Link } from 'react-router-dom'
import ContactActions from '../components/ContactActions'
import { useAnalyticsEvents } from '../hooks/useAnalyticsEvents'

const experiments = [
  {
    to: '/forms?experiment=contact',
    number: '01',
    eyebrow: 'Contact form',
    title: 'Try a contact form',
    description: 'Fill in a form and see which tracking events are sent.',
    color: 'violet',
  },
  {
    to: '/forms?experiment=callback',
    number: '02',
    eyebrow: 'Callback form',
    title: 'Ask for a callback',
    description: 'Use a short form and see how the request is tracked.',
    color: 'lime',
  },
  {
    to: '/forms?experiment=newsletter',
    number: '03',
    eyebrow: 'Newsletter form',
    title: 'Join the newsletter',
    description: 'Try a signup and see the events it creates.',
    color: 'peach',
  },
  {
    to: '/utm-builder',
    number: '04',
    eyebrow: 'UTM link',
    title: 'Build a tracking link',
    description: 'Add campaign details and copy the finished link.',
    color: 'blue',
  },
  {
    to: '/tag-lab',
    number: '05',
    eyebrow: 'GTM and GA4',
    title: 'Practice tag setup',
    description: 'Test tags and events in a safe practice workspace.',
    color: 'violet',
  },
]

function HomePage() {
  const [events] = useAnalyticsEvents(3)
  const sentEvents = events.filter((event) => event.pushed_to_data_layer !== false).length
  const blockedEvents = events.length - sentEvents
  const conversions = events.filter((event) => (
    event.event?.includes('success') || event.event?.includes('conversion')
  )).length

  return (
    <section className="home-page">
      <div className="playground-hero">
        <div className="home-intro">
          <div className="lab-badge">
            <span aria-hidden="true" />
            Ready to use
          </div>
          <h1>
            Learn how{' '}
            <span>tracking works.</span>
          </h1>
          <p>
            Try forms, send events, change consent settings, and build UTM links.
            You can see what happens as you go.
          </p>
        </div>

        <div className="lab-preview" aria-label="Live event stream">
          <div className="lab-preview-header">
            <div>
              <strong className="preview-title">Live event stream</strong>
            </div>
            <span className="preview-status">Recording</span>
          </div>
          <div className="preview-route">
            <span>Current page</span>
            <code>{window.location.pathname}</code>
          </div>
          <ol className="preview-events">
            {events.length ? events.map((event, index) => {
              const wasSent = event.pushed_to_data_layer !== false

              return (
                <li key={`${event.event}-${event.timestamp || 'event'}-${index}`}>
                  <span className="event-index">
                    {String(events.length - index).padStart(2, '0')}
                  </span>
                  <div>
                    <strong>{event.event}</strong>
                    <small>{event.page_path || window.location.pathname}</small>
                  </div>
                  <span className={`event-state ${wasSent ? 'is-success' : 'is-blocked'}`}>
                    {wasSent ? 'sent' : 'blocked'}
                  </span>
                </li>
              )
            }) : (
              <li className="preview-empty">
                <div>
                  <strong>Waiting for an event</strong>
                  <small>Your next tracked action will appear here.</small>
                </div>
              </li>
            )}
          </ol>
          <div className="preview-footer">
            <span><strong>{sentEvents}</strong> sent</span>
            <span><strong>{blockedEvents}</strong> blocked</span>
            <span><strong>{conversions}</strong> conversions</span>
          </div>
          <img
            className="lab-preview-sticker"
            src="/silly/laced.webp"
            alt=""
            aria-hidden="true"
            width="512"
            height="512"
            decoding="async"
          />
        </div>
      </div>

      <section className="experiment-section" id="experiment-deck">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Things to try</p>
            <h2>Choose an activity</h2>
          </div>
          <p>Each activity lets you try a real tracking flow.</p>
        </div>
        <div className="experiment-grid">
          {experiments.map((experiment) => (
            <Link
              className={`experiment-card is-${experiment.color}`}
              to={experiment.to}
              key={experiment.to}
            >
              <span className="experiment-number">{experiment.number}</span>
              <div>
                <span className="experiment-eyebrow">{experiment.eyebrow}</span>
                <h3>{experiment.title}</h3>
                <p>{experiment.description}</p>
              </div>
              <span className="experiment-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="home-side-quest">
        <div>
          <p className="eyebrow">Quick test</p>
          <h2>Try the contact buttons</h2>
          <p>Click a button to see how that action is tracked.</p>
        </div>
        <ContactActions location="home_page" />
      </div>
    </section>
  )
}

export default HomePage
