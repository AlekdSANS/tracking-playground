import NewsletterForm from '../components/NewsletterForm'

function NewsletterPage() {
  return (
    <section className="narrow-page playful-page newsletter-playful">
      <img
        className="playful-image newsletter-image"
        src="/silly/silly-3.webp"
        alt="Newsletter cat mascot"
        width="512"
        height="512"
        decoding="async"
      />
      <div className="page-intro">
        <h1>Newsletter signup</h1>
        <p>
          Practice newsletter signup events with checkbox validation and
          consent-friendly parameters.
        </p>
      </div>

      <NewsletterForm />
    </section>
  )
}

export default NewsletterPage
