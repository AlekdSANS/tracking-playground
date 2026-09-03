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
