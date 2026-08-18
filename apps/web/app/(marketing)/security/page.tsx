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
          <p style={{ marginTop: '16px' }}>Last Updated: January 1, 2024</p>
          <p style={{ marginTop: '16px' }}>
            We take security seriously. All data is encrypted in transit and at rest. We regularly audit our infrastructure and adhere to industry standard security protocols to protect your campaigns and workspace data.
          </p>
        </div>
      </section>
    </main>
  );
}
