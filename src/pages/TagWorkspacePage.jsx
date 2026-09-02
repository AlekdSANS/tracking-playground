import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  WORKSPACE_MAX_FILES,
  createStarterWorkspace,
  isValidWorkspaceFileName,
  readWorkspaceContainerId,
  validateWorkspaceFile,
} from '../utils/tagWorkspace'

const CORE_FILES = new Set(['README.md', 'container.json'])
const RUNNER_DOCUMENT = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"><style>body{margin:0;background:#101116;color:#eef0f5;font:12px ui-monospace,monospace}.box{margin:10px;padding:14px;border:1px solid #343741;border-radius:10px}.dot{color:#b6ff67}</style></head><body><div class="box"><span class="dot">●</span> Isolated runtime ready · network disabled</div><script>(()=>{let port;addEventListener('message',e=>{if(e.data?.type!=='workspace:connect'||!e.ports[0])return;port=e.ports[0];port.onmessage=m=>{if(m.data?.type!=='workspace:run')return;const payload=m.data.payload;if(!payload||typeof payload!=='object'||typeof payload.event!=='string')return;self.dataLayer=self.dataLayer||[];self.dataLayer.push(payload);port.postMessage({type:'workspace:result',nonce:m.data.nonce,payload,count:self.dataLayer.length})};port.start();port.postMessage({type:'workspace:ready',nonce:e.data.nonce})},{once:true})})()</script></body></html>`

const guideForFile = (name) => {
  if (name.startsWith('events/')) return ['Keep the event name GA4-compatible.', 'Use synthetic values only.', 'Validate, then run the event offline.']
  if (name === 'container.json') return ['This is a safe practice model, not a GTM import.', 'The public ID labels your workspace.', 'Live container loading remains locked.']
  if (name.startsWith('tests/')) return ['List the events you expect.', 'Compare them with runner output.', 'No file leaves this browser window.']
  return ['Choose an event file to simulate it.', 'Create JSON or Markdown files only.', 'Download anything you want to keep.']
}

