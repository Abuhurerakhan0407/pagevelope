import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Paid private-pilot access for teams building controlled Shopify and Klaviyo email campaigns.',
  alternates: {
    canonical: "/pricing",
  }
};

export default function PricingPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Private Pilot</p>
        <h1>Paid access. Controlled onboarding.</h1>
        <p className="heroCopy">
          Pagevelope is not offering a free tier or an automated trial. Pilot pricing and terms are confirmed before a workspace is activated.
        </p>
      </section>

      <section className="statusGrid">
        <article className="pricingCard statusCard">
          <div className="pricingHeader">
            <h3>Pilot access</h3>
          </div>
          <p>For Shopify brands, email designers, and agencies validating the complete production workflow.</p>
          <ul className="pricingFeatures">
            <li>Constrained visual builder</li>
            <li>Shopify product import</li>
            <li>Email-safe motion fallbacks</li>
            <li>Immutable versions and approvals</li>
            <li>Single-recipient test delivery</li>
            <li>Controlled Klaviyo template publishing</li>
          </ul>
          <Link className="primaryButton" href="/contact" style={{ width: '100%', marginTop: '24px' }}>Request pilot access</Link>
        </article>

        <article className="pricingCard statusCard">
          <div className="pricingHeader">
            <h3>Before activation</h3>
          </div>
          <p>Every pilot requires explicit commercial and operational approval.</p>
          <ul className="pricingFeatures">
            <li>Plan and price confirmed in writing</li>
            <li>Refund terms confirmed in writing</li>
            <li>Workspace activated after payment</li>
            <li>One controlled release at a time</li>
            <li>Campaign sending remains in Klaviyo</li>
          </ul>
          <Link className="secondaryButton" href="/contact" style={{ width: '100%', marginTop: '24px' }}>Discuss pilot terms</Link>
        </article>
      </section>

      <section className="rules">
        <div style={{ textAlign: 'center' }}>
          <h2>Need account access?</h2>
          <p>Create an account, then contact us to confirm paid pilot activation. Unpaid workspaces remain read-only.</p>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="secondaryButton" href="/auth/sign-up">Create account</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
