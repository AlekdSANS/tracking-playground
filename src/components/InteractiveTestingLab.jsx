import { useMemo, useRef, useState } from 'react'
import { createInteractiveScenarios, isValidDeployedUrl, simulateGtmPipeline } from '../utils/interactiveTesting'

const REAL_TESTING_STEPS = [
  { id: 'preview', title: 'Click Preview in GTM', detail: 'Open the GTM Workspace and select Preview in the top-right. Tag Assistant opens in a new tab.' },
  { id: 'connect', title: 'Enter the deployed website URL', detail: 'Paste the public https:// address—not localhost—then select Connect.' },
  { id: 'action', title: 'Perform the action', detail: 'On the connected website, click the button, submit the form, or finish the test purchase.' },
  { id: 'event', title: 'Select the event in Tag Assistant', detail: 'Return to Tag Assistant and select the event name from the event timeline.' },
  { id: 'fired', title: 'Confirm the expected tag fired', detail: 'Open Tags Fired and confirm the matching GA4 Event tag appears there, not under Tags Not Fired.' },
  { id: 'debugview', title: 'Check GA4 DebugView', detail: 'In GA4, open Admin → Data display → DebugView and confirm the event and its parameters arrived.' },
  { id: 'publish', title: 'Publish only after verification', detail: 'Once every check passes, return to GTM and select Submit → Publish and Create Version → Publish.' },
]

