export const metadata = {
  title: "Refund & Cancellation Policy | Pagevelope",
};

export default function RefundPage() {
  return (
    <main className="container" style={{ padding: "4rem 2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Refund & Cancellation Policy</h1>
      <p>Last updated: [DATE]</p>
      <section>
        <h2>1. Cancellations</h2>
        <p>You can cancel your subscription at any time. Your cancellation will take effect at the end of the current paid term.</p>
      </section>
      <section>
        <h2>2. Refunds</h2>
        <p>Refunds are considered on a case-by-case basis and granted at our sole discretion.</p>
      </section>
      <section>
        <h2>3. Contact Us</h2>
        <p>To request a refund or if you have questions, please contact us at [CONTACT EMAIL].</p>
      </section>
    </main>
  );
}
