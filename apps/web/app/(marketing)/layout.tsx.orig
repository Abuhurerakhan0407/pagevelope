import type { Metadata } from "next";
import "../globals.css";
import Link from "next/link";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Pagevelope home">
          <span className="brandMark">P</span>
          <span>Pagevelope</span>
        </Link>
        <nav className="desktopNav">
          <Link href="/features">Features</Link>
          <Link href="/use-cases">Use Cases</Link>
          <Link href="/integrations">Integrations</Link>
          <Link href="/templates">Templates</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="navActions">
          <Link href="/login" className="textLink">Log in</Link>
          <Link href="/signup" className="primaryButton">Start Free</Link>
        </div>
      </header>

      {children}

      <footer className="footer">
        <div className="footerContent">
          <div className="footerBrand">
            <Link href="/" className="brand" aria-label="Pagevelope home">
              <span className="brandMark">P</span>
              <span>Pagevelope</span>
            </Link>
            <p>Studio-grade email campaigns for Shopify & Klaviyo.</p>
          </div>

          <div className="footerLinks">
            <div className="footerCol">
              <strong>Product</strong>
              <Link href="/features">Features</Link>
              <Link href="/integrations">Integrations</Link>
              <Link href="/templates">Templates</Link>
              <Link href="/pricing">Pricing</Link>
            </div>
            <div className="footerCol">
              <strong>Solutions</strong>
              <Link href="/use-cases">Agencies</Link>
              <Link href="/use-cases">Shopify Brands</Link>
              <Link href="/use-cases">Email Designers</Link>
            </div>
            <div className="footerCol">
              <strong>Company</strong>
              <Link href="/contact">Contact Sales</Link>
              <Link href="/faq">FAQ</Link>
            </div>
          </div>
        </div>
        <div className="footerBottom">
          <p>&copy; {new Date().getFullYear()} Pagevelope. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
