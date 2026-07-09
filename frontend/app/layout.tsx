import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Sistema "Kairos Light" — uma única família (Inter) para UI e títulos.
// A distinção dos títulos vem de peso e tracking, não de uma segunda fonte.
// Fonte variável (sem `weight`): cobre toda a faixa 100–900, então pesos
// intermediários como 450/650 usados no globals.css são renderizados de verdade.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap"
});

export const metadata: Metadata = {
  title: "KairosCRM",
  description: "CRM de conversas e automação com IA para WhatsApp e Instagram"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} data-theme="light">
      <body>{children}</body>
    </html>
  );
}
