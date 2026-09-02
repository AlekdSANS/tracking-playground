import { useState } from 'react'
import { isValidGtmContainerId } from '../utils/tagLab'

const guides = [
  { id: 'setup', label: 'Set up', title: 'Start with a disposable practice project', text: 'Use a GTM container created only for learning. Enter its public ID to label the local workspace; this phase does not contact Google.' },
  { id: 'files', label: 'Files', title: 'Learn through editable examples', text: 'The workspace starts with container, event, test, and guide files. Create, import, validate, edit, and download JSON or Markdown without server storage.' },
  { id: 'runner', label: 'Runner', title: 'Simulate dataLayer events offline', text: 'Valid event JSON runs inside an opaque-origin iframe whose Content Security Policy disables every network connection.' },
  { id: 'safety', label: 'Safety', title: 'Keep real data and code outside', text: 'Raw scripts, unsafe file names, dangerous JSON keys, oversized files, and likely personal or secret data are blocked or flagged. Live GTM stays off until a separate, temporary opt-in.' },
]

function TagLabPage() {
  const [containerId, setContainerId] = useState('')
  const [activeGuideId, setActiveGuideId] = useState('setup')
  const [feedback, setFeedback] = useState('')
  const normalizedId = containerId.trim().toUpperCase()
  const valid = isValidGtmContainerId(normalizedId)
  const guide = guides.find((item) => item.id === activeGuideId) || guides[0]

  function openWorkspace(event) {
    event.preventDefault()
    if (!valid) return setFeedback('Enter a container ID like GTM-ABC1234. Raw tags and scripts are rejected.')
    window.open(`/tag-workspace#container=${encodeURIComponent(normalizedId)}`, 'tag-workspace', 'popup,noopener,noreferrer')
    setFeedback('Secure offline workspace requested. Live GTM remains off.')
  }

  return (
    <section className="tag-lab-page">
      <div className="tag-lab-intro">
        <div><p className="eyebrow">Security-first learning lab</p><h1>GTM + GA4 workspace launcher</h1><p>Open a disposable project, edit realistic dataLayer files, and test events without loading a live container.</p></div>
        <div className="lab-safety-note"><span aria-hidden="true">◉</span><div><strong>Offline first</strong><p>Your ID labels the project. No Google script loads in this phase.</p></div></div>
      </div>
      <div className="workspace-launch-layout">
        <form className="tag-lab-setup" onSubmit={openWorkspace}>
          <div className="lab-panel-heading"><span>01</span><div><p>Connect the sandbox</p><h2>Add a practice container</h2></div></div>
          <label className="field">GTM container ID<input value={containerId} onChange={(event) => { setContainerId(event.target.value.toUpperCase()); setFeedback('') }} placeholder="GTM-ABC1234" maxLength="28" autoComplete="off" aria-invalid={Boolean(normalizedId) && !valid} /></label>
          <p className={`lab-field-help${normalizedId && !valid ? ' is-error' : ''}`}>{valid ? 'Valid ID. Your offline workspace is ready.' : normalizedId ? 'Use only an ID like GTM-ABC1234. Raw tags and scripts are rejected.' : 'Use a practice container you own. Its ID stays in this window only.'}</p>
          <button className="primary-button" type="submit" disabled={!valid}>Open secure workspace</button>
          <p className="form-status muted" aria-live="polite">{feedback}</p>
        </form>
        <section className="workspace-launch-preview" aria-label="Workspace security phases">
          <p className="eyebrow">Incremental rollout</p><h2>Prove the safe path first</h2>
          <div>{[['01','Virtual workspace','Create and edit local files','Ready'],['02','Strict validation','Reject unsafe names and JSON','Ready'],['03','Isolated simulator','Run events with no network','Ready'],['04','Live GTM','Explicit restricted 10-minute session','Opt-in']].map(([number,title,text,status]) => <article className={status === 'Ready' ? 'is-ready' : 'is-locked'} key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div><b>{status}</b></article>)}</div>
        </section>
      </div>
      <section className="tag-guide" aria-labelledby="tag-guide-heading">
        <div className="tag-guide-heading"><div><p className="eyebrow">Learn while you build</p><h2 id="tag-guide-heading">Secure workspace field guide</h2></div><p>The guide follows the same four boundaries as the workspace.</p></div>
        <div className="tag-guide-card"><div className="tag-guide-tabs" role="tablist" aria-label="Workspace guide topics">{guides.map((item, index) => <button type="button" role="tab" aria-selected={item.id === activeGuideId} className={item.id === activeGuideId ? 'is-active' : ''} onClick={() => setActiveGuideId(item.id)} key={item.id}><span>{String(index + 1).padStart(2,'0')}</span>{item.label}</button>)}</div><article className="tag-guide-content" role="tabpanel"><p className="eyebrow">{guide.label}</p><h3>{guide.title}</h3><p>{guide.text}</p></article></div>
      </section>
    </section>
  )
}

export default TagLabPage
