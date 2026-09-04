import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Pagevelope.',
  alternates: {
    canonical: "/privacy",
  }
};

export default function PrivacyPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Legal</p>
        <h1>Privacy Policy</h1>
        <p className="heroCopy">
          How we handle your data.
        </p>
      </section>

      <section className="rules">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2>Pagevelope Privacy Policy</h2>
          <p style={{ marginTop: '16px' }}><strong>Draft — not approved for paid launch.</strong></p>
          <p style={{ marginTop: '16px' }}>Reviewed: August 29, 2026</p>
          <p style={{ marginTop: '16px' }}>
            Pagevelope code handles account identity, workspace and campaign content, selected Shopify product data, provider connection records, subscription state, and operational analytics. Shopify and Klaviyo credentials are designed for encrypted server-side storage; Resend is limited to explicit single-recipient test delivery.
          </p>
          <p style={{ marginTop: '16px' }}>
            A final policy still requires Abu&apos;s approval of the legal entity and contact, processor list, retention periods, deletion process, customer rights procedure, international-transfer terms, and production data locations. No claim about production processing is approved until current provider configuration is verified.
          </p>
        </div>
      </section>
    </main>
  );
}
