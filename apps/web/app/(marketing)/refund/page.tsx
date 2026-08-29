import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'Refund Policy for Pagevelope.',
  alternates: {
    canonical: "/refund",
  }
};

export default function RefundPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Legal</p>
        <h1>Refund Policy</h1>
        <p className="heroCopy">
          Our policies regarding refunds and cancellations.
        </p>
      </section>

      <section className="rules">
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2>Pagevelope Refund Policy</h2>
          <p style={{ marginTop: '16px' }}><strong>Draft — refund terms require owner approval.</strong></p>
          <p style={{ marginTop: '16px' }}>Reviewed: August 29, 2026</p>
          <p style={{ marginTop: '16px' }}>
            No universal refund window has been approved. Private-pilot fees, refunds, and cancellation rights must be stated in the customer&apos;s written pilot terms before payment. The application is designed to request subscription cancellation at the end of the current paid billing period.
          </p>
        </div>
      </section>
    </main>
  );
}
