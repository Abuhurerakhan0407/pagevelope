import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for teams building better emails. No payment processing required during launch.',
  alternates: {
    canonical: "/pricing",
  }
};

export default function PricingPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Launch Pricing</p>
        <h1>Pay for production, not contacts.</h1>
        <p className="heroCopy">
          Unlike your ESP, we don&apos;t charge you based on how many subscribers you have. Pay flat rates for the studio tools and QA limits you need.
        </p>
      </section>

      <section className="statusGrid">
        <article className="pricingCard statusCard">
          <div className="pricingHeader">
            <h3>Starter</h3>
            <div className="pricingPrice">$49<span>/mo</span></div>
          </div>
          <p>For independent designers and growing Shopify brands.</p>
          <ul className="pricingFeatures">
            <li>Visual Builder access</li>
            <li>5 Inbox Lab QA tests/mo</li>
            <li>Basic motion limits (10MB/mo)</li>
            <li>Direct Klaviyo publish</li>
            <li>1 Workspace</li>
          </ul>
          <Link className="secondaryButton" href="/auth/sign-up" style={{ width: '100%', marginTop: '24px' }}>Get Started</Link>
        </article>

        <article className="pricingCard statusCard" style={{ borderColor: 'var(--pv-primary)', boxShadow: '0 12px 30px rgba(111,92,251,.15)' }}>
          <div className="pricingHeader">
            <h3>Pro</h3>
            <div className="pricingPrice">$149<span>/mo</span></div>
          </div>
          <p>For elite e-commerce teams requiring rigorous testing.</p>
          <ul className="pricingFeatures">
            <li>Everything in Starter</li>
            <li><strong>50 Inbox Lab QA tests/mo</strong></li>
            <li>Advanced motion limits (50MB/mo)</li>
            <li>Approval workflows</li>
            <li>Shopify product integration</li>
            <li>3 Workspaces</li>
          </ul>
          <Link className="primaryButton" href="/auth/sign-up" style={{ width: '100%', marginTop: '24px' }}>Start Pro Trial</Link>
        </article>

        <article className="pricingCard statusCard">
          <div className="pricingHeader">
            <h3>Agency</h3>
            <div className="pricingPrice">$399<span>/mo</span></div>
          </div>
          <p>For agencies managing multiple clients and complex pipelines.</p>
          <ul className="pricingFeatures">
            <li>Everything in Pro</li>
            <li>Unlimited Inbox Lab QA tests</li>
            <li>Unlimited motion assets</li>
            <li>Custom ESP exports</li>
            <li>Unlimited Workspaces</li>
            <li>Client review portals</li>
          </ul>
          <Link className="secondaryButton" href="/contact" style={{ width: '100%', marginTop: '24px' }}>Contact Sales</Link>
        </article>
      </section>

      <section className="rules">
        <div style={{ textAlign: 'center' }}>
          <h2>Not sure which plan is right?</h2>
          <p>Start for free. No credit card required. Upgrade when you need more Inbox Lab tests or workspaces.</p>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="secondaryButton" href="/contact">Talk to our team</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
