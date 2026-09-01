import { Link } from 'react-router-dom'
import ContactActions from '../components/ContactActions'

const experiments = [
  {
    to: '/forms?experiment=contact',
    number: '01',
    eyebrow: 'Lead capture',
    title: 'Build a clean conversion',
    description: 'Start, validate, submit, and inspect a complete form journey.',
    color: 'violet',
  },
  {
    to: '/forms?experiment=callback',
    number: '02',
    eyebrow: 'Micro conversion',
    title: 'Trigger a callback request',
    description: 'See how a shorter intent signal behaves in the event stream.',
    color: 'lime',
  },
  {
    to: '/forms?experiment=newsletter',
    number: '03',
    eyebrow: 'Audience growth',
    title: 'Track a newsletter signup',
    description: 'Compare one action that produces two useful analytics events.',
    color: 'peach',
  },
  {
    to: '/utm-builder',
    number: '04',
    eyebrow: 'Campaign lab',
    title: 'Mix your own UTM link',
    description: 'Change the ingredients and watch the campaign payload update.',
    color: 'blue',
  },
  {
    to: '/tag-lab',
    number: '05',
    eyebrow: 'Tag engineering',
    title: 'Practice GTM + GA4 safely',
    description: 'Load a disposable container, push events, and follow them into DebugView.',
    color: 'violet',
  },
]

function HomePage() {
  return (
    <section className="home-page">
      <div className="playground-hero">
        <div className="home-intro">
          <div className="lab-badge">
            <span aria-hidden="true" />
            Lab is live
          </div>
          <p className="eyebrow">Conversion tracking, hands on</p>
          <h1>
            Break things.
            <br />
            Learn tracking.
            <br />
            <span>Build confidence.</span>
          </h1>
          <p>
            A safe place to poke at forms, fire events, change consent, mix UTM
            links, and see what your analytics setup actually does.
          </p>
          <div className="hero-actions">
            <Link className="primary-button hero-primary" to="/forms?experiment=contact">
              Start an experiment <span aria-hidden="true">→</span>
            </Link>
            <a className="text-link" href="#experiment-deck">
              Browse the lab
            </a>
          </div>
        </div>

        <div className="lab-preview" aria-label="Example live event stream">
          <div className="lab-preview-header">
            <div>
              <span className="preview-kicker">Live event stream</span>
              <strong>Experiment #001</strong>
            </div>
            <span className="preview-status">Recording</span>
          </div>
          <div className="preview-route">
            <span>Current route</span>
            <code>/forms · contact</code>
          </div>
          <ol className="preview-events">
            <li>
              <span className="event-index">03</span>
              <div>
                <strong>contact_form_success</strong>
                <small>pushed to dataLayer</small>
              </div>
              <span className="event-state is-success">sent</span>
            </li>
            <li>
              <span className="event-index">02</span>
              <div>
                <strong>contact_form_submit</strong>
                <small>form_location: contact_page</small>
              </div>
              <span className="event-state is-success">sent</span>
            </li>
            <li>
              <span className="event-index">01</span>
              <div>
                <strong>contact_form_start</strong>
                <small>first interaction detected</small>
              </div>
              <span className="event-state is-success">sent</span>
            </li>
          </ol>
          <div className="preview-footer">
            <span><strong>3</strong> events</span>
            <span><strong>0</strong> errors</span>
            <span><strong>1</strong> conversion</span>
          </div>
          <img
            className="lab-preview-sticker"
            src="/silly/laced.webp"
            alt=""
            aria-hidden="true"
          />
        </div>
      </div>

      <section className="experiment-section" id="experiment-deck">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Pick a starting point</p>
            <h2>Choose your experiment</h2>
          </div>
          <p>Every card opens a real, trackable flow. There are no wrong clicks.</p>
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
          <p className="eyebrow">Side quest</p>
          <h2>Test a contact click</h2>
          <p>Even the smallest action can be a useful signal.</p>
        </div>
        <ContactActions location="home_page" />
      </div>
    </section>
  )
}

export default HomePage
