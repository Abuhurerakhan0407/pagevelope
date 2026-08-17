import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Templates & Examples',
  description: 'Explore high-converting, professional email templates built for Shopify product drops, newsletters, and promotional campaigns.',
  alternates: {
    canonical: "/templates",
  }
};

export default function TemplatesPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Inspiration & Starting Points</p>
        <h1>Start with a solid foundation.</h1>
        <p className="heroCopy">
          Don&apos;t start from a blank canvas. Our templates are structurally sound, rigorously tested, and designed for conversion.
        </p>
      </section>

      <section className="statusGrid">
        <article className="statusCard">
          <span>E-commerce</span>
          <strong>The Product Drop</strong>
          <p>A highly visual, motion-first template designed to announce new collections. Features a bold hero section and elegant product grids.</p>
        </article>

        <article className="statusCard">
          <span>Editorial</span>
          <strong>The Brand Newsletter</strong>
          <p>Perfect for storytelling. Balances rich imagery with readable typography, ensuring your brand narrative shines through.</p>
        </article>

        <article className="statusCard">
          <span>Promotional</span>
          <strong>The Flash Sale</strong>
          <p>Urgency-driven design with clear, unambiguous calls to action. Optimized for mobile quick-taps and high conversion rates.</p>
        </article>
      </section>

      <section className="rules">
        <div style={{ textAlign: 'center' }}>
          <h2>Customize these in the Visual Builder</h2>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="primaryButton" href="/signup">Try Templates Free</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
