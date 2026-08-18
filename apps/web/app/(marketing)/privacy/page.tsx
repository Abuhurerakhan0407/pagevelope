export const metadata = {
  title: "Privacy Policy | Pagevelope",
};

export default function PrivacyPage() {
  return (
    <main className="container" style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Privacy Policy</h1>
      <p>Last updated: [DATE]</p>
      <section>
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly to us, such as when you create an account, or contact us for support.</p>
      </section>
      <section>
        <h2>2. How We Use Information</h2>
        <p>We use the information we collect to provide, maintain, and improve our services, and to communicate with you.</p>
      </section>
      <section>
        <h2>3. Data Sharing</h2>
        <p>We do not share your personal information with third parties except as described in this policy.</p>
      </section>
      <section>
        <h2>4. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at [CONTACT EMAIL].</p>
      </section>
    </main>
  );
}
