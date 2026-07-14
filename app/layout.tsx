import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";

export const metadata: Metadata = {
  title: "Nudge — Structured Ingestion & Audit Ledger",
  description: "Sleek, high-density structured order extraction and human-in-the-loop auditing for WhatsApp B2B wholesale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="ink">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
