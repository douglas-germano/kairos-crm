"use client";

import { ReactNode } from "react";
import { Check } from "lucide-react";

const FEATURES = [
  "WhatsApp via Evolution API",
  "Instagram via Meta Cloud API",
  "Agentes de IA com fluxos automáticos",
  "Campanhas e disparos em massa"
];

export function AuthPanel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid min-h-screen bg-brand-canvas lg:grid-cols-[1fr_minmax(0,540px)]">
      {/* Painel de marca — só em telas grandes */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-brand-line bg-brand-white p-10 xl:p-14 lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-brand-red/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-brand-highlight/[0.06] blur-3xl" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-brand-red text-lg font-bold leading-none text-white">
            K
          </span>
          <div>
            <p className="font-display text-[17px] font-semibold leading-tight tracking-tight text-brand-ink">KairosCRM</p>
            <p className="text-sm text-brand-muted">CRM para canais digitais</p>
          </div>
        </div>

        <div className="relative max-w-[440px]">
          <p className="eyebrow mb-5 text-brand-red">kairós, subst. — o momento certo</p>
          <h1 className="display-title text-[2.5rem] leading-[1.1] text-brand-ink">
            O <span className="text-brand-red">momento certo</span> pra cada conversa, em todo canal.
          </h1>
          <p className="mt-5 max-w-[380px] text-[15px] leading-relaxed text-brand-muted">
            Centralize atendimento, automação com IA e campanhas de WhatsApp e Instagram em um só lugar.
          </p>
        </div>

        <ul className="relative space-y-3">
          {FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-3 text-sm text-brand-charcoal">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-red50 text-brand-red">
                <Check size={12} strokeWidth={3} />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </section>

      {/* Formulário */}
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-red text-base font-bold leading-none text-white">
              K
            </span>
            <span className="font-display text-lg font-semibold tracking-tight text-brand-ink">KairosCRM</span>
          </div>

          <div className="surface-card surface-glow p-7 sm:p-8">
            <p className="eyebrow mb-2">{subtitle}</p>
            <h2 className="heading-xl mb-6">{title}</h2>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
