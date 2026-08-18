import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  }
};

export default function Home() {
  return (
    <main>
      <section className="hero" id="top">
        <p className="eyebrow">Shopify → Pagevelope → Klaviyo</p>
        <h1>Campaign production, without inbox roulette.</h1>
        <p className="heroCopy">
          Build studio-grade email campaigns for your Shopify brand with safe motion, real inbox testing, client approval,
          and traceable publishing direct to Klaviyo. Designed for email designers, agencies, and elite ecommerce teams.
        </p>
        <div className="actions">
          <Link className="primaryButton" href="/signup">Start designing for free</Link>
          <Link className="secondaryButton" href="/features">Explore features</Link>
        </div>
      </section>

      <section className="statusGrid" aria-label="Core features">
        <article className="statusCard">
          <span>Design visually</span>
          <strong>Professional builder</strong>
          <p>Block library, layers, constrained canvas, properties, and strict schema-validated JSON under the hood. Stop fighting broken HTML.</p>
        </article>
        <article className="statusCard">
          <span>Safe motion</span>
          <strong>Animated assets</strong>
          <p>Every motion asset requires an animated output and a meaningful first frame fallback. No more broken GIFs ruining your brand.</p>
        </article>
        <article className="statusCard">
          <span>Publish confidently</span>
          <strong>Inbox Lab & Approvals</strong>
          <p>Visual testing across major clients. Approvals attach to immutable versions. Publishing to Klaviyo fails closed if blocking QA issues remain.</p>
        </article>
      </section>

      <section className="roadmap">
        <div>
          <p className="eyebrow">The Pagevelope Standard</p>
          <h2>Stop guessing. Start knowing.</h2>
        </div>
        <div className="rules" style={{ margin: 0 }}>
          <p>
            Whether you are an agency managing multiple Shopify clients, or an in-house team trying to elevate your design, Pagevelope gives you the tools to stop worrying about code and start focusing on conversion.
          </p>
          <div className="actions" style={{ marginTop: '24px' }}>
            <Link className="primaryButton" href="/use-cases">See use cases</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
