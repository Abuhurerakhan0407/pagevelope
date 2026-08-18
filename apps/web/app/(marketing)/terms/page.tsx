export const metadata = {
  title: "Terms of Service | Pagevelope",
};

export default function TermsPage() {
  return (
    <main className="container" style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Terms of Service</h1>
      <p>Last updated: [DATE]</p>
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using Pagevelope, you accept and agree to be bound by the terms and provision of this agreement.</p>
      </section>
      <section>
        <h2>2. Description of Service</h2>
        <p>Pagevelope provides an email campaign builder for Shopify and Klaviyo.</p>
      </section>
      <section>
        <h2>3. User Responsibilities</h2>
        <p>You are responsible for any content you create using our service and must comply with our Acceptable Use Policy.</p>
      </section>
      <section>
        <h2>4. Contact Information</h2>
        <p>For any questions regarding these Terms, please contact us at [CONTACT EMAIL].</p>
      </section>
    </main>
  );
}
