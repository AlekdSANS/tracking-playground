import { useEffect, useState } from 'react'

function readInitialEvents(limit) {
  if (typeof window === 'undefined' || !Array.isArray(window.dataLayer)) {
    return []
  }

  return window.dataLayer
    .filter((item) => typeof item?.event === 'string' && item.event !== 'gtm.js')
    .slice(-limit)
    .reverse()
    .map((item) => ({ ...item, pushed_to_data_layer: true }))
}

export function useAnalyticsEvents(limit = 8) {
  const [events, setEvents] = useState(() => readInitialEvents(limit))

  useEffect(() => {
    function handleAnalyticsEvent(event) {
      setEvents((currentEvents) => [event.detail, ...currentEvents].slice(0, limit))
    }

    window.addEventListener('analytics:event', handleAnalyticsEvent)
    return () => window.removeEventListener('analytics:event', handleAnalyticsEvent)
  }, [limit])

  return [events, setEvents]
}
