export function AuthPanel({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="grid min-h-screen bg-[#f6f7f8] lg:grid-cols-[420px_1fr]">
      <section className="flex min-h-[260px] flex-col justify-between bg-white p-8 text-brand-charcoal lg:min-h-screen lg:border-r lg:border-black/10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-tight bg-brand-red text-lg font-black text-white">K</span>
          <div>
            <div className="text-lg font-black leading-none">KairosCRM</div>
            <div className="mt-1 text-sm text-brand-grey">CRM para canais digitais</div>
          </div>
        </div>
        <div className="my-10">
          <p className="mb-3 text-sm font-bold uppercase text-brand-red">Atendimento e automacao</p>
          <h1 className="max-w-sm text-3xl font-semibold leading-tight">Gerencie conversas, agentes e integracoes em um painel simples.</h1>
        </div>
        <div className="grid gap-3 border-t border-black/10 pt-5 text-sm text-brand-grey">
          <span>WhatsApp via Evolution API</span>
          <span>Instagram via Meta</span>
          <span>Agentes com automacoes</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md rounded-card border border-black/10 bg-white p-6">
          <div className="mb-6">
            <p className="mb-1 text-xs font-bold uppercase text-brand-grey">{subtitle}</p>
            <h2 className="text-2xl font-semibold leading-tight text-brand-charcoal">{title}</h2>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
