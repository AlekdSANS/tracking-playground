import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { trackThankYouPageView } from '../utils/analytics'

function getSubmissionInfo(location) {
  const state = location.state || {}
  const storedInfo = sessionStorage.getItem('last_form_submission')

  if (state.formName && state.formLocation) {
    sessionStorage.setItem('last_form_submission', JSON.stringify(state))
    return state
  }

  try {
    return storedInfo ? JSON.parse(storedInfo) : {}
  } catch {
    return {}
  }
}

function ThankYouPage() {
  const location = useLocation()
  const submissionInfo = getSubmissionInfo(location)
  const formName = submissionInfo.formName || 'unknown_form'
  const formLocation = submissionInfo.formLocation || 'unknown_location'
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) {
      return
    }

    trackedRef.current = true
    trackThankYouPageView(formName, formLocation)
  }, [formName, formLocation])

  return (
    <section className="thank-you-page playful-page thank-you-playful">
      <img
        className="playful-image thank-you-image"
        src="/silly/thank-you.webp"
        alt="Thank you page mascot"
        width="800"
        height="800"
        decoding="async"
      />
      <h1>Thank you</h1>
      <p>
        Successful submission recorded for <strong>{formName}</strong> from{' '}
        <strong>{formLocation}</strong>.
      </p>
      <Link className="primary-link" to="/">
        Return to home
      </Link>
    </section>
  )
}

export default ThankYouPage
