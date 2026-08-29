import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Templates & Examples',
  description: 'Explore controlled campaign starting points for Shopify product launches, collections, restocks, offers, and lifecycle reminders.',
  alternates: {
    canonical: "/templates",
  }
};

export default function TemplatesPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Campaign Systems</p>
        <h1>Start from a controlled brief.</h1>
        <p className="heroCopy">
          Select products, complete the brief, choose a direction, then save an immutable campaign version before release review.
        </p>
      </section>

      <section className="statusGrid">
        <article className="statusCard">
          <span>Launch</span>
          <strong>Product launch</strong>
          <p>Build from selected Shopify or manual products with a structured goal, audience, offer, tone, and motion level.</p>
        </article>

        <article className="statusCard">
          <span>Editorial</span>
          <strong>Collection editorial</strong>
          <p>Shape a collection story through one of three persisted creative directions before entering the builder.</p>
        </article>

        <article className="statusCard">
          <span>Lifecycle</span>
          <strong>Restock, offer, reminder</strong>
          <p>Use the same versioned workflow for restock waitlists, limited offers, and lifecycle reminders.</p>
        </article>
      </section>

      <section className="rules">
        <div style={{ textAlign: 'center' }}>
          <h2>Build a paid pilot campaign</h2>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="primaryButton" href="/contact">Request pilot access</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
