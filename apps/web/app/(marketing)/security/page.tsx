import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Security overview and practices at Pagevelope.',
  alternates: {
    canonical: "/security",
  }
};

export default function SecurityPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Trust</p>
        <h1>Security Overview</h1>
        <p className="heroCopy">
          How we keep your data safe and secure.
        </p>
      </section>

      <section className="rules">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2>Pagevelope Security Practices</h2>
          <p style={{ marginTop: '16px' }}><strong>Current code posture — production verification incomplete.</strong></p>
          <p style={{ marginTop: '16px' }}>Reviewed: August 29, 2026</p>
          <p style={{ marginTop: '16px' }}>
            Current code uses tenant-scoped row-level security, server-only provider credentials, application-layer encryption for Shopify and Klaviyo tokens, immutable release evidence, and restricted provider-write paths. Historical disposable-database tests passed these controls.
          </p>
          <p style={{ marginTop: '16px' }}>
            Production database health and migration parity are not currently verified. Pagevelope does not claim an external certification, independent security audit, or continuously monitored production control until evidence exists.
          </p>
        </div>
      </section>
    </main>
  );
}
