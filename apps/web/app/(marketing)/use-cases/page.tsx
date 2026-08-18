import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Use Cases',
  description: 'See how Pagevelope helps agencies, Shopify brands, and email designers create better campaigns faster.',
  alternates: {
    canonical: "/use-cases",
  }
};

export default function UseCasesPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Who it&apos;s for</p>
        <h1>Built for the email elite.</h1>
        <p className="heroCopy">
          Discover how teams are using Pagevelope to streamline their email production pipeline and deliver superior results.
        </p>
      </section>

      <section className="roadmap">
        <div>
          <h2>For Agencies</h2>
          <p className="heroCopy" style={{ marginTop: '16px', fontSize: '16px' }}>
            Manage multiple client brands with ease. Our workspace model keeps assets and templates isolated, while the visual builder lets junior designers create campaigns that meet senior technical standards.
          </p>
        </div>
        <div>
          <h2>For Shopify Brands</h2>
          <p className="heroCopy" style={{ marginTop: '16px', fontSize: '16px' }}>
            Stop wrestling with Klaviyo&apos;s default editor. Create visually stunning product drops that render perfectly in every inbox, ensuring your brand always looks premium.
          </p>
        </div>
      </section>

      <section className="roadmap" style={{ paddingTop: '0' }}>
         <div>
          <h2>For Email Designers</h2>
          <p className="heroCopy" style={{ marginTop: '16px', fontSize: '16px' }}>
            Finally, a tool that understands your workflow. Design visually, but retain control over padding, mobile stacking, and semantic structure without writing a single line of table HTML.
          </p>
        </div>
        <div>
          <h2>For Ecommerce Teams</h2>
          <p className="heroCopy" style={{ marginTop: '16px', fontSize: '16px' }}>
            Speed up your go-to-market. The built-in approval workflow means no more chasing sign-offs in Slack. Everyone sees the final, tested version before it goes live.
          </p>
        </div>
      </section>

      <section className="rules">
        <div style={{ textAlign: 'center' }}>
          <h2>Join the leading teams</h2>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="primaryButton" href="/auth/sign-up">Get Started Today</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
