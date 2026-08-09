import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MERIDIAN 10 — Autonomous Trade OS", template: "%s | MERIDIAN 10" },
  description: "A Level 10 synthetic demonstration of an autonomous foreign-trade operating system: lead discovery, due diligence, quotes, trade documents, fulfillment, suppliers, inventory, finance, compliance and durable workflows.",
  applicationName: "MERIDIAN 10",
  keywords: ["foreign trade", "autonomous operations", "supply chain", "trade documents", "workflow"],
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123139",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
