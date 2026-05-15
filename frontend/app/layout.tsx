import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KairosCRM",
  description: "CRM de conversas e automacao com IA para WhatsApp e Instagram"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
