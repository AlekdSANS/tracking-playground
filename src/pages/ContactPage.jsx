import ContactForm from '../components/ContactForm'

function ContactPage() {
  return (
    <section className="narrow-page playful-page contact-playful">
      <img
        className="playful-image contact-image"
        src="/silly/silly-1.webp"
        alt="Business cat mascot"
        width="1080"
        height="848"
        decoding="async"
      />
      <div className="page-intro">
        <h1>Contact page form</h1>
        <p>
          This route uses a separate form name so you can compare form tracking
          by page and location in GTM or GA4.
        </p>
      </div>

      <ContactForm
        formName="contact_page_form"
        formLocation="contact_page"
        title="Contact page form"
      />
    </section>
  )
}

export default ContactPage
