import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore Pagevelope visual authoring, motion evidence, inbox review, and controlled Klaviyo template publishing.',
  alternates: {
    canonical: "/features",
  }
};

export default function FeaturesPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Product Features</p>
        <h1>A controlled path to approved email assets.</h1>
        <p className="heroCopy">
          Pagevelope connects structured design, release evidence, human approval, and template publishing without taking over campaign sending.
        </p>
      </section>

      <section className="statusGrid">
        <article className="statusCard">
          <span>Design</span>
          <strong>Visual Builder</strong>
          <p>A constrained block editor backed by versioned campaign JSON and deterministic MJML-derived HTML and plain text.</p>
        </article>

        <article className="statusCard">
          <span>Animation</span>
          <strong>Motion Studio</strong>
          <p>Upload measured animated assets with a separate meaningful first frame for clients that do not support animation.</p>
        </article>

        <article className="statusCard">
          <span>Quality Assurance</span>
          <strong>Inbox evidence</strong>
          <p>Attach real Gmail, Apple Mail, and Outlook evidence to the exact immutable release before approval.</p>
        </article>

        <article className="statusCard">
          <span>Deployment</span>
          <strong>Klaviyo Publish</strong>
          <p>Publish an approved CODE template and preserve its provider receipt. Campaign configuration and sending stay in Klaviyo.</p>
        </article>
      </section>

      <section className="roadmap">
         <div>
          <h2>Ready to upgrade your workflow?</h2>
          <div className="actions" style={{ marginTop: '24px' }}>
            <Link className="primaryButton" href="/contact">Request pilot access</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
