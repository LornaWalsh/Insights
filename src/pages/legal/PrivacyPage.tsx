export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: [DATE]</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">1. Who We Are</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>[COMPANY NAME]</strong> ("<strong>we</strong>", "<strong>us</strong>", "<strong>our</strong>") operates
            Planfore. We are the data controller for personal data collected through this service.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Registered office: <strong>[REGISTERED ADDRESS LINE 1], [TOWN/CITY], [POSTCODE]</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ICO registration number: <strong>[ICO REGISTRATION NUMBER]</strong>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Data protection contact: <a href="mailto:[CONTACT EMAIL]" className="text-primary underline">[CONTACT EMAIL]</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">2. What Data We Collect</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">We collect the following categories of personal data:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li><strong>Account data:</strong> name, email address, and role within your organisation</li>
            <li><strong>Usage data:</strong> log-in times, pages accessed, and export history</li>
            <li><strong>Business data:</strong> trading performance figures, channel information, and forecast targets that you input into the service — this is your data and is not personal data in most cases</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not collect sensitive personal data (as defined under UK GDPR Article 9).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">We use your personal data to:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li>Provide and maintain the Planfore service</li>
            <li>Manage your account and user access</li>
            <li>Send service-related communications (e.g. password resets, account invitations)</li>
            <li>Investigate and resolve support issues</li>
            <li>Comply with our legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">4. Legal Basis for Processing</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">We process your personal data on the following legal bases:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li><strong>Contract:</strong> processing necessary to provide the service you have subscribed to</li>
            <li><strong>Legitimate interests:</strong> improving the service and preventing fraud</li>
            <li><strong>Legal obligation:</strong> where we are required to process data to comply with the law</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">5. Data Storage and Security</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data is stored securely using Supabase, which hosts data on infrastructure within the
            European Economic Area. We implement appropriate technical and organisational measures to
            protect your data against unauthorised access, loss, or destruction.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Access to your organisation's data within the platform is controlled by role-based permissions.
            Each organisation's data is strictly isolated and cannot be accessed by other organisations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We retain your personal data for as long as your account is active or as needed to provide
            the service. If you cancel your subscription, we will retain your data for [NUMBER] days
            to allow you to export it, after which it will be securely deleted.
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Export logs and audit records may be retained for up to [NUMBER] years to meet our legal
            and contractual obligations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">7. Sharing Your Data</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We do not sell your personal data. We share data only with:
          </p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li><strong>Supabase:</strong> our database and authentication provider</li>
            <li><strong>Vercel:</strong> our hosting provider</li>
            <li><strong>[PAYMENT PROVIDER]:</strong> for processing subscription payments</li>
            <li>Any third party where required by law or to protect our legal rights</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            All third-party processors are bound by data processing agreements and may only process
            your data on our instructions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">8. Your Rights</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Under UK GDPR, you have the right to:</p>
          <ul className="text-sm text-muted-foreground leading-relaxed list-disc ml-5 space-y-1">
            <li><strong>Access</strong> the personal data we hold about you</li>
            <li><strong>Rectify</strong> inaccurate personal data</li>
            <li><strong>Erase</strong> your personal data in certain circumstances</li>
            <li><strong>Restrict</strong> processing of your personal data</li>
            <li><strong>Data portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong>Object</strong> to processing based on legitimate interests</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To exercise any of these rights, contact us at{' '}
            <a href="mailto:[CONTACT EMAIL]" className="text-primary underline">[CONTACT EMAIL]</a>.
            We will respond within 30 days.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">9. Cookies</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We use only essential cookies required for authentication and session management.
            We do not use tracking, advertising, or analytics cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">10. Complaints</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            If you are unhappy with how we handle your personal data, you have the right to lodge a
            complaint with the Information Commissioner's Office (ICO) at{' '}
            <a href="https://ico.org.uk" className="text-primary underline" target="_blank" rel="noopener noreferrer">ico.org.uk</a>{' '}
            or by calling 0303 123 1113.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">11. Changes to This Policy</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by email or via a notice within the application. The date at the top of this page indicates
            when this policy was last updated.
          </p>
        </section>

        <div className="border-t pt-6 flex gap-4 text-xs text-muted-foreground">
          <a href="/terms" className="text-primary underline">Terms of Service</a>
          <span>·</span>
          <span>© [YEAR] [COMPANY NAME]. All rights reserved.</span>
        </div>
      </div>
    </div>
  )
}
