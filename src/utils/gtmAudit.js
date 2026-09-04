const GA4_EVENT_NAME = /^[A-Za-z][A-Za-z0-9_]{0,39}$/
const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{5,20}$/

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

export function readLocalEventNames(files) {
  return uniqueSorted(Object.entries(files || {}).flatMap(([name, content]) => {
    if (!name.startsWith('events/') || !name.endsWith('.json')) return []
    try {
      const eventName = JSON.parse(content)?.event
      return typeof eventName === 'string' && GA4_EVENT_NAME.test(eventName) ? [eventName] : []
    } catch {
      return []
    }
  }))
}

export function readLocalEvents(files) {
  const events = new Map()
  Object.entries(files || {}).forEach(([fileName, content]) => {
    if (!fileName.startsWith('events/') || !fileName.endsWith('.json')) return
    try {
      const value = JSON.parse(content)
      if (!value || typeof value !== 'object' || Array.isArray(value) || !GA4_EVENT_NAME.test(value.event)) return
      const parameterNames = Object.keys(value).filter((name) => name !== 'event' && GA4_EVENT_NAME.test(name))
      const current = events.get(value.event) || { eventName: value.event, parameterNames: [], files: [] }
      current.parameterNames = uniqueSorted([...current.parameterNames, ...parameterNames])
      current.files.push(fileName)
      events.set(value.event, current)
    } catch {
      // Invalid local files are ignored by the read-only comparison.
    }
  })
  return [...events.values()].sort((left, right) => left.eventName.localeCompare(right.eventName))
}

export function compareWorkspaceToGtm(files, snapshot) {
  const localEventNames = readLocalEventNames(files)
  const gtmEventNames = uniqueSorted(
    (Array.isArray(snapshot?.audit?.ga4?.eventNames) ? snapshot.audit.ga4.eventNames : [])
      .filter((value) => typeof value === 'string' && GA4_EVENT_NAME.test(value)),
  )
  const measurementIds = uniqueSorted(
    (Array.isArray(snapshot?.audit?.ga4?.measurementIds) ? snapshot.audit.ga4.measurementIds : [])
      .filter((value) => typeof value === 'string' && GA4_MEASUREMENT_ID.test(value)),
  )
  const localSet = new Set(localEventNames)
  const gtmSet = new Set(gtmEventNames)
  const matchedEventNames = localEventNames.filter((eventName) => gtmSet.has(eventName))
  const onlyInWorkspace = localEventNames.filter((eventName) => !gtmSet.has(eventName))
  const onlyInGtm = gtmEventNames.filter((eventName) => !localSet.has(eventName))
  return {
    localEventNames,
    gtmEventNames,
    matchedEventNames,
    onlyInWorkspace,
    onlyInGtm,
    measurementIds,
    summary: {
      localEvents: localEventNames.length,
      gtmEvents: gtmEventNames.length,
      matchedEvents: matchedEventNames.length,
      missingFromGtm: onlyInWorkspace.length,
      missingFromWorkspace: onlyInGtm.length,
    },
  }
}

function createFinding(id, status, lesson, title, detail) {
  return { id, status, lesson, title, detail }
}

function readDetectedDataLayerVariables(snapshot) {
  return uniqueSorted((Array.isArray(snapshot?.audit?.variables) ? snapshot.audit.variables : []).flatMap((variable) => {
    const fromApi = Array.isArray(variable.dataLayerNames) ? variable.dataLayerNames : []
    const fromName = String(variable.name || '').match(/^DLV\s*[-–—:]\s*([A-Za-z][A-Za-z0-9_]{0,39})$/i)?.[1]
    return [...fromApi, fromName].filter((name) => GA4_EVENT_NAME.test(name))
  }))
}

