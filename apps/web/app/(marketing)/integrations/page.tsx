import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Integrations',
  description: 'Connect Pagevelope seamlessly to Klaviyo, Shopify, and standard ESPs for frictionless email campaign deployment.',
  alternates: {
    canonical: "/integrations",
  }
};

export default function IntegrationsPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Connect Your Stack</p>
        <h1>Plays nicely with your tools.</h1>
        <p className="heroCopy">
          Pagevelope isn&apos;t another CRM. It&apos;s a production layer that feeds directly into the marketing tools you already use and trust.
        </p>
      </section>

      <section className="statusGrid">
        <article className="statusCard">
          <span>Primary Destination</span>
          <strong>Klaviyo</strong>
          <p>One-click publish straight to your Klaviyo account as a fully functional, editable template. Complete with tracked links and optimized assets.</p>
        </article>

        <article className="statusCard">
          <span>E-commerce Native</span>
          <strong>Shopify</strong>
          <p>Easily pull product data, imagery, and pricing directly into your campaigns without manually downloading and re-uploading assets.</p>
        </article>

        <article className="statusCard">
          <span>Universal Export</span>
          <strong>Standard ESPs</strong>
          <p>Need to use Mailchimp, Omnisend, or Braze? Export your approved campaigns as production-ready HTML packages compatible with any standard ESP.</p>
        </article>
      </section>

      <section className="roadmap">
         <div>
          <h2>Ready to streamline your workflow?</h2>
          <div className="actions" style={{ marginTop: '24px' }}>
            <Link className="primaryButton" href="/signup">Connect Your Account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
