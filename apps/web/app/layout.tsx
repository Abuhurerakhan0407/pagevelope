import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pagevelope.com"),
  title: {
    default: "Pagevelope | Studio-Grade Email Campaign Production",
    template: "%s | Pagevelope"
  },
  description: "Turn a Shopify product drop into a studio-grade Klaviyo campaign with safe motion, approvals, inbox testing, and production-ready publishing.",
  keywords: ["email design", "klaviyo campaigns", "shopify emails", "ecommerce marketing", "email builder"],
  authors: [{ name: "Pagevelope" }],
  openGraph: {
    title: "Pagevelope | Studio-Grade Email Campaign Production",
    description: "Build professional, animated, email-safe campaigns designed visually, tested across inboxes, and published to Klaviyo.",
    url: "https://pagevelope.com",
    siteName: "Pagevelope",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pagevelope | Studio-Grade Email Campaign Production",
    description: "Build professional, animated, email-safe campaigns designed visually, tested across inboxes, and published to Klaviyo.",
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
