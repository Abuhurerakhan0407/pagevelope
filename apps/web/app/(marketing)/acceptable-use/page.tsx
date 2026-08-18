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
          <p style={{ marginTop: '16px' }}>Last Updated: January 1, 2024</p>
          <p style={{ marginTop: '16px' }}>
            You may not use Pagevelope to send spam, malicious content, or content that violates the rights of others. We reserve the right to suspend accounts that violate these guidelines.
          </p>
        </div>
      </section>
    </main>
  );
}
