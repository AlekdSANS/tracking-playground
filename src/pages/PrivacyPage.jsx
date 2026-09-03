function PrivacyPage() {
  return (
    <section className="narrow-page text-page playful-page privacy-playful">
      <img
        className="playful-image privacy-image"
        src="/silly/silly-4.webp"
        alt="Privacy page mascot"
        width="512"
        height="512"
        decoding="async"
      />
      <h1>Analytics and privacy notes</h1>
      <p>
        This practice app is designed for analytics testing only. It simulates
        form submissions in the browser and does not send form data to a backend.
      </p>
      <h2>What can be tracked</h2>
      <p>
        Safe analytics parameters include form name, form location, page path,
        submission status, error type, UTM campaign values, and whether a gclid
        parameter exists.
      </p>
      <h2>What must not be tracked</h2>
      <p>
        Do not send full names, email addresses, phone numbers, message text,
        preferred contact times, or other personal information to Google
        Analytics, Google Ads, or Google Tag Manager.
      </p>
      <h2>Consent</h2>
      <p>
        Necessary storage stays enabled. Analytics and advertising events are
        blocked until consent is granted. Comments in the code show where Google
        Consent Mode can later be connected.
      </p>
    </section>
  )
}

export default PrivacyPage
