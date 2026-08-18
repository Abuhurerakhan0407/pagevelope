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
          <p style={{ marginTop: '16px' }}>Last Updated: January 1, 2024</p>
          <p style={{ marginTop: '16px' }}>
            By using Pagevelope, you agree to these terms. Pagevelope provides a platform to create and manage email campaigns. You are responsible for the content you create and must comply with all applicable laws.
          </p>
        </div>
      </section>
    </main>
  );
}
