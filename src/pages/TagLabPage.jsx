import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { canAccessGtmLab, getLocalDevUser } from '../utils/gtmAccess'
import { isValidGtmContainerId } from '../utils/tagLab'

const localDevUser = getLocalDevUser()

const guides = [
  { id: 'setup', label: 'Set up', title: 'Start with a disposable practice project', text: 'Use a GTM container created only for learning. Enter its public ID to label the local workspace; this phase does not contact Google.' },
  { id: 'files', label: 'Files', title: 'Learn through editable examples', text: 'The workspace starts with container, event, test, and guide files. Create, import, validate, edit, and download JSON or Markdown without server storage.' },
  { id: 'runner', label: 'Runner', title: 'Simulate dataLayer events offline', text: 'Valid event JSON runs inside an opaque-origin iframe whose Content Security Policy disables every network connection.' },
  { id: 'safety', label: 'Safety', title: 'Keep real data and code outside', text: 'Raw scripts, unsafe file names, dangerous JSON keys, oversized files, and likely personal or secret data are blocked or flagged. Live GTM stays off until a separate, temporary opt-in.' },
]

function TagLabPage() {
  const { authReady = false, user = null } = useOutletContext() || {}
  const [containerId, setContainerId] = useState('')
  const [activeGuideId, setActiveGuideId] = useState('setup')
  const [feedback, setFeedback] = useState('')
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false)
  const normalizedId = containerId.trim().toUpperCase()
  const valid = isValidGtmContainerId(normalizedId)
  const guide = guides.find((item) => item.id === activeGuideId) || guides[0]
  const isLocalDevelopment = Boolean(localDevUser)
  const hasAccess = authReady && canAccessGtmLab(user)

  useEffect(() => {
    document.documentElement.classList.toggle('gtm-setup-guide-open', isSetupGuideOpen)

    function closeOnEscape(event) {
      if (event.key === 'Escape') setIsSetupGuideOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.documentElement.classList.remove('gtm-setup-guide-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isSetupGuideOpen])

  const accessMessage = isLocalDevelopment
    ? 'Local mode is ready. No database or sign-in is required.'
    : !authReady
    ? 'Checking your account access…'
    : !user
      ? 'Sign in with the verified administrator account to launch the workspace.'
      : !user.email_verified
        ? 'Verify the administrator email before launching the workspace.'
        : Number(user.admin_status) !== 1
          ? 'You can explore this guide, but only the verified administrator can launch the workspace.'
          : 'Administrator access confirmed. Enter a valid container ID to continue.'

  function openWorkspace(event) {
    event.preventDefault()
    if (!valid) return setFeedback('Enter a container ID like GTM-ABC1234. Raw tags and scripts are rejected.')
    if (isLocalDevelopment) {
      window.location.assign(`/tag-workspace#container=${encodeURIComponent(normalizedId)}`)
      return
    }
    window.open(`/tag-workspace#container=${encodeURIComponent(normalizedId)}`, 'tag-workspace', 'popup,noopener,noreferrer')
    setFeedback('Secure offline workspace requested. Live GTM remains off.')
  }

  return (
    <section className="tag-lab-page">
      <div className="tag-lab-intro">
        <div><h1>GTM + GA4 workspace launcher</h1><p>Open a disposable project, edit realistic dataLayer files, and test events without loading a live container.</p></div>
        <div className="lab-safety-note"><span aria-hidden="true">◉</span><div><strong>Offline first</strong><p>Your ID labels the project. No Google script loads in this phase.</p></div></div>
      </div>
      <div className="workspace-launch-layout">
        <form className="tag-lab-setup" onSubmit={openWorkspace}>
          <div className="lab-setup-title-row">
            <div className="lab-setup-kicker"><span>01</span><p>Connect the sandbox</p></div>
            <button className="gtm-guide-trigger" type="button" aria-expanded={isSetupGuideOpen} aria-controls="gtm-setup-guide" onClick={() => setIsSetupGuideOpen(true)}><span aria-hidden="true">?</span>How to get an ID</button>
          </div>
          <h2 className="lab-setup-heading">Add a practice container</h2>
          <label className="field">GTM container ID<input value={containerId} onChange={(event) => { setContainerId(event.target.value.toUpperCase()); setFeedback('') }} placeholder="GTM-ABC1234" maxLength="28" autoComplete="off" aria-invalid={Boolean(normalizedId) && !valid} /></label>
          <p className={`lab-field-help${normalizedId && !valid ? ' is-error' : ''}`}>{valid ? 'Valid ID. Your offline workspace is ready.' : normalizedId ? 'Use only an ID like GTM-ABC1234. Raw tags and scripts are rejected.' : 'Use a practice container you own. Its ID stays in this window only.'}</p>
          <div className="lab-access-note"><span aria-hidden="true">i</span><p aria-live="polite">{accessMessage}</p></div>
          <div className="tag-lab-setup-actions">
            {isLocalDevelopment || !authReady || user ? null : <Link className="secondary-button" to="/login?access=verified-admin&next=%2Ftag-lab">Sign in to unlock</Link>}
            <button className="primary-button" type="submit" disabled={!valid || !hasAccess}>{isLocalDevelopment ? 'Open local workspace' : 'Open secure workspace'}</button>
          </div>
          {feedback && <p className="lab-submit-feedback" aria-live="polite">{feedback}</p>}
        </form>
        <section className="workspace-launch-preview" aria-label="Workspace security phases">
          <h2>Prove the safe path first</h2>
          <div>{[['01','Virtual workspace','Create and edit local files','Ready'],['02','Strict validation','Reject unsafe names and JSON','Ready'],['03','Isolated simulator','Run events with no network','Ready'],['04','Live GTM','Explicit restricted 10-minute session','Opt-in']].map(([number,title,text,status]) => <article className={status === 'Ready' ? 'is-ready' : 'is-locked'} key={number}><span>{number}</span><div><strong>{title}</strong><p>{text}</p></div><b>{status}</b></article>)}</div>
        </section>
      </div>
      <section className="tag-guide" aria-labelledby="tag-guide-heading">
        <div className="tag-guide-heading"><div><h2 id="tag-guide-heading">Secure workspace field guide</h2></div><p>The guide follows the same four boundaries as the workspace.</p></div>
        <div className="tag-guide-card"><div className="tag-guide-tabs" role="tablist" aria-label="Workspace guide topics">{guides.map((item, index) => <button type="button" role="tab" aria-selected={item.id === activeGuideId} className={item.id === activeGuideId ? 'is-active' : ''} onClick={() => setActiveGuideId(item.id)} key={item.id}><span>{String(index + 1).padStart(2,'0')}</span>{item.label}</button>)}</div><article className="tag-guide-content" role="tabpanel"><h3>{guide.title}</h3><p>{guide.text}</p></article></div>
      </section>
      {isSetupGuideOpen && <button className="gtm-guide-backdrop" type="button" aria-label="Close GTM setup guide" onClick={() => setIsSetupGuideOpen(false)} />}
      <aside id="gtm-setup-guide" className={`gtm-setup-guide${isSetupGuideOpen ? ' is-open' : ''}`} aria-label="How to create a Google Tag Manager container" aria-hidden={!isSetupGuideOpen} inert={!isSetupGuideOpen}>
        <header className="gtm-guide-header">
          <div><span>GTM setup guide</span><h2>Create a GTM container</h2></div>
          <button type="button" aria-label="Close GTM setup guide" onClick={() => setIsSetupGuideOpen(false)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>
        </header>
        <div className="gtm-guide-scroll">
          <section className="gtm-guide-explainer">
            <span aria-hidden="true">◎</span>
            <div><h3>What is a GTM container?</h3><p>It is a workspace that holds your tags, triggers, and variables for one website or app. The container itself is not Google Analytics; it controls when measurement and marketing tags are allowed to run.</p></div>
          </section>
          <div className="gtm-guide-callout"><strong>For this playground</strong><p>Create a separate practice container and leave it unpublished. In the offline phase, the ID only names your local project—no Google container is loaded.</p></div>
          <section className="gtm-guide-steps" aria-labelledby="gtm-create-steps">
            <div className="gtm-guide-section-heading"><span>Step by step</span><h3 id="gtm-create-steps">Create a Web container</h3></div>
            <ol>
              <li><span>1</span><div><h4>Open Google Tag Manager</h4><p>Go to <a href="https://tagmanager.google.com/" target="_blank" rel="noreferrer">tagmanager.google.com</a> and sign in with your Google account.</p><div className="gtm-guide-image-slot"><b>Image placeholder</b><small>Accounts screen</small></div></div></li>
              <li><span>2</span><div><h4>Create an account</h4><p>Open the <strong>Accounts</strong> tab, choose <strong>Create account</strong>, then enter an account name and select your country.</p></div></li>
              <li><span>3</span><div><h4>Set up the container</h4><p>Use a recognizable practice name, such as <strong>Tracking Playground</strong>. Under Target platform, select <strong>Web</strong>.</p><div className="gtm-guide-image-slot"><b>Image placeholder</b><small>Account and container setup</small></div></div></li>
              <li><span>4</span><div><h4>Create and accept the terms</h4><p>Select <strong>Create</strong>, review the terms, choose your language, and accept them. Google will then show installation snippets; you can close that window for this offline exercise.</p></div></li>
              <li><span>5</span><div><h4>Copy the container ID</h4><p>Find the public ID near the top of the workspace. It starts with <strong>GTM-</strong>, for example <strong>GTM-ABC1234</strong>.</p><div className="gtm-guide-image-slot"><b>Image placeholder</b><small>Container ID location</small></div></div></li>
              <li><span>6</span><div><h4>Return and paste it here</h4><p>Close this guide, paste the ID into the field, and open the secure workspace. Do not paste either installation script.</p></div></li>
            </ol>
          </section>
          <div className="gtm-guide-next"><strong>Later, on a real website</strong><p>A developer installs the container snippets, then you add and preview tags before publishing a version. This lab deliberately keeps that live step off.</p></div>
          <a className="gtm-guide-official-link" href="https://support.google.com/tagmanager/answer/14842164?hl=en" target="_blank" rel="noreferrer">Read Google’s official setup guide <span aria-hidden="true">↗</span></a>
        </div>
      </aside>
    </section>
  )
}

export default TagLabPage
