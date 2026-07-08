import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Corpo/UI — ver "Note on Font Substitutes" em prompt/design-system.md §3
// para o histórico do sistema anterior (Vodafone/Inter único).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap"
});

// Títulos — reskin "Leona Flow" (dark glass, violeta/magenta/ciano).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap"
});

export const metadata: Metadata = {
  title: "KairosCRM",
  description: "CRM de conversas e automacao com IA para WhatsApp e Instagram"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`} data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
