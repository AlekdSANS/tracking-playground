import { useMemo, useState } from 'react'
import {
  EVENT_PARAMETER_TYPES,
  RECOMMENDED_EVENT_PRESETS,
  createEmptyParameter,
  createEventDraft,
  createEventOutputs,
  getPlacementGuidance,
  isRecommendedEvent,
  validateEventDraft,
} from '../utils/eventBuilder'

const OUTPUT_TABS = [
  ['dataLayer', 'Data object'],
  ['javascript', 'JavaScript'],
  ['react', 'React'],
  ['html', 'HTML'],
]

function NoCodeEventBuilder({ draft, onChange, onSave, onTest, onOpenWalkthrough }) {
  const [outputTab, setOutputTab] = useState('dataLayer')
  const [copyNotice, setCopyNotice] = useState('')
  const [hasGenerated, setHasGenerated] = useState(false)
  const validation = useMemo(() => validateEventDraft(draft), [draft])
  const outputs = useMemo(() => createEventOutputs(draft), [draft])
  const recommended = isRecommendedEvent(draft.eventName)

  function updateDraft(patch) {
    onChange((current) => ({ ...current, ...patch }))
    setCopyNotice('')
    setHasGenerated(false)
  }

  function updateParameter(id, patch) {
    onChange((current) => ({
      ...current,
      parameters: current.parameters.map((parameter) => parameter.id === id ? { ...parameter, ...patch } : parameter),
    }))
    setCopyNotice('')
    setHasGenerated(false)
  }

  function addParameter() {
    onChange((current) => current.parameters.length >= 12 ? current : {
      ...current,
      parameters: [...current.parameters, createEmptyParameter(current.parameters)],
    })
    setHasGenerated(false)
  }

  function removeParameter(id) {
    onChange((current) => ({ ...current, parameters: current.parameters.filter((parameter) => parameter.id !== id) }))
    setHasGenerated(false)
  }

  function applyPreset(presetId) {
    onChange(createEventDraft(presetId))
    setCopyNotice('')
    setHasGenerated(false)
  }

  async function copyOutput() {
    if (!validation.safe) return
    const value = outputs[outputTab]
    if (!navigator.clipboard?.writeText) {
      setCopyNotice('Clipboard is unavailable. Select the output and copy it manually.')
      return
    }
    await navigator.clipboard.writeText(value)
    setCopyNotice(`${OUTPUT_TABS.find(([id]) => id === outputTab)?.[1]} copied.`)
  }

  return <section className={`event-builder ${hasGenerated ? 'is-generated' : 'is-drafting'}`} aria-labelledby="event-builder-heading">
    <header className="event-builder-heading">
      <div><span>Event practice</span><h2 id="event-builder-heading">Create your event <span className="workspace-sr-only">— Describe the action. Get the implementation.</span></h2><p>Describe one action first. We’ll reveal the implementation and testing tools when it is ready.</p></div>
      <div className={`event-builder-status ${validation.safe ? 'is-safe' : 'is-review'}`}><i aria-hidden="true" />{validation.safe ? 'Checks passed' : `${validation.issues.length} to review`}</div>
    </header>

    <div className="event-builder-presets">
      <div><strong>Choose an event type</strong><span>Recommended GA4 events come with beginner-friendly defaults.</span></div>
      <div>{RECOMMENDED_EVENT_PRESETS.map((preset) => <button type="button" className={draft.eventName === preset.id ? 'is-active' : ''} onClick={() => applyPreset(preset.id)} key={preset.id}><strong>{preset.label}</strong><small>{preset.description}</small></button>)}<button type="button" className={!recommended ? 'is-active' : ''} onClick={() => applyPreset('custom')}><strong>Custom event</strong><small>Use a clear GA4-style name.</small></button></div>
    </div>

    <div className="event-builder-layout">
      <div className="event-builder-form">
        <div className="event-builder-primary-fields">
          <label htmlFor="builder-event-name"><span>Event name</span><input id="builder-event-name" value={draft.eventName} onChange={(event) => updateDraft({ eventName: event.target.value, presetId: 'custom' })} placeholder="generate_lead" spellCheck="false" /></label>
          <label htmlFor="builder-action"><span>When should it happen?</span><input id="builder-action" value={draft.action} onChange={(event) => updateDraft({ action: event.target.value })} placeholder="Contact form succeeds" /></label>
        </div>

        <div className="event-builder-parameters-heading"><div><strong>Parameters</strong><span>Extra details that help explain the event.</span></div><button type="button" onClick={addParameter} disabled={draft.parameters.length >= 12}>＋ Add parameter</button></div>
        <div className="event-builder-parameters">
          {draft.parameters.length === 0 && <div className="event-builder-no-parameters"><strong>No parameters yet</strong><span>The event name can work alone, or add useful non-personal context.</span></div>}
          {draft.parameters.map((parameter, index) => {
            const rowIssues = validation.issues.filter((issue) => issue.rowId === parameter.id)
            return <fieldset className={rowIssues.length ? 'has-issue' : ''} key={parameter.id}>
              <legend>Parameter {index + 1}</legend>
              <div className="event-parameter-grid">
                <label><span>Name</span><input aria-label={`Parameter ${index + 1} name`} value={parameter.name} onChange={(event) => updateParameter(parameter.id, { name: event.target.value })} placeholder="form_name" spellCheck="false" /></label>
                <label><span>Type</span><select aria-label={`Parameter ${index + 1} type`} value={parameter.type} onChange={(event) => updateParameter(parameter.id, { type: event.target.value })}>{EVENT_PARAMETER_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
                <label><span>Example value</span><input aria-label={`Parameter ${index + 1} example value`} value={parameter.value} onChange={(event) => updateParameter(parameter.id, { value: event.target.value })} placeholder={parameter.type === 'number' ? '50' : parameter.type === 'boolean' ? 'true' : 'contact'} spellCheck="false" /></label>
                <button type="button" aria-label={`Remove parameter ${index + 1}`} onClick={() => removeParameter(parameter.id)}>Remove</button>
              </div>
              <label className="event-parameter-personal"><input type="checkbox" checked={parameter.personal} onChange={(event) => updateParameter(parameter.id, { personal: event.target.checked })} /><span>This value could contain personal information</span></label>
              {rowIssues.length > 0 && <ul>{rowIssues.map((issue) => <li className={`is-${issue.type}`} key={`${issue.type}-${issue.message}`}>{issue.message}</li>)}</ul>}
            </fieldset>
          })}
        </div>

        {validation.issues.some((issue) => !issue.rowId) && <div className="event-builder-general-issues">{validation.issues.filter((issue) => !issue.rowId).map((issue) => <p key={issue.message}>{issue.message}</p>)}</div>}
        {validation.privacy.length > 0 && <div className="event-builder-privacy"><strong>Personal information blocked</strong><p>Affected parameters are excluded from every generated output. Remove them or use a safe category such as <code>lead_type: "demo"</code>.</p></div>}
        <div className="event-builder-generate">
          <button type="button" onClick={() => setHasGenerated(true)} disabled={!validation.safe}>Generate implementation <span aria-hidden="true">→</span></button>
          {!validation.safe && <small>Resolve every validation and privacy warning to continue.</small>}
        </div>
      </div>

      <details className="event-builder-output-shell" open={hasGenerated}>
        <summary className="workspace-sr-only">Generated implementation</summary>
      <div className="event-builder-output">
        <div className="event-output-tabs" role="tablist" aria-label="Generated event formats">{OUTPUT_TABS.map(([id, label]) => <button type="button" role="tab" aria-selected={outputTab === id} className={outputTab === id ? 'is-active' : ''} onClick={() => { setOutputTab(id); setCopyNotice('') }} key={id}>{label}</button>)}</div>
        <div className="event-output-heading"><div><span>✓ Event configured</span><strong>Implementation · {OUTPUT_TABS.find(([id]) => id === outputTab)?.[1]}</strong></div>{recommended ? <b>Recommended</b> : <b className="is-custom">Custom</b>}</div>
        <pre aria-label={`${OUTPUT_TABS.find(([id]) => id === outputTab)?.[1]} output`}><code>{outputs[outputTab]}</code></pre>
        <div className="event-placement-guidance"><strong>Where does this code go?</strong><p>{getPlacementGuidance(draft.action)}</p></div>
        <div className="event-output-actions"><button type="button" onClick={copyOutput} disabled={!validation.safe}>Copy code</button><button type="button" onClick={() => onSave(outputs.payload)} disabled={!validation.safe}>Save and open in code editor</button></div>
        <button className="event-builder-test-next" type="button" onClick={onTest} disabled={!validation.safe}><strong>Test event</strong><i aria-hidden="true">→</i></button>
        <button className="event-builder-gtm-next" type="button" onClick={onOpenWalkthrough} disabled={!validation.safe}><strong>Configure this event in GTM</strong><i aria-hidden="true">→</i></button>
        {copyNotice && <p className="event-copy-notice" role="status">{copyNotice}</p>}
      </div>
      </details>
    </div>
  </section>
}

export default NoCodeEventBuilder
