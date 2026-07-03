export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: [DATE]</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. About Us</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Planfore is operated by <strong>[COMPANY NAME]</strong>, a company registered in England and Wales
            under company number <strong>[COMPANY REGISTRATION NUMBER]</strong>.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registered office: <strong>[REGISTERED ADDRESS LINE 1], [TOWN/CITY], [POSTCODE]</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You can contact us at: <a href="mailto:[CONTACT EMAIL]" className="text-primary underline">[CONTACT EMAIL]</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. Acceptance of Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By accessing or using Planfore, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, you must not use our service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. Description of Service</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Planfore is a web-based retail analytics platform that allows businesses to record
            daily trading performance, set revenue forecasts, and generate reports. The service is provided
            on a subscription basis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Your Account</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are responsible for maintaining the confidentiality of your account credentials and for all
            activity that occurs under your account. You must notify us immediately of any unauthorised use
            of your account.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You must not share your login credentials with anyone outside your organisation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Acceptable Use</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">You agree not to:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to gain unauthorised access to any part of the service or its infrastructure</li>
            <li>Introduce malicious code or interfere with the operation of the service</li>
            <li>Resell or sublicence access to the service without our written permission</li>
            <li>Use the service to store or transmit data that infringes third-party rights</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Your Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You retain ownership of all data you input into the service. We act as a data processor
            on your behalf. Please refer to our <a href="/privacy" className="text-primary underline">Privacy Policy</a> for
            full details of how we handle your data.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are responsible for ensuring that the data you input is accurate and that you have the
            right to store it within our service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Payment and Subscription</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Subscription fees are payable in advance. Details of current pricing are available on our
            website. We reserve the right to change pricing with [NUMBER] days' notice.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If payment is not received, we reserve the right to suspend access to the service until
            the account is brought up to date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Availability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We aim to provide a reliable service but do not guarantee uninterrupted availability.
            We will endeavour to give reasonable notice of any planned maintenance that may affect access.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To the fullest extent permitted by law, we shall not be liable for any indirect, incidental,
            special or consequential loss arising from your use of the service. Our total liability to
            you shall not exceed the fees paid by you in the [NUMBER] months preceding the claim.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Either party may terminate the subscription at any time with [NUMBER] days' written notice.
            Upon termination, you may request an export of your data within [NUMBER] days. After that
            period, your data will be securely deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            These terms are governed by the laws of England and Wales. Any disputes shall be subject
            to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">12. Changes to These Terms</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update these terms from time to time. We will notify you of material changes by
            email or via a notice within the application. Continued use of the service after changes
            take effect constitutes acceptance of the updated terms.
          </p>
        </section>

        <div className="border-t pt-6">
          <p className="text-xs text-muted-foreground">
            Questions about these terms? Contact us at{' '}
            <a href="mailto:[CONTACT EMAIL]" className="text-primary underline">[CONTACT EMAIL]</a>
          </p>
        </div>
      </div>
    </div>
  )
}
