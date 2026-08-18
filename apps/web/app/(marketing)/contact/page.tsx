import { Metadata } from 'next';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Pagevelope team for support, sales inquiries, or partnership opportunities.',
  alternates: {
    canonical: "/contact",
  }
};

export default function ContactPage() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Get in touch</p>
        <h1>Let&apos;s build better emails together.</h1>
        <p className="heroCopy">
          Whether you need help setting up your workspace, have questions about the Agency plan, or just want to talk shop, our team is here.
        </p>
      </section>

      <section className="roadmap" style={{ paddingTop: '0' }}>
        <ContactForm />

        <div>
           <h2>Other Ways to Connect</h2>
           <div style={{ marginTop: '24px' }}>
             <h3 style={{ fontSize: '18px', margin: '0 0 8px 0' }}>Support</h3>
             <p style={{ color: 'var(--pv-muted)', margin: '0 0 24px 0', lineHeight: '1.6' }}>Current customers can reach our technical support team directly through the dashboard widget.</p>
           </div>
        </div>
      </section>
    </main>
  );
}
