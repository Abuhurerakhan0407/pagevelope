import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for Pagevelope.',
  alternates: {
    canonical: "/terms",
  }
};

export default function TermsPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Legal</p>
        <h1>Terms of Service</h1>
        <p className="heroCopy">
          Please read these terms carefully.
        </p>
      </section>

      <section className="rules">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2>Pagevelope Terms of Service</h2>
          <p style={{ marginTop: '16px' }}><strong>Draft — not approved for paid launch.</strong></p>
          <p style={{ marginTop: '16px' }}>Reviewed: August 29, 2026</p>
          <p style={{ marginTop: '16px' }}>
            Pagevelope creates versioned email-campaign assets and can publish approved template content to Klaviyo. Pagevelope does not operate bulk-email delivery. Customers remain responsible for recipient consent, campaign configuration, and sending inside their email service provider.
          </p>
          <p style={{ marginTop: '16px' }}>
            Paid pilot access requires separately approved written terms covering the contracting entity, governing law, fees, cancellation, liability, support, and data processing. Payment must not be accepted until those terms are approved and presented to the customer.
          </p>
        </div>
      </section>
    </main>
  );
}
