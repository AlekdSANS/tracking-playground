import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import LiveGtmPanel from '../components/LiveGtmPanel'
import {
  WORKSPACE_MAX_FILES,
  createStarterWorkspace,
  createWorkspaceFileContent,
  formatWorkspaceJson,
  groupWorkspaceFiles,
  isValidWorkspaceFileName,
  readWorkspaceContainerId,
  validateWorkspaceFile,
} from '../utils/tagWorkspace'
import {
  GTM_GA4_FLOW,
  GUIDE_EXAMPLES,
  WORKSPACE_GLOSSARY,
  getGuideProgress,
  getWorkspaceGuideContext,
} from '../utils/tagWorkspaceGuide'
import { DISPOSABLE_RUNNER_DOCUMENT, RUNNER_TIMEOUT_MS } from '../utils/tagRunner'

const CORE_FILES = new Set(['README.md', 'container.json'])

function makeCopyName(fileName, files) {
  const dot = fileName.lastIndexOf('.')
  const base = fileName.slice(0, dot)
  const extension = fileName.slice(dot)
  let index = 1
  let candidate = `${base}.copy${extension}`
  while (files[candidate]) {
    index += 1
    candidate = `${base}.copy-${index}${extension}`
  }
  return candidate
}

function TagWorkspacePage() {
  const location = useLocation()
  const containerId = readWorkspaceContainerId(location.hash)
  const starterFiles = useMemo(() => containerId ? createStarterWorkspace(containerId) : {}, [containerId])
  const iframeRef = useRef(null)
  const editorRef = useRef(null)
  const lineNumbersRef = useRef(null)
  const runnerPortRef = useRef(null)
  const runCounterRef = useRef(0)
  const [files, setFiles] = useState(() => starterFiles)
  const [selectedFile, setSelectedFile] = useState('events/page_view.json')
  const [newFileName, setNewFileName] = useState('')
  const [isCreatingFile, setIsCreatingFile] = useState(false)
  const [guideTab, setGuideTab] = useState('context')
  const [cursor, setCursor] = useState({ line: 1, column: 1 })
  const [activeRun, setActiveRun] = useState(null)
  const [runnerStatus, setRunnerStatus] = useState('idle')
  const [output, setOutput] = useState([])
  const [notice, setNotice] = useState('')

  const content = files[selectedFile] || ''
  const validation = useMemo(() => selectedFile ? validateWorkspaceFile(selectedFile, content) : { valid: false, safeToRun: false, errors: [], warnings: [], issues: [], schemaName: 'Unknown file' }, [content, selectedFile])
  const groupedFiles = useMemo(() => groupWorkspaceFiles(Object.keys(files)), [files])
  const modifiedFiles = useMemo(() => new Set(Object.keys(files).filter((name) => starterFiles[name] !== files[name])), [files, starterFiles])
  const byteSize = useMemo(() => new Blob([content]).size, [content])
  const guideContext = useMemo(() => getWorkspaceGuideContext(selectedFile, validation), [selectedFile, validation])
  const guideProgress = useMemo(() => getGuideProgress({ selectedFile, validation, modified: modifiedFiles.has(selectedFile), output }), [modifiedFiles, output, selectedFile, validation])
  const completedGuideSteps = guideProgress.filter((step) => step.complete).length

  useEffect(() => () => runnerPortRef.current?.close(), [])

  useEffect(() => {
    if (!activeRun) return undefined
    const timeout = window.setTimeout(() => {
      runnerPortRef.current?.close()
      runnerPortRef.current = null
      setOutput((items) => [{ id: activeRun.id, status: 'timeout', payload: activeRun.payload, summary: null }, ...items].slice(0, 20))
      setActiveRun(null)
      setRunnerStatus('timeout')
      setNotice('The disposable runner timed out and was destroyed.')
    }, RUNNER_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [activeRun])

  function connectRunner() {
    if (!activeRun || !iframeRef.current?.contentWindow || runnerPortRef.current || typeof MessageChannel === 'undefined') return
    const channel = new MessageChannel()
    channel.port1.onmessage = (event) => {
      if (event.data?.runId !== activeRun.id) return
      if (event.data.type === 'runner:ready') {
        setRunnerStatus('running')
        channel.port1.postMessage({ type: 'runner:execute', runId: activeRun.id, payload: activeRun.payload })
      }
      if (event.data.type === 'runner:result') {
        setOutput((items) => [{ id: activeRun.id, status: 'complete', payload: event.data.payload, summary: event.data.summary }, ...items].slice(0, 20))
        channel.port1.close()
        runnerPortRef.current = null
        setActiveRun(null)
        setRunnerStatus('complete')
        setNotice(`${event.data.payload.event} completed. Its sandbox was destroyed.`)
      }
      if (event.data.type === 'runner:error') {
        setOutput((items) => [{ id: activeRun.id, status: 'error', payload: activeRun.payload, summary: null }, ...items].slice(0, 20))
        channel.port1.close()
        runnerPortRef.current = null
        setActiveRun(null)
        setRunnerStatus('error')
        setNotice('The isolated process rejected the payload and was destroyed.')
      }
    }
    channel.port1.start()
    runnerPortRef.current = channel.port1
    iframeRef.current.contentWindow.postMessage({ type: 'runner:connect', runId: activeRun.id }, '*', [channel.port2])
  }

  function selectFile(name) {
    setSelectedFile(name)
    setCursor({ line: 1, column: 1 })
    setNotice('')
  }

  function createFile(event) {
    event.preventDefault()
    const name = newFileName.trim()
    if (Object.keys(files).length >= WORKSPACE_MAX_FILES) return setNotice('The workspace is limited to 40 files.')
    if (!isValidWorkspaceFileName(name)) return setNotice('Use a safe path ending in .json or .md, such as events/signup.json.')
    if (files[name]) return setNotice('That file already exists.')
    setFiles((current) => ({ ...current, [name]: createWorkspaceFileContent(name) }))
    setSelectedFile(name)
    setNewFileName('')
    setIsCreatingFile(false)
    setNotice(`${name} created in memory.`)
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !isValidWorkspaceFileName(file.name) || file.size > 100_000) return setNotice('Import a safe .json or .md file under 100 KB.')
    if (Object.keys(files).length >= WORKSPACE_MAX_FILES && !files[file.name]) return setNotice('The workspace is limited to 40 files.')
    const imported = await file.text()
    setFiles((current) => ({ ...current, [file.name]: imported }))
    selectFile(file.name)
    setNotice(`${file.name} imported locally.`)
  }

  function updateCursor(target = editorRef.current) {
    if (!target) return
    const beforeCursor = target.value.slice(0, target.selectionStart)
    const lines = beforeCursor.split('\n')
    setCursor({ line: lines.length, column: lines.at(-1).length + 1 })
  }

  function handleEditorKeyDown(event) {
    if (event.key === 'Tab') {
      event.preventDefault()
      const { selectionStart, selectionEnd, value } = event.currentTarget
      const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`
      setFiles((current) => ({ ...current, [selectedFile]: next }))
      requestAnimationFrame(() => {
        editorRef.current?.setSelectionRange(selectionStart + 2, selectionStart + 2)
        updateCursor()
      })
    }
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      formatJson()
    }
  }

  function formatJson() {
    if (!selectedFile.endsWith('.json')) return
    const formatted = formatWorkspaceJson(content)
    if (formatted.error) return setNotice(formatted.error)
    setFiles((current) => ({ ...current, [selectedFile]: formatted.content }))
    setNotice(`${selectedFile} formatted.`)
  }

  async function copyContent() {
    if (!navigator.clipboard?.writeText) return setNotice('Clipboard access is unavailable. Select the editor text to copy it.')
    await navigator.clipboard.writeText(content)
    setNotice(`${selectedFile} copied.`)
  }

  function duplicateFile() {
    if (Object.keys(files).length >= WORKSPACE_MAX_FILES) return setNotice('The workspace is limited to 40 files.')
    const name = makeCopyName(selectedFile, files)
    setFiles((current) => ({ ...current, [name]: content }))
    selectFile(name)
    setNotice(`${name} created.`)
  }

  function addGuideExample(example) {
    const name = `events/example-${example.id}.json`
    if (!files[name] && Object.keys(files).length >= WORKSPACE_MAX_FILES) return setNotice('The workspace is limited to 40 files.')
    if (!files[name]) setFiles((current) => ({ ...current, [name]: `${JSON.stringify(example.payload, null, 2)}\n` }))
    selectFile(name)
    setGuideTab('context')
    setNotice(`${example.label} example added as ${name}.`)
  }

  function downloadFile() {
    const url = URL.createObjectURL(new Blob([content], { type: selectedFile.endsWith('.json') ? 'application/json' : 'text/markdown' }))
    const link = document.createElement('a')
    link.href = url
    link.download = selectedFile.split('/').pop()
    link.click()
    URL.revokeObjectURL(url)
  }

  function deleteFile() {
    const next = { ...files }
    delete next[selectedFile]
    setFiles(next)
    selectFile('README.md')
    setNotice('File removed from this in-memory session.')
  }

  function runEvent() {
    if (!selectedFile.startsWith('events/') || !validation.safeToRun || activeRun) return
    runCounterRef.current += 1
    const run = { id: `run-${runCounterRef.current}`, payload: JSON.parse(JSON.stringify(validation.value)) }
    setActiveRun(run)
    setRunnerStatus('booting')
    setNotice(`Creating a fresh sandbox for ${run.payload.event}…`)
  }

  function cancelRun() {
    if (!activeRun) return
    runnerPortRef.current?.close()
    runnerPortRef.current = null
    setOutput((items) => [{ id: activeRun.id, status: 'cancelled', payload: activeRun.payload, summary: null }, ...items].slice(0, 20))
    setActiveRun(null)
    setRunnerStatus('cancelled')
    setNotice('Run cancelled. The sandbox was destroyed.')
  }

  if (!containerId) {
    return <main className="tag-workspace-locked"><div><span>Workspace locked</span><h1>A valid GTM container ID is required.</h1><p>Return to the lab and enter an ID such as GTM-ABC1234. Scripts and full container tags are rejected.</p><a href="/tag-lab">Back to Tag Lab</a></div></main>
  }

  return (
    <main className="tag-workspace-page">
      <header className="workspace-header"><div><p>Offline-first practice · {containerId}</p><h1>DataLayer workspace</h1></div><div><span className="workspace-session-state"><i aria-hidden="true" />In memory · {modifiedFiles.size} changed</span><span className="workspace-lock-badge">Live GTM opt-in</span><a href="/tag-lab">Exit workspace</a></div></header>
      <div className="workspace-security-strip"><strong>Network-disabled runner</strong><span>No Google scripts</span><span>No account access</span><span>No persistent storage</span></div>

      <div className="workspace-grid">
        <aside className="workspace-files" aria-label="Virtual project files">
          <div className="workspace-panel-title"><span>Workspace <small>{Object.keys(files).length}/{WORKSPACE_MAX_FILES}</small></span><button type="button" aria-label="Create new file" onClick={() => setIsCreatingFile((open) => !open)}>＋</button></div>
          {isCreatingFile && <form className="workspace-new-file" onSubmit={createFile}><label htmlFor="workspace-file-name">New file path</label><input id="workspace-file-name" value={newFileName} onChange={(event) => setNewFileName(event.target.value)} placeholder="events/signup.json" autoFocus /><div><button type="submit">Create</button><button type="button" onClick={() => { setIsCreatingFile(false); setNewFileName('') }}>Cancel</button></div></form>}
          <div className="workspace-file-list">{groupedFiles.map((group) => <section key={group.folder}><h2><span aria-hidden="true">⌄</span>{group.folder}</h2>{group.files.map((file) => <button className={file.name === selectedFile ? 'is-active' : ''} type="button" onClick={() => selectFile(file.name)} key={file.name}><span aria-hidden="true">{file.name.endsWith('.json') ? '{ }' : 'M↓'}</span><span>{file.label}</span>{modifiedFiles.has(file.name) && <i aria-label="Modified">●</i>}</button>)}</section>)}</div>
          <label className="workspace-import">Import JSON or Markdown<input type="file" accept=".json,.md,application/json,text/markdown" onChange={importFile} /></label>
          <p className="workspace-memory-note">Files exist only in this window. Download them before closing.</p>
        </aside>

        <section className="workspace-editor" aria-label="File editor">
          <div className="workspace-editor-toolbar"><div><span className="workspace-file-tab"><i aria-hidden="true">{selectedFile.endsWith('.json') ? '{ }' : 'M↓'}</i>{selectedFile}{modifiedFiles.has(selectedFile) && <b aria-label="Modified">●</b>}</span></div><div><button type="button" onClick={formatJson} disabled={!selectedFile.endsWith('.json')} title="Format JSON (Ctrl/⌘ + Shift + F)">Format</button><button type="button" onClick={copyContent}>Copy</button><button type="button" onClick={duplicateFile}>Duplicate</button><button type="button" onClick={downloadFile}>Download</button>{!CORE_FILES.has(selectedFile) && <button className="is-danger" type="button" onClick={deleteFile}>Delete</button>}</div></div>
          <div className="workspace-code-shell"><div ref={lineNumbersRef} className="workspace-line-numbers" aria-hidden="true">{content.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div><textarea ref={editorRef} aria-label={`Edit ${selectedFile}`} value={content} onChange={(event) => { setFiles((current) => ({ ...current, [selectedFile]: event.target.value })); updateCursor(event.target) }} onClick={(event) => updateCursor(event.currentTarget)} onKeyUp={(event) => updateCursor(event.currentTarget)} onKeyDown={handleEditorKeyDown} onScroll={(event) => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop }} spellCheck="false" /></div>
          <div className="workspace-editor-status"><span className={validation.valid ? 'is-valid' : 'is-invalid'}>{validation.valid ? '● Valid' : '● Invalid'}</span><span>{selectedFile.endsWith('.json') ? 'JSON' : 'Markdown'}</span><span>Ln {cursor.line}, Col {cursor.column}</span><span>{content.length.toLocaleString()} chars</span><span>{byteSize.toLocaleString()} bytes</span></div>
          <div className={`workspace-validation ${validation.safeToRun ? 'is-valid' : 'is-invalid'}`}>
            <div className="workspace-validation-summary"><div><strong>{validation.safeToRun ? 'Safe to run' : validation.valid ? 'Review required' : 'Blocked'}</strong><span>{validation.schemaName}</span></div><div><span><b>{validation.errors.length}</b> errors</span><span><b>{validation.warnings.length}</b> warnings</span></div></div>
            {validation.issues.length ? <ul className="workspace-issue-list">{validation.issues.map((issue) => <li className={`is-${issue.severity}`} key={`${issue.code}-${issue.path}`}><span className={`workspace-issue-category is-${issue.category}`}>{issue.category}</span><code>{issue.path}</code><p>{issue.message}</p></li>)}</ul> : <span className="workspace-validation-clear">✓ Schema, dangerous keys, credentials, and personal data checked.</span>}
          </div>
        </section>

        <aside className="workspace-guide" aria-label="Contextual GTM and GA4 guide">
          <div className="workspace-guide-heading"><div><p className="eyebrow">Learn in context</p><h2>GTM + GA4 guide</h2></div><span>{completedGuideSteps}/4</span></div>
          <div className="workspace-guide-tabs" role="tablist" aria-label="Guide views">
            {[['context','This file'],['flow','Flow'],['examples','Examples'],['reference','Terms']].map(([id, label]) => <button type="button" role="tab" aria-selected={guideTab === id} className={guideTab === id ? 'is-active' : ''} onClick={() => setGuideTab(id)} key={id}>{label}</button>)}
          </div>

          {guideTab === 'context' && <div className="workspace-guide-panel" role="tabpanel">
            <div className="workspace-guide-progress"><div><strong>Practice progress</strong><span>{completedGuideSteps * 25}%</span></div><i><b style={{ width: `${completedGuideSteps * 25}%` }} /></i><ul>{guideProgress.map((step) => <li className={step.complete ? 'is-complete' : ''} key={step.label}><span aria-hidden="true">{step.complete ? '✓' : '○'}</span>{step.label}</li>)}</ul></div>
            <p className="eyebrow">{guideContext.kicker}</p><h3>{guideContext.title}</h3><p>{guideContext.summary}</p>
            <ol className="workspace-guide-steps">{guideContext.steps.map((step, index) => <li key={step.title}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.detail}</p></div></li>)}</ol>
            <div className="workspace-shortcuts"><strong>Editor shortcuts</strong><span><kbd>Tab</kbd> Insert two spaces</span><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd> Format JSON</span></div>
          </div>}

          {guideTab === 'flow' && <div className="workspace-guide-panel" role="tabpanel">
            <p className="eyebrow">End-to-end map</p><h3>From website to DebugView</h3><p>The offline runner covers the first step. GTM and GA4 remain conceptual until Live GTM is approved.</p>
            <ol className="workspace-flow-list">{GTM_GA4_FLOW.map((step, index) => <li className={index === 0 ? 'is-active' : ''} key={step.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{step.label}</strong><p>{step.detail}</p></div>{index < GTM_GA4_FLOW.length - 1 && <i aria-hidden="true">↓</i>}</li>)}</ol>
            {validation.value?.event && <div className="workspace-guide-code"><span>Your trigger name</span><code>{validation.value.event}</code></div>}
          </div>}

          {guideTab === 'examples' && <div className="workspace-guide-panel" role="tabpanel">
            <p className="eyebrow">Safe starter payloads</p><h3>Add an example file</h3><p>Examples use synthetic values and open as a new file, so they never overwrite your work.</p>
            <div className="workspace-guide-examples">{GUIDE_EXAMPLES.map((example) => <article key={example.id}><div><strong>{example.label}</strong><code>{example.id}</code></div><p>{example.description}</p><button type="button" aria-label={`${files[`events/example-${example.id}.json`] ? 'Open' : 'Add'} ${example.label} example${files[`events/example-${example.id}.json`] ? '' : ' to workspace'}`} onClick={() => addGuideExample(example)}>{files[`events/example-${example.id}.json`] ? 'Open example' : 'Add to workspace'}</button></article>)}</div>
          </div>}

          {guideTab === 'reference' && <div className="workspace-guide-panel" role="tabpanel">
            <p className="eyebrow">Plain-language reference</p><h3>Terms you will use</h3>
            <dl className="workspace-glossary">{WORKSPACE_GLOSSARY.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.definition}</dd></div>)}</dl>
            <div className="workspace-live-lock"><strong>Live GTM is off by default</strong><p>The separate live panel requires explicit acknowledgement, restricts tag classes and destinations, and destroys itself after 10 minutes.</p></div>
          </div>}
        </aside>

        <section className="workspace-runner" aria-labelledby="disposable-runner-heading">
          <div className="workspace-runner-controls"><div className="workspace-runner-title"><div><p className="eyebrow">Single-use process</p><h2 id="disposable-runner-heading">Disposable simulation runner</h2></div><span className={`is-${runnerStatus}`}><i aria-hidden="true" />{activeRun ? runnerStatus : runnerStatus === 'idle' ? 'Ready' : runnerStatus}</span></div><p aria-live="polite">{notice || 'A fresh network-disabled sandbox is created for one validated event, then destroyed.'}</p><div className="workspace-runner-actions"><button type="button" onClick={runEvent} disabled={!selectedFile.startsWith('events/') || !validation.safeToRun || Boolean(activeRun)}>Run in fresh sandbox</button>{activeRun && <button className="is-cancel" type="button" onClick={cancelRun}>Cancel and dispose</button>}</div><div className="workspace-runner-rules"><span>1 payload</span><span>0 network</span><span>4s timeout</span><span>Auto-dispose</span></div></div>
          <div className={`workspace-runner-process is-${runnerStatus}`}>
            {activeRun ? <><div className="workspace-process-label"><span>Ephemeral process</span><code>{activeRun.id}</code></div><iframe key={activeRun.id} ref={iframeRef} title={`Disposable dataLayer runtime ${activeRun.id}`} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={DISPOSABLE_RUNNER_DOCUMENT} onLoad={connectRunner} /><div className="workspace-disposal-note"><i aria-hidden="true" />This frame will be removed after one result.</div></> : <div className="workspace-runner-idle"><span aria-hidden="true">◇</span><strong>No process exists</strong><p>The DOM contains no runner iframe while idle.</p></div>}
          </div>
          <div className="workspace-output"><div className="workspace-output-heading"><strong>Disposable run history</strong><div><span>{output.length} local</span>{output.length > 0 && <button type="button" onClick={() => setOutput([])}>Clear</button>}</div></div>{output.length ? <ol>{output.map((item) => <li className={`is-${item.status}`} key={item.id}><div><span>{item.status}</span><strong>{item.payload.event}</strong><code>{item.id}</code></div>{item.summary ? <dl><div><dt>Trigger</dt><dd>{item.summary.triggerName}</dd></div><div><dt>Parameters</dt><dd>{item.summary.parameterCount}</dd></div><div><dt>dataLayer</dt><dd>{item.summary.dataLayerLength} event</dd></div><div><dt>Network</dt><dd>{item.summary.networkRequests} requests</dd></div></dl> : <p>No result retained for this disposed run.</p>}<details><summary>Payload</summary><pre>{JSON.stringify(item.payload, null, 2)}</pre></details></li>)}</ol> : <div className="workspace-output-empty"><strong>No simulations yet</strong><span>Completed reports stay only until this window closes.</span></div>}</div>
        </section>
        <LiveGtmPanel containerId={containerId} payload={selectedFile.startsWith('events/') ? validation.value : null} canSend={selectedFile.startsWith('events/') && validation.safeToRun} selectedFile={selectedFile} />
      </div>
      <footer className="workspace-footer"><button type="button" onClick={() => { runnerPortRef.current?.close(); runnerPortRef.current = null; setActiveRun(null); setRunnerStatus('idle'); setFiles(starterFiles); selectFile('events/page_view.json'); setOutput([]); setNotice('Workspace reset to safe starter files.') }}>Reset project</button><span>Everything is cleared when this window closes.</span></footer>
    </main>
  )
}

export default TagWorkspacePage
