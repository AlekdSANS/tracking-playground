import { useMemo } from 'react'
import { createGtmSetupAudit } from '../utils/gtmAudit'

function FindingIcon({ status }) {
  return <span className={`setup-audit-icon is-${status}`} aria-label={status === 'verified' ? 'Verified' : status === 'warning' ? 'Warning' : 'Manual check'}>{status === 'verified' ? '✓' : status === 'warning' ? '!' : '○'}</span>
}

function GtmSetupAuditReport({ files, snapshot, containerId, measurementId }) {
  const report = useMemo(() => createGtmSetupAudit(files, snapshot, { containerId, measurementId }), [containerId, files, measurementId, snapshot])
  const groupedFindings = report.configuration.reduce((groups, finding) => {
    const current = groups.find((group) => group.lesson === finding.lesson)
    if (current) current.findings.push(finding)
    else groups.push({ lesson: finding.lesson, findings: [finding] })
    return groups
  }, [])

  return <section className="setup-audit-report" aria-labelledby="setup-audit-heading">
    <header className="setup-audit-report-heading">
      <div><span>Check my setup</span><h3 id="setup-audit-heading">Evidence, not guesses</h3><p>The read-only API compares this workspace with the sanitized GTM configuration it can inspect.</p></div>
      <dl><div><dt>Verified</dt><dd>{report.summary.verified}</dd></div><div><dt>Warnings</dt><dd>{report.summary.warnings}</dd></div><div><dt>Manual</dt><dd>{report.summary.manual}</dd></div></dl>
    </header>

    <div className="setup-audit-evidence-map" aria-label="Three verification levels">
      <div className="is-api"><span>01</span><div><strong>Configuration verified through API</strong><small>Container, tags, triggers, variables, links, and consent settings</small></div></div>
      <i aria-hidden="true">≠</i>
      <div className="is-browser"><span>02</span><div><strong>Browser behavior verified through Tag Assistant</strong><small>What actually fired during a website action</small></div></div>
      <i aria-hidden="true">≠</i>
      <div className="is-delivery"><span>03</span><div><strong>Analytics delivery verified through GA4 DebugView</strong><small>What actually reached the Analytics property</small></div></div>
    </div>

    <section className="setup-audit-api" aria-labelledby="setup-audit-api-heading">
      <header><div><span>API evidence</span><h4 id="setup-audit-api-heading">Configuration verified through API</h4></div><b>Read-only snapshot</b></header>
      <div className="setup-audit-groups">{groupedFindings.map((group) => <section key={group.lesson}><h5>{group.lesson}</h5><ul>{group.findings.map((finding) => <li className={`is-${finding.status}`} key={finding.id}><FindingIcon status={finding.status} /><div><strong>{finding.title}</strong><p>{finding.detail}</p></div></li>)}</ul></section>)}</div>
    </section>

    <div className="setup-audit-manual">
      <section aria-labelledby="setup-audit-browser-heading"><header><span>Browser evidence</span><h4 id="setup-audit-browser-heading">Browser behavior verified through Tag Assistant</h4></header><FindingIcon status="manual" /><div><strong>{report.manual[0].title}</strong><p>{report.manual[0].detail}</p><a href="https://support.google.com/tagmanager/answer/6107056?hl=en" target="_blank" rel="noreferrer">Open preview guidance ↗</a></div></section>
      <section aria-labelledby="setup-audit-delivery-heading"><header><span>Delivery evidence</span><h4 id="setup-audit-delivery-heading">Analytics delivery verified through GA4 DebugView</h4></header><FindingIcon status="manual" /><div><strong>{report.manual[1].title}</strong><p>{report.manual[1].detail}</p><span>GA4 → Admin → Data display → DebugView</span></div></section>
    </div>

    <footer><strong>An API check is not an end-to-end test.</strong><span>Keep both manual checks open until Tag Assistant shows the expected tag firing and DebugView shows the event arriving.</span></footer>
  </section>
}

export default GtmSetupAuditReport
