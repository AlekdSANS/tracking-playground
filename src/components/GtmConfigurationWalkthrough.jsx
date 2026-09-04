import { useMemo, useState } from 'react'
import { createGtmConfiguration, validateEventDraft } from '../utils/eventBuilder'

const AREA_ORDER = ['Website', 'Variables', 'Triggers', 'Tags', 'GA4']

function GtmConfigurationWalkthrough({ draft, completedSteps, onToggleStep, onBack }) {
  const configuration = useMemo(() => createGtmConfiguration(draft), [draft])
  const validation = useMemo(() => validateEventDraft(draft), [draft])
  const [activeStepId, setActiveStepId] = useState(configuration.steps[0].id)
  const [copyNotice, setCopyNotice] = useState('')
  const activeStepIndex = Math.max(0, configuration.steps.findIndex((step) => step.id === activeStepId))
  const progress = completedSteps.size * 10

  function toggleStep(stepId) {
    onToggleStep(stepId)
  }

  async function copyValue(value, label) {
    if (!navigator.clipboard?.writeText) {
      setCopyNotice('Clipboard is unavailable. Select and copy the value manually.')
      return
    }
    await navigator.clipboard.writeText(value)
    setCopyNotice(`${label} copied.`)
  }

  return <section className="gtm-config-walkthrough" aria-labelledby="gtm-config-heading">
    <header className="gtm-config-header">
      <div>
        <span>Part 7 · GTM configuration walkthrough</span>
        <h2 id="gtm-config-heading">Configure <code>{configuration.eventName}</code> in GTM</h2>
        <p>Your generated website event is ready. Follow this map to turn it into a GA4 event tag without rewriting the code.</p>
      </div>
      <div className="gtm-config-progress" aria-label={`${completedSteps.size} of 10 GTM steps complete`}>
        <strong>{completedSteps.size}<small>/10</small></strong>
        <span>complete</span>
      </div>
    </header>

    {!validation.safe && <div className="gtm-config-warning" role="alert"><strong>Return to the builder before using this walkthrough.</strong><span>Resolve every validation and personal-information warning so GTM only receives safe parameters.</span><button type="button" onClick={onBack}>Review event</button></div>}

    <div className="gtm-config-flow" aria-label="Event configuration flow">
      {AREA_ORDER.map((area, index) => <div className={index === 0 || configuration.steps[activeStepIndex].area === area ? 'is-current' : ''} key={area}><span>{index + 1}</span><strong>{area}</strong>{index < AREA_ORDER.length - 1 && <i aria-hidden="true">→</i>}</div>)}
    </div>

    <section className="gtm-parameter-map" aria-labelledby="gtm-parameter-map-heading">
      <div className="gtm-config-section-heading"><div><span>One value, three places</span><h3 id="gtm-parameter-map-heading">Parameter map</h3></div><p>Names must match exactly from the website data layer through GTM and into GA4.</p></div>
      <div className="gtm-parameter-table-wrap">
        <table>
          <thead><tr><th>Website event</th><th>GTM variable or trigger</th><th>GA4 field</th></tr></thead>
          <tbody>{configuration.mapping.map((row) => <tr key={row.source}><td><code>{row.source}</code></td><td><span aria-hidden="true">→</span><code>{row.gtmVariable}</code></td><td><span aria-hidden="true">→</span><code>{row.ga4Parameter}</code></td></tr>)}</tbody>
        </table>
      </div>
      <p className="gtm-config-tip"><strong>Do not mix up the IDs:</strong> <code>GTM-…</code> installs the container on the website; <code>G-…</code> identifies the GA4 web data stream used by your Google tag.</p>
    </section>

    <section className="gtm-config-steps" aria-labelledby="gtm-config-steps-heading">
      <div className="gtm-config-section-heading"><div><span>Click path + exact values</span><h3 id="gtm-config-steps-heading">10 steps in Google Tag Manager</h3></div><p>Select a step to see why it exists and what to enter.</p></div>
      <div className="gtm-config-step-progress"><i><b style={{ width: `${progress}%` }} /></i><span>{progress}%</span></div>
      <ol>
        {configuration.steps.map((step, index) => {
          const open = step.id === activeStepId
          const complete = completedSteps.has(step.id)
          return <li className={`${open ? 'is-open' : ''} ${complete ? 'is-complete' : ''}`} key={step.id}>
            <button className="gtm-config-step-toggle" type="button" aria-expanded={open} onClick={() => setActiveStepId(step.id)}>
              <span>{complete ? '✓' : String(index + 1).padStart(2, '0')}</span>
              <div><small>{step.area}</small><strong>{step.title}</strong></div>
              <i aria-hidden="true">{open ? '−' : '+'}</i>
            </button>
            {open && <div className="gtm-config-step-detail">
              <div className="gtm-config-click-path"><span>Click path</span><strong>{step.path}</strong></div>
              <p>{step.instruction}</p>
              <div className="gtm-config-value"><span>{step.valueLabel}</span><code>{step.value}</code><button type="button" onClick={() => copyValue(step.value, step.valueLabel)}>Copy</button></div>
              <button className="gtm-config-complete" type="button" onClick={() => toggleStep(step.id)}>{complete ? 'Mark incomplete' : 'Mark complete'}</button>
            </div>}
          </li>
        })}
      </ol>
    </section>

    <footer className="gtm-config-footer">
      <div><strong>{completedSteps.size === 10 ? 'Walkthrough complete' : 'Progress stays in this browser window'}</strong><span>{completedSteps.size === 10 ? 'Use Preview and Tag Assistant before publishing.' : 'Your generated values update automatically when you edit the event.'}</span></div>
      <nav aria-label="Official Google Tag Manager help"><a href="https://support.google.com/tagmanager/answer/7683362?hl=en-GB" target="_blank" rel="noreferrer">Data Layer Variables ↗</a><a href="https://support.google.com/tagmanager/answer/7679219?hl=en" target="_blank" rel="noreferrer">Custom Event triggers ↗</a><a href="https://support.google.com/tagmanager/answer/13034206?hl=en" target="_blank" rel="noreferrer">GA4 Event tags ↗</a></nav>
      {copyNotice && <p role="status">{copyNotice}</p>}
    </footer>
  </section>
}

export default GtmConfigurationWalkthrough
