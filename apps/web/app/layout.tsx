import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pagevelope",
  description: "Studio-grade Klaviyo campaign production with safe motion, QA, approvals, and controlled publishing."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
