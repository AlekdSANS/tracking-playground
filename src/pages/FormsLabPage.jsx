import { useSearchParams } from 'react-router-dom'
import CallbackForm from '../components/CallbackForm'
import ContactForm from '../components/ContactForm'
import NewsletterForm from '../components/NewsletterForm'

const experiments = [
  {
    id: 'contact',
    label: 'Contact',
    eyebrow: 'Lead capture',
    title: 'Complete lead journey',
    description:
      'Start, validate, and submit a complete lead journey with a dedicated form name and location.',
    image: '/silly/silly-1.png',
    imageAlt: 'Business cat mascot',
    color: 'violet',
  },
  {
    id: 'callback',
    label: 'Callback',
    eyebrow: 'Micro conversion',
    title: 'Short intent signal',
    description:
      'Practice a shorter intent signal without sending the entered phone number or preferred time to analytics.',
    image: '/silly/silly-2.png',
    imageAlt: 'Golem mascot',
    color: 'lime',
  },
  {
    id: 'newsletter',
    label: 'Newsletter',
    eyebrow: 'Audience growth',
    title: 'Audience growth signal',
    description:
      'Compare signup events, checkbox validation, and consent-friendly parameters in one compact flow.',
    image: '/silly/silly-3.png',
    imageAlt: 'Newsletter cat mascot',
    color: 'peach',
  },
]

function FormsLabPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedExperiment = searchParams.get('experiment')
  const activeExperiment =
    experiments.find((experiment) => experiment.id === requestedExperiment) ?? experiments[0]

  function selectExperiment(experimentId) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('experiment', experimentId)
    setSearchParams(nextParams, { replace: true })
  }

  return (
    <section className="forms-lab-page">
      <div className="forms-lab-heading">
        <div>
          <p className="eyebrow">Three flows, one route</p>
          <h1>Forms Lab</h1>
          <p>
            Switch experiments without leaving the page. Each form keeps its own
            event names, validation, and conversion behavior.
          </p>
        </div>
        <span className="forms-lab-count" aria-label="Three form experiments">
          03 experiments
        </span>
      </div>

      <div className="forms-lab-switcher" role="tablist" aria-label="Form experiments">
        {experiments.map((experiment, index) => {
          const isActive = experiment.id === activeExperiment.id

          return (
            <button
              className={`forms-lab-tab is-${experiment.color}${isActive ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`forms-lab-panel-${experiment.id}`}
              id={`forms-lab-tab-${experiment.id}`}
              tabIndex={isActive ? 0 : -1}
              key={experiment.id}
              onClick={() => selectExperiment(experiment.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{experiment.label}</strong>
              <small>{experiment.eyebrow}</small>
            </button>
          )
        })}
      </div>

      <div
        className={`forms-lab-panel is-${activeExperiment.color}`}
        role="tabpanel"
        id={`forms-lab-panel-${activeExperiment.id}`}
        aria-labelledby={`forms-lab-tab-${activeExperiment.id}`}
      >
        <div className="forms-lab-intro">
          <div>
            <p className="eyebrow">{activeExperiment.eyebrow}</p>
            <h2>{activeExperiment.title}</h2>
            <p>{activeExperiment.description}</p>
          </div>
          <img src={activeExperiment.image} alt={activeExperiment.imageAlt} />
        </div>

        <div className="forms-lab-form" key={activeExperiment.id}>
          {activeExperiment.id === 'contact' && (
            <ContactForm
              formName="contact_page_form"
              formLocation="contact_page"
              title="Contact page form"
            />
          )}
          {activeExperiment.id === 'callback' && <CallbackForm />}
          {activeExperiment.id === 'newsletter' && <NewsletterForm />}
        </div>
      </div>
    </section>
  )
}

export default FormsLabPage
