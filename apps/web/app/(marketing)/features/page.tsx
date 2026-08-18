import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Explore the professional visual builder, motion studio, Inbox Lab QA, and Klaviyo publishing tools that power Pagevelope.',
  alternates: {
    canonical: "/features",
  }
};

export default function FeaturesPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Product Features</p>
        <h1>Everything you need for perfect emails.</h1>
        <p className="heroCopy">
          Pagevelope is built to handle the complexities of modern email design, testing, and deployment.
        </p>
      </section>

      <section className="statusGrid">
        <article className="statusCard">
          <span>Design</span>
          <strong>Visual Builder</strong>
          <p>A professional layer-based editor. Work visually with complete control over layout and typography. Outputs pristine, tested code automatically.</p>
        </article>

        <article className="statusCard">
          <span>Animation</span>
          <strong>Motion Studio</strong>
          <p>Add movement safely. Our engine ensures animated assets always fall back gracefully to a meaningful first frame for clients that don&apos;t support animation.</p>
        </article>

        <article className="statusCard">
          <span>Quality Assurance</span>
          <strong>Inbox Lab</strong>
          <p>See exactly how your campaign renders across major email clients and devices before you send. No more broken layouts.</p>
        </article>

        <article className="statusCard">
          <span>Deployment</span>
          <strong>Klaviyo Publish</strong>
          <p>Push campaigns directly into Klaviyo with one click. We ensure all assets are optimized and HTML is minified for perfect delivery.</p>
        </article>
      </section>

      <section className="roadmap">
         <div>
          <h2>Ready to upgrade your workflow?</h2>
          <div className="actions" style={{ marginTop: '24px' }}>
            <Link className="primaryButton" href="/auth/sign-up">Start Free Trial</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
