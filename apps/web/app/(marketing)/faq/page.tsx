import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Frequently asked questions about Pagevelope, our Klaviyo integration, and how we handle email QA.',
  alternates: {
    canonical: "/faq",
  }
};

const faqs = [
  {
    question: "Do I need to send my emails through Pagevelope?",
    answer: "No. Pagevelope is a production and QA tool. You build, animate, and test your emails in Pagevelope, and then we publish them directly to your Klaviyo account (or standard ESP) to send to your lists."
  },
  {
    question: "Does this replace my Klaviyo templates?",
    answer: "Pagevelope generates standard Klaviyo templates that you can use in your Flows and Campaigns. It's meant to replace the Klaviyo drag-and-drop editor for high-end, complex campaigns where you need visual precision and rigorous QA."
  },
  {
    question: "What does 'fails closed' mean for publishing?",
    answer: "If our Inbox Lab detects critical rendering failures for your campaign across major clients, we block publishing to Klaviyo until the issues are resolved. We believe in preventing broken emails from reaching your customers."
  },
  {
    question: "How do animations work?",
    answer: "Our motion engine generates animated assets (like GIFs) but automatically creates a robust HTML fallback displaying a meaningful first frame for clients that block animations, ensuring your message is always delivered."
  }
];

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="hero">
        <p className="eyebrow">Questions & Answers</p>
        <h1>Frequently Asked Questions</h1>
        <p className="heroCopy">
          Everything you need to know about how Pagevelope fits into your email production workflow.
        </p>
      </section>

      <section className="roadmap" style={{ paddingTop: '0', display: 'block', maxWidth: '800px', margin: '0 auto' }}>
        <div className="faqList">
          {faqs.map((faq, index) => (
            <div key={index} className="faqItem" style={{ marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--pv-line)' }}>
              <h3 style={{ fontSize: '20px', margin: '0 0 12px 0' }}>{faq.question}</h3>
              <p style={{ color: 'var(--pv-muted)', margin: '0', lineHeight: '1.6' }}>{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rules" style={{ marginTop: '64px' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Still have questions?</h2>
          <div className="actions" style={{ justifyContent: 'center', marginTop: '24px' }}>
            <Link className="primaryButton" href="/contact">Contact Support</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
