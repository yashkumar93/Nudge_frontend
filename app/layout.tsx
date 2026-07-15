import type { Metadata } from "next";
import "./globals.css";
import Header from "../components/Header";

export const metadata: Metadata = {
  title: "Sentrix",
  description: "Sentrix turns your WhatsApp order chat into an intelligent, self-learning order monitoring system — without replacing you"

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
