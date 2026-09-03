import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { captureCampaignParams } from '../utils/campaignParams'
import { trackPageView } from '../utils/analytics'

const DEFAULT_METADATA = {
  title: 'Tracking Playground — Learn conversion tracking by doing',
  description: 'Practice forms, analytics events, consent settings, and UTM links in one clear tracking playground.',
}

const PAGE_METADATA = {
  '/': DEFAULT_METADATA,
  '/forms': {
    title: 'Forms Lab — Tracking Playground',
    description: 'Practice contact, callback, and newsletter form tracking with clear event feedback.',
  },
  '/utm-builder': {
    title: 'UTM Link Builder — Tracking Playground',
    description: 'Build campaign links and understand each UTM parameter as you work.',
  },
  '/tag-lab': {
    title: 'GTM and GA4 Lab — Tracking Playground',
    description: 'Practice GTM and GA4 event setup in a safe, isolated workspace.',
  },
  '/login': {
    title: 'Account — Tracking Playground',
    description: 'Sign in or create a practice account for Tracking Playground.',
  },
  '/thank-you': {
    title: 'Thank You — Tracking Playground',
    description: 'Your practice form was submitted successfully.',
  },
  '/privacy': {
    title: 'Privacy — Tracking Playground',
    description: 'Learn what this playground tracks and how its consent controls work.',
  },
}

function setMetaContent(selector, content) {
  document.querySelector(selector)?.setAttribute('content', content)
}

export function applyPageMetadata(pathname) {
  if (typeof document === 'undefined') {
    return
  }

  const metadata = PAGE_METADATA[pathname] || DEFAULT_METADATA
  document.title = metadata.title
  setMetaContent('meta[name="description"]', metadata.description)
  setMetaContent('meta[property="og:title"]', metadata.title)
  setMetaContent('meta[property="og:description"]', metadata.description)
  setMetaContent('meta[name="twitter:title"]', metadata.title)
  setMetaContent('meta[name="twitter:description"]', metadata.description)
}

export function usePageTracking() {
  const location = useLocation()
  const lastTrackedPathRef = useRef('')

  useEffect(() => {
    applyPageMetadata(location.pathname)
    captureCampaignParams(location.search)

    const path = `${location.pathname}${location.search}`
    if (lastTrackedPathRef.current === path) {
      return
    }

    lastTrackedPathRef.current = path
    trackPageView(path)
  }, [location.pathname, location.search])
}
