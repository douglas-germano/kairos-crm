import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Substituto de código aberto para a tipografia Vodafone proprietária —
// ver "Note on Font Substitutes" em prompt/design-system.md §3.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "KairosCRM",
  description: "CRM de conversas e automacao com IA para WhatsApp e Instagram"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
