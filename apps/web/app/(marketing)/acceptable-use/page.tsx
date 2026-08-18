export const metadata = {
  title: "Acceptable Use Policy | Pagevelope",
};

export default function AcceptableUsePage() {
  return (
    <main className="container" style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Acceptable Use Policy</h1>
      <p>Last updated: [DATE]</p>
      <section>
        <h2>1. Prohibited Uses</h2>
        <p>You may not use Pagevelope to send spam, unsolicited emails, or content that is illegal, abusive, or harmful.</p>
      </section>
      <section>
        <h2>2. Compliance with Laws</h2>
        <p>You must comply with all applicable laws, including but not limited to the CAN-SPAM Act, GDPR, and other anti-spam legislation.</p>
      </section>
      <section>
        <h2>3. Enforcement</h2>
        <p>We reserve the right to suspend or terminate accounts that violate this policy.</p>
      </section>
      <section>
        <h2>4. Contact Us</h2>
        <p>If you have any questions about this Acceptable Use Policy, please contact us at [CONTACT EMAIL].</p>
      </section>
    </main>
  );
}