function InteractiveTestingLab({ draft, measurementId = '', initialUrl = '' }) {
  const scenarios = useMemo(() => createInteractiveScenarios(draft), [draft])
  const runCounter = useRef(0)
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios.find((scenario) => scenario.isGeneratedEvent)?.id || 'form')
  const [result, setResult] = useState(null)
  const [runs, setRuns] = useState([])
  const [completedSteps, setCompletedSteps] = useState(() => new Set())
  const [deployedUrl, setDeployedUrl] = useState(initialUrl)
  const [urlTouched, setUrlTouched] = useState(false)
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId) || scenarios[0]
  const readyToPublish = REAL_TESTING_STEPS.slice(0, 6).every((step) => completedSteps.has(step.id))

  function runScenario(scenarioId) {
    const scenario = scenarios.find((item) => item.id === scenarioId)
    if (!scenario) return
    runCounter.current += 1
    const pipeline = simulateGtmPipeline(scenario.payload, measurementId)
    const run = { id: `practice-${runCounter.current}`, scenario, pipeline }
    setSelectedScenarioId(scenarioId)
    setResult(run)
    setRuns((current) => [run, ...current].slice(0, 5))
  }

  function toggleRealStep(stepId) {
    if (stepId === 'connect') {
      setUrlTouched(true)
      if (!isValidDeployedUrl(deployedUrl)) return
    }
    if (stepId === 'publish' && !readyToPublish) return
    setCompletedSteps((current) => {
      const next = new Set(current)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
  }

  return <section className="interactive-testing-lab" aria-labelledby="interactive-testing-heading">
    <header className="interactive-testing-header">
      <div><span>Part 8 · Interactive testing</span><h2 id="interactive-testing-heading">Watch an event travel from website to GA4</h2><p>Nothing is sent to Google. This practice site shows what each tool would receive, using safe synthetic values.</p></div>
      <div className="interactive-testing-status"><i aria-hidden="true" /><span>Offline simulator</span><strong>0 network requests</strong></div>
    </header>

    <div className="testing-scenario-tabs" role="tablist" aria-label="Fake website actions">
      {scenarios.map((scenario) => <button type="button" role="tab" aria-selected={selectedScenario.id === scenario.id} className={selectedScenario.id === scenario.id ? 'is-active' : ''} onClick={() => setSelectedScenarioId(scenario.id)} key={scenario.id}><span>{scenario.id === 'button' ? '↗' : scenario.id === 'form' ? '≡' : '◆'}</span><div><strong>{scenario.label}</strong><small>{scenario.event}</small></div>{scenario.isGeneratedEvent && <b>Your event</b>}</button>)}
    </div>

    <div className="testing-simulator-grid">
      <section className="fake-site-shell" aria-label="Fake practice website">
        <div className="fake-browser-bar"><i /><i /><i /><span>https://practice.example/test</span><b>FAKE SITE</b></div>
        <div className="fake-site-content">
          <div className="fake-site-brand"><span>northstar/</span><small>Analytics practice shop</small></div>
          {selectedScenario.id === 'button' && <div className="fake-site-action"><span>BUTTON DEMO</span><h3>Turn curiosity into a measurable action.</h3><p>This button emits its tracking event only after the simulated action succeeds.</p><button type="button" onClick={() => runScenario('button')}>Click demo button</button></div>}
          {selectedScenario.id === 'form' && <form className="fake-site-action fake-form" onSubmit={(event) => { event.preventDefault(); runScenario('form') }}><span>FORM DEMO</span><h3>Request a product walkthrough.</h3><label>Interest<select defaultValue="analytics"><option value="analytics">Analytics setup</option><option value="reporting">Reporting</option></select></label><label>Team size<select defaultValue="small"><option value="small">1–10</option><option value="medium">11–50</option></select></label><button type="submit">Submit fake form</button><small>No name or email is collected or added to analytics.</small></form>}
          {selectedScenario.id === 'purchase' && <div className="fake-site-action fake-purchase"><span>PURCHASE DEMO</span><h3>Analytics starter kit</h3><div><p>Practice product · Quantity 1</p><strong>50 PLN</strong></div><button type="button" onClick={() => runScenario('purchase')}>Complete fake purchase</button><small>No payment is processed. The transaction ID is synthetic.</small></div>}
        </div>
      </section>

      <section className="testing-pipeline" aria-label="Simulated analytics pipeline">
        <div className="testing-pipeline-heading"><div><span>Latest result</span><strong>{result ? result.scenario.label : 'Waiting for an action'}</strong></div>{result && <b>Matched</b>}</div>
        {!result ? <div className="testing-pipeline-empty"><span aria-hidden="true">◎</span><strong>Use the fake website</strong><p>The data layer, trigger, and GA4 output will appear here.</p></div> : <div className="testing-pipeline-results" aria-live="polite">
          <article><header><span>01</span><div><small>Website</small><strong>dataLayer.push()</strong></div></header><pre><code>{result.pipeline.dataLayerPush}</code></pre></article>
          <i aria-hidden="true">↓</i>
          <article className="is-match"><header><span>02</span><div><small>GTM</small><strong>Trigger matched</strong></div><b>YES</b></header><dl><div><dt>Trigger</dt><dd>{result.pipeline.trigger.name}</dd></div><div><dt>Condition</dt><dd>{result.pipeline.trigger.condition}</dd></div><div><dt>Tag fired</dt><dd>{result.pipeline.tag}</dd></div></dl></article>
          <i aria-hidden="true">↓</i>
          <article><header><span>03</span><div><small>Google Analytics</small><strong>GA4 payload produced</strong></div></header><pre><code>{JSON.stringify(result.pipeline.ga4Payload, null, 2)}</code></pre></article>
        </div>}
      </section>
    </div>

    {runs.length > 0 && <div className="testing-run-history"><strong>Practice history</strong><ol>{runs.map((run) => <li key={run.id}><span>{run.id}</span><code>{run.pipeline.eventName}</code><b>{run.pipeline.trigger.name} matched</b></li>)}</ol></div>}

    <section className="real-testing-checklist" aria-labelledby="real-testing-heading">
      <header><div><span>Move from simulation to your real site</span><h3 id="real-testing-heading">Test with Tag Assistant before publishing</h3><p>Preview runs the current unpublished workspace against your deployed website so you can inspect fired tags safely.</p></div><div aria-label={`${completedSteps.size} of 7 real testing steps complete`}><strong>{completedSteps.size}/7</strong><i><b style={{ width: `${completedSteps.size / 7 * 100}%` }} /></i></div></header>
      <ol>{REAL_TESTING_STEPS.map((step, index) => {
        const complete = completedSteps.has(step.id)
        const publishLocked = step.id === 'publish' && !readyToPublish
        return <li className={`${complete ? 'is-complete' : ''} ${publishLocked ? 'is-locked' : ''}`} key={step.id}><span>{complete ? '✓' : index + 1}</span><div><strong>{step.title}</strong><p>{step.detail}</p>{step.id === 'connect' && <label><span>Deployed website URL</span><input type="url" value={deployedUrl} onChange={(event) => { setDeployedUrl(event.target.value); setUrlTouched(true) }} placeholder="https://your-project.vercel.app/" />{urlTouched && !isValidDeployedUrl(deployedUrl) && <small>Enter a public https:// URL. Do not use localhost.</small>}</label>}{publishLocked && <small>Complete the six verification checks before publishing.</small>}</div><button type="button" onClick={() => toggleRealStep(step.id)} disabled={publishLocked}>{complete ? 'Undo' : 'Mark complete'}</button></li>
      })}</ol>
      <footer><div><strong>{completedSteps.size === 7 ? 'Verified and ready to publish' : 'Publishing remains locked until verification is complete'}</strong><span>In GTM, publishing is Submit → Publish and Create Version → Publish.</span></div><nav aria-label="Official Google testing documentation"><a href="https://support.google.com/tagmanager/answer/6107056?hl=en" target="_blank" rel="noreferrer">Preview and debug ↗</a><a href="https://support.google.com/tagmanager/answer/6107163?hl=en" target="_blank" rel="noreferrer">Publishing containers ↗</a></nav></footer>
    </section>
  </section>
}

export default InteractiveTestingLab