export function createGtmSetupAudit(files, snapshot, expected = {}) {
  const comparison = compareWorkspaceToGtm(files, snapshot)
  const localEvents = readLocalEvents(files)
  const audit = snapshot?.audit || {}
  const triggers = Array.isArray(audit.triggers) ? audit.triggers : []
  const tags = Array.isArray(audit.tags) ? audit.tags : []
  const dataLayerVariables = readDetectedDataLayerVariables(snapshot)
  const dataLayerVariableSet = new Set(dataLayerVariables)
  const googleTagMeasurementIds = uniqueSorted((Array.isArray(audit.googleTagConfigs) ? audit.googleTagConfigs : []).flatMap((config) => Array.isArray(config.measurementIds) ? config.measurementIds : []).filter((id) => GA4_MEASUREMENT_ID.test(id)))
  const expectedContainerId = String(expected.containerId || '').trim().toUpperCase()
  const actualContainerId = String(snapshot?.container?.publicId || '').trim().toUpperCase()
  const expectedMeasurementId = String(expected.measurementId || '').trim().toUpperCase()
  const configuration = []

  configuration.push(actualContainerId && (!expectedContainerId || actualContainerId === expectedContainerId)
    ? createFinding('container', 'verified', 'GTM container', `GTM container ${actualContainerId} exists.`, 'Verified through the Tag Manager API container lookup.')
    : createFinding('container', 'warning', 'GTM container', 'The expected GTM container was not verified.', expectedContainerId ? `Expected ${expectedContainerId}, but the API returned ${actualContainerId || 'no container ID'}.` : 'No valid container ID was returned.'))

  if (googleTagMeasurementIds.length === 0) {
    configuration.push(createFinding('google-tag', 'warning', 'Google tag', 'No Google tag measurement ID was detected.', 'Create a Google tag and connect its G- measurement ID.'))
  } else if (expectedMeasurementId && !googleTagMeasurementIds.includes(expectedMeasurementId)) {
    configuration.push(createFinding('google-tag', 'warning', 'Google tag', `Google tag does not use ${expectedMeasurementId}.`, `Detected: ${googleTagMeasurementIds.join(', ')}.`))
  } else {
    configuration.push(createFinding('google-tag', 'verified', 'Google tag', `Google tag uses ${expectedMeasurementId || googleTagMeasurementIds[0]}.`, expectedMeasurementId ? 'The API value matches the measurement ID saved in the setup course.' : 'A valid GA4 measurement ID was detected through the API.'))
  }

  localEvents.forEach((localEvent) => {
    const matchingTriggers = triggers.filter((trigger) => Array.isArray(trigger.eventNames) && trigger.eventNames.includes(localEvent.eventName))
    const matchingTags = tags.filter((tag) => Array.isArray(tag.ga4?.eventNames) && tag.ga4.eventNames.includes(localEvent.eventName))
    configuration.push(matchingTriggers.length
      ? createFinding(`trigger-${localEvent.eventName}`, 'verified', `Event · ${localEvent.eventName}`, `${localEvent.eventName} trigger exists.`, `Detected ${matchingTriggers.map((trigger) => trigger.name).join(', ')}.`)
      : createFinding(`trigger-${localEvent.eventName}`, 'warning', `Event · ${localEvent.eventName}`, `${localEvent.eventName} trigger was not detected.`, `Create a Custom Event trigger whose event name is exactly ${localEvent.eventName}.`))
    configuration.push(matchingTags.length
      ? createFinding(`tag-${localEvent.eventName}`, 'verified', `Event · ${localEvent.eventName}`, `${localEvent.eventName} GA4 event tag exists.`, `Detected ${matchingTags.map((tag) => tag.name).join(', ')}.`)
      : createFinding(`tag-${localEvent.eventName}`, 'warning', `Event · ${localEvent.eventName}`, `${localEvent.eventName} GA4 event tag was not detected.`, 'Create a Google Analytics: GA4 Event tag with the same event name.'))
    const linked = matchingTags.some((tag) => matchingTriggers.some((trigger) => tag.firingTriggerIds?.includes(trigger.triggerId)))
    configuration.push(linked
      ? createFinding(`link-${localEvent.eventName}`, 'verified', `Event · ${localEvent.eventName}`, `Trigger is connected to the ${localEvent.eventName} tag.`, 'The tag firingTriggerIds includes the matching Custom Event trigger.')
      : createFinding(`link-${localEvent.eventName}`, 'warning', `Event · ${localEvent.eventName}`, `Trigger-to-tag connection was not verified for ${localEvent.eventName}.`, 'Open the GA4 Event tag and attach the matching Custom Event trigger under Triggering.'))
    localEvent.parameterNames.filter((name) => !dataLayerVariableSet.has(name)).forEach((name) => {
      configuration.push(createFinding(`variable-${localEvent.eventName}-${name}`, 'warning', `Variables · ${localEvent.eventName}`, `${name} exists locally but no GTM Data Layer Variable was detected.`, `Create DLV - ${name} with Data Layer Variable Name ${name}.`))
    })
  })

  comparison.onlyInGtm.forEach((eventName) => {
    configuration.push(createFinding(`gtm-only-${eventName}`, 'warning', 'Workspace parity', `${eventName} exists in GTM but not in the local workspace.`, `Add a local event file for ${eventName}, or confirm that the GTM event is intentionally managed elsewhere.`))
  })

  const consentDetected = (Array.isArray(audit.consent?.types) && audit.consent.types.length > 0)
    || (Array.isArray(audit.consent?.tagsRequiringConsent) && audit.consent.tagsRequiringConsent.length > 0)
  configuration.push(consentDetected
    ? createFinding('consent', 'verified', 'Consent', 'Consent configuration was detected.', `Detected consent types: ${audit.consent?.types?.join(', ') || 'tag-level consent settings'}.`)
    : createFinding('consent', 'warning', 'Consent', 'No consent configuration was detected.', 'Review Consent Mode and tag consent requirements before publishing.'))

  const manual = [
    createFinding('tag-assistant', 'manual', 'Browser behavior', 'Manual check required: Tag Assistant firing.', 'The read-only API can inspect saved configuration, but only Tag Assistant can prove that the trigger and tag fire during a real browser action.'),
    createFinding('debugview', 'manual', 'Analytics delivery', 'Manual check required: GA4 DebugView reception.', 'Only GA4 DebugView can confirm that the event reached the Analytics property and carried the expected parameters.'),
  ]

  return {
    configuration,
    manual,
    comparison,
    detected: { dataLayerVariables, googleTagMeasurementIds },
    summary: {
      verified: configuration.filter((finding) => finding.status === 'verified').length,
      warnings: configuration.filter((finding) => finding.status === 'warning').length,
      manual: manual.length,
    },
  }
}
