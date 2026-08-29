import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy',
  description: 'Acceptable Use Policy for Pagevelope.',
  alternates: {
    canonical: "/acceptable-use",
  }
};

export default function AcceptableUsePage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Legal</p>
        <h1>Acceptable Use Policy</h1>
        <p className="heroCopy">
          Guidelines for using our services.
        </p>
      </section>

      <section className="rules">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2>Pagevelope Acceptable Use Policy</h2>
          <p style={{ marginTop: '16px' }}><strong>Draft — not approved for paid launch.</strong></p>
          <p style={{ marginTop: '16px' }}>Reviewed: August 29, 2026</p>
          <p style={{ marginTop: '16px' }}>
            You may not use Pagevelope to create or publish unlawful, deceptive, malicious, infringing, or unsolicited campaign content. Pagevelope publishes template content to Klaviyo but does not send bulk campaigns. Customers must manage consent, suppression, recipients, and campaign delivery inside their email service provider.
          </p>
        </div>
      </section>
    </main>
  );
}
