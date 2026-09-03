import CallbackForm from '../components/CallbackForm'

function CallbackPage() {
  return (
    <section className="narrow-page playful-page callback-playful">
      <img
        className="playful-image callback-image"
        src="/silly/silly-2.webp"
        alt="Golem mascot"
        width="719"
        height="601"
        decoding="async"
      />
      <div className="page-intro">
        <h1>Callback request</h1>
        <p>
          Use this shorter form to practice callback conversion events without
          sending the entered phone or time to analytics.
        </p>
      </div>

      <CallbackForm />
    </section>
  )
}

export default CallbackPage
