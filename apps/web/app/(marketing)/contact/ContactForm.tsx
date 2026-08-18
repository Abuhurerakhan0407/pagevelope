'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = `Name: ${name}%0AEmail: ${email}%0A%0A${message}`;
    window.location.href = `mailto:hello@pagevelope.com?subject=Contact Inquiry&body=${body}`;
  };

  return (
    <div className="rules" style={{ margin: '0' }}>
      <h2>Contact Sales</h2>
      <form className="contactForm" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }} onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="name" style={{ fontSize: '14px', fontWeight: 'bold' }}>Name</label>
          <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--pv-line)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="email" style={{ fontSize: '14px', fontWeight: 'bold' }}>Work Email</label>
          <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com" style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--pv-line)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label htmlFor="message" style={{ fontSize: '14px', fontWeight: 'bold' }}>How can we help?</label>
          <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="I'm interested in the Agency plan for 5 clients..." style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--pv-line)', resize: 'vertical' }}></textarea>
        </div>
        <button className="primaryButton" style={{ marginTop: '12px', cursor: 'pointer', border: 'none' }} type="submit">Send Message</button>
      </form>
    </div>
  );
}
