export function AuthPanel({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return (
    <main className="app-canvas flex min-h-screen items-center justify-center p-5 sm:p-8">
      <section className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="font-serif text-[34px] font-bold leading-none text-brand-ink">
            Kairos
          </div>
        </div>
        <div className="surface-card w-full rounded-panel p-6 sm:p-7">
          <div className="mb-6 text-center">
            <p className="eyebrow mb-2">{subtitle}</p>
            <h1 className="heading-xl">{title}</h1>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
