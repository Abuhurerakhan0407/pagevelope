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
          <p style={{ marginTop: '16px' }}>Last Updated: January 1, 2024</p>
          <p style={{ marginTop: '16px' }}>
            Subscriptions may be cancelled at any time. We offer a standard 14-day refund window for new subscriptions if you are not satisfied with the Pagevelope service.
          </p>
        </div>
      </section>
    </main>
  );
}
