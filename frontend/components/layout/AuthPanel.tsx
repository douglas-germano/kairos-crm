export function AuthPanel({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="app-canvas grid min-h-screen lg:grid-cols-[440px_1fr]">
      <section className="flex min-h-[280px] flex-col justify-between border-b border-brand-line bg-brand-charcoal p-8 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center gap-3">
          <span className="icon-tile icon-tile-red h-11 w-11 text-lg font-black">K</span>
          <div>
            <div className="text-lg font-black leading-none">KairosCRM</div>
            <div className="mt-1 text-sm text-white/60">CRM para canais digitais</div>
          </div>
        </div>
        <div className="my-10">
          <p className="mb-4 text-xs font-extrabold uppercase text-red-200">Atendimento e automacao</p>
          <h1 className="max-w-sm text-4xl font-black leading-[1.02]">Gerencie conversas, agentes e integracoes com clareza operacional.</h1>
        </div>
        <div className="grid gap-3 border-t border-white/15 pt-5 text-sm font-semibold text-white/70">
          <span>WhatsApp via Evolution API</span>
          <span>Instagram via Meta</span>
          <span>Agentes com automacoes</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="surface-card w-full max-w-md rounded-panel p-6 sm:p-7">
          <div className="mb-6">
            <p className="eyebrow mb-2">{subtitle}</p>
            <h2 className="heading-xl">{title}</h2>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
