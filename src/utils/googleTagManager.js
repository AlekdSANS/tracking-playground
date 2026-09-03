export const GTM_CONTAINER_ID = 'GTM-N386PQB8'

const GTM_SCRIPT_ID = 'google-tag-manager-script'
let consentModeInitialized = false

function pushGtagCommand(...args) {
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push(args)
}

function getGoogleConsentState(consent) {
  return {
    analytics_storage: consent.analytics ? 'granted' : 'denied',
    ad_storage: consent.advertising ? 'granted' : 'denied',
    ad_user_data: consent.advertising ? 'granted' : 'denied',
    ad_personalization: consent.advertising ? 'granted' : 'denied',
  }
}

export function loadGoogleTagManager() {
  if (typeof document === 'undefined' || document.getElementById(GTM_SCRIPT_ID)) {
    return
  }

  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

  const script = document.createElement('script')
  script.id = GTM_SCRIPT_ID
  script.async = true
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_CONTAINER_ID)}`
  document.head.appendChild(script)
}

export function syncGoogleTagManager(consent) {
  if (typeof window === 'undefined') {
    return
  }

  const command = consentModeInitialized ? 'update' : 'default'
  pushGtagCommand('consent', command, getGoogleConsentState(consent))
  consentModeInitialized = true

  if (consent.analytics) {
    loadGoogleTagManager()
  }
}