function TagWorkspacePage() {
  const location = useLocation()
  const containerId = readWorkspaceContainerId(location.hash)
  const iframeRef = useRef(null)
  const runnerPortRef = useRef(null)
  const nonceRef = useRef(`workspace-runner:${containerId}`)
  const [files, setFiles] = useState(() => containerId ? createStarterWorkspace(containerId) : {})
  const [selectedFile, setSelectedFile] = useState('events/page_view.json')
  const [runnerReady, setRunnerReady] = useState(false)
  const [output, setOutput] = useState([])
  const [notice, setNotice] = useState('')
  const content = files[selectedFile] || ''
  const validation = useMemo(() => selectedFile ? validateWorkspaceFile(selectedFile, content) : { valid: false, errors: [], warnings: [] }, [content, selectedFile])

  useEffect(() => () => runnerPortRef.current?.close(), [])

  function connectRunner() {
    if (!iframeRef.current?.contentWindow || runnerPortRef.current || typeof MessageChannel === 'undefined') return
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      if (event.data?.nonce !== nonceRef.current) return
      if (event.data.type === 'workspace:ready') setRunnerReady(true)
      if (event.data.type === 'workspace:result') {
        setOutput((items) => [{ payload: event.data.payload, count: event.data.count }, ...items].slice(0, 20))
      }
    }
    channel.port1.start()
    runnerPortRef.current = channel.port1
    iframeRef.current.contentWindow.postMessage({ type: 'workspace:connect', nonce: nonceRef.current }, '*', [channel.port2])
  }

  function createFile() {
    if (Object.keys(files).length >= WORKSPACE_MAX_FILES) return setNotice('The workspace is limited to 40 files.')
    const requested = window.prompt('New file name (.json or .md)', 'events/custom_event.json')
    if (!requested) return
    const name = requested.trim()
    if (!isValidWorkspaceFileName(name) || files[name]) return setNotice('Use a unique, safe .json or .md file name.')
    const next = name.endsWith('.json') ? '{\n  "event": "custom_event",\n  "debug_mode": true\n}' : '# Practice notes\n'
    setFiles((current) => ({ ...current, [name]: next }))
    setSelectedFile(name)
    setNotice(`${name} created in memory.`)
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !isValidWorkspaceFileName(file.name) || file.size > 100_000) return setNotice('Import a safe .json or .md file under 100 KB.')
    if (Object.keys(files).length >= WORKSPACE_MAX_FILES && !files[file.name]) return setNotice('The workspace is limited to 40 files.')
    const imported = await file.text()
    setFiles((current) => ({ ...current, [file.name]: imported }))
    setSelectedFile(file.name)
    setNotice(`${file.name} imported locally.`)
  }

  function downloadFile() {
    const url = URL.createObjectURL(new Blob([content], { type: selectedFile.endsWith('.json') ? 'application/json' : 'text/markdown' }))
    const link = document.createElement('a')
    link.href = url
    link.download = selectedFile.split('/').pop()
    link.click()
    URL.revokeObjectURL(url)
  }

  function runEvent() {
    if (!selectedFile.startsWith('events/') || !validation.valid || validation.warnings.length || !runnerReady) return
    runnerPortRef.current?.postMessage({ type: 'workspace:run', nonce: nonceRef.current, payload: validation.value })
    setNotice(`${validation.value.event} ran inside the offline simulator.`)
  }

  if (!containerId) {
    return <main className="tag-workspace-locked"><div><span>Workspace locked</span><h1>A valid GTM container ID is required.</h1><p>Return to the lab and enter an ID such as GTM-ABC1234. Scripts and full container tags are rejected.</p><a href="/tag-lab">Back to Tag Lab</a></div></main>
  }

  return (
    <main className="tag-workspace-page">
      <header className="workspace-header"><div><p>Offline simulation · {containerId}</p><h1>DataLayer workspace</h1></div><div><span className="workspace-lock-badge">Live GTM locked</span><a href="/tag-lab">Exit workspace</a></div></header>
      <div className="workspace-security-strip"><strong>Network-disabled runner</strong><span>No Google scripts</span><span>No account access</span><span>No persistent storage</span></div>
      <div className="workspace-grid">
        <aside className="workspace-files" aria-label="Virtual project files">
          <div className="workspace-panel-title"><span>Files</span><button type="button" onClick={createFile}>＋</button></div>
          <div className="workspace-file-list">{Object.keys(files).map((name) => <button className={name === selectedFile ? 'is-active' : ''} type="button" onClick={() => setSelectedFile(name)} key={name}>{name}</button>)}</div>
          <label className="workspace-import">Import file<input type="file" accept=".json,.md,application/json,text/markdown" onChange={importFile} /></label>
        </aside>

        <section className="workspace-editor" aria-label="File editor">
          <div className="workspace-panel-title"><span>{selectedFile}</span><div><button type="button" onClick={downloadFile}>Download</button>{!CORE_FILES.has(selectedFile) && <button type="button" onClick={() => { const next = { ...files }; delete next[selectedFile]; setFiles(next); setSelectedFile('README.md') }}>Delete</button>}</div></div>
          <textarea aria-label={`Edit ${selectedFile}`} value={content} onChange={(event) => setFiles((current) => ({ ...current, [selectedFile]: event.target.value }))} spellCheck="false" />
          <div className={`workspace-validation ${validation.valid ? 'is-valid' : 'is-invalid'}`}><strong>{validation.valid ? 'Valid file' : 'Needs attention'}</strong>{validation.errors.map((item) => <span key={item}>{item}</span>)}{validation.warnings.map((item) => <span className="is-warning" key={item}>{item}</span>)}</div>
        </section>

        <aside className="workspace-guide"><p className="eyebrow">Context guide</p><h2>Working with {selectedFile.split('/').pop()}</h2><ol>{guideForFile(selectedFile).map((item) => <li key={item}>{item}</li>)}</ol><div className="workspace-live-lock"><strong>Why is Live GTM locked?</strong><p>The file model and isolated runner must prove their limits first. A future phase can add a separately consented network mode.</p></div></aside>

        <section className="workspace-runner"><div><p className="eyebrow">Isolated runner</p><h2>Offline dataLayer simulator</h2><p>{notice || 'Choose a valid event file. Warnings must be resolved before it can run.'}</p><button type="button" onClick={runEvent} disabled={!selectedFile.startsWith('events/') || !validation.valid || validation.warnings.length > 0 || !runnerReady}>Run selected event</button></div><iframe ref={iframeRef} title="Network-disabled dataLayer runtime" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={RUNNER_DOCUMENT} onLoad={connectRunner} /><div className="workspace-output"><strong>Runner output</strong>{output.length ? output.map((item, index) => <pre key={`${item.count}-${index}`}>{JSON.stringify(item.payload, null, 2)}</pre>) : <span>No events run yet.</span>}</div></section>
      </div>
      <footer className="workspace-footer"><button type="button" onClick={() => { setFiles(createStarterWorkspace(containerId)); setSelectedFile('events/page_view.json'); setOutput([]); setNotice('Workspace reset to safe starter files.') }}>Reset project</button><span>Everything is cleared when this window closes.</span></footer>
    </main>
  )
}

export default TagWorkspacePage
