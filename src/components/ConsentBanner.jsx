import { useState } from 'react'
import { trackConsentUpdate } from '../utils/analytics'
import { getStoredConsent, saveConsent } from '../utils/consent'
import { syncGoogleTagManager } from '../utils/googleTagManager'

function ConsentBanner({ forceOpen = false, onClose }) {
  const [isOpen, setIsOpen] = useState(forceOpen || !localStorage.getItem('analytics_practice_consent'))
  const [showCustomize, setShowCustomize] = useState(false)
  const [preferences, setPreferences] = useState(getStoredConsent)

  function savePreferences(nextPreferences) {
    const savedPreferences = saveConsent(nextPreferences)
    syncGoogleTagManager(savedPreferences)
    setPreferences(savedPreferences)
    trackConsentUpdate(savedPreferences)
    setIsOpen(false)
    setShowCustomize(false)
    onClose?.()
  }

  function updatePreference(event) {
    const { checked, name } = event.target
    setPreferences((currentPreferences) => ({
      ...currentPreferences,
      [name]: checked,
    }))
  }

  if (!isOpen && !forceOpen) {
    return null
  }

  return (
    <section className="consent-banner" aria-label="Consent settings">
      <div>
        <h2>Consent settings</h2>
        <p>
          Necessary storage is always enabled. Analytics and advertising events
          are only pushed after you allow them.
        </p>
      </div>

      {showCustomize && (
        <div className="consent-options">
          <label className="checkbox-field">
            <input type="checkbox" checked disabled />
            Necessary
          </label>
          <label className="checkbox-field">
            <input
              name="analytics"
              type="checkbox"
              checked={preferences.analytics}
              onChange={updatePreference}
            />
            Analytics
          </label>
          <label className="checkbox-field">
            <input
              name="advertising"
              type="checkbox"
              checked={preferences.advertising}
              onChange={updatePreference}
            />
            Advertising
          </label>
        </div>
      )}

      <div className="consent-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            savePreferences({ necessary: true, analytics: false, advertising: false })
          }
        >
          Reject optional tracking
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setShowCustomize((currentValue) => !currentValue)}
        >
          Customize
        </button>
        {showCustomize ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => savePreferences(preferences)}
          >
            Save settings
          </button>
        ) : (
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              savePreferences({ necessary: true, analytics: true, advertising: true })
            }
          >
            Accept all
          </button>
        )}
      </div>
    </section>
  )
}

export default ConsentBanner
