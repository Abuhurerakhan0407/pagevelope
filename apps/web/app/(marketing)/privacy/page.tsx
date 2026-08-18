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
          <p style={{ marginTop: '16px' }}>Last Updated: January 1, 2024</p>
          <p style={{ marginTop: '16px' }}>
            We respect your privacy. Pagevelope collects only the necessary data to provide and improve our services. We do not sell your personal data to third parties.
          </p>
        </div>
      </section>
    </main>
  );
}
