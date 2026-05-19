import { ReactNode } from "react";
import { MessageSquare, Zap, Bot } from "lucide-react";

const features = [
  { icon: MessageSquare, text: "WhatsApp via Evolution API" },
  { icon: Zap, text: "Instagram via Meta Cloud API" },
  { icon: Bot, text: "Agentes com automação inteligente" },
];

export function AuthPanel({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[500px_1fr]">
      {/* Left panel */}
      <section className="relative hidden overflow-hidden bg-brand-charcoal lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-[480px] w-[480px] rounded-full bg-brand-red opacity-[0.13] blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-32 -left-12 h-[380px] w-[380px] rounded-full bg-brand-red opacity-[0.07] blur-[110px]" />

        <div className="relative z-10 flex items-center gap-3">
          <span className="icon-tile icon-tile-red h-10 w-10 text-base font-black">K</span>
          <div>
            <div className="text-base font-black leading-none text-white">KairosCRM</div>
            <div className="mt-0.5 text-xs text-white/50">CRM para canais digitais</div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="mb-4 text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-brand-red">
            Atendimento e automação
          </p>
          <h1 className="max-w-[340px] text-[2.8rem] font-black leading-[1.03] tracking-tight text-white">
            Gerencie conversas, agentes e integrações com clareza.
          </h1>
        </div>

        <div className="relative z-10 space-y-3 border-t border-white/10 pt-8">
          {features.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-4 w-4 text-white/70" />
              </span>
              <span className="text-sm font-semibold text-white/65">{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Right panel */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span className="icon-tile icon-tile-red h-9 w-9 text-sm font-black">K</span>
          <span className="text-base font-black text-brand-ink">KairosCRM</span>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="mb-8">
            <p className="eyebrow mb-2">{subtitle}</p>
            <h2 className="heading-xl">{title}</h2>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
