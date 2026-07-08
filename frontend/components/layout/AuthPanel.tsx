"use client";

import { ReactNode } from "react";

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
    <main className="grid min-h-screen bg-transparent lg:grid-cols-[440px_1fr]">
      <section className="flex min-h-[44vh] flex-col justify-between bg-gradient-to-br from-[#1a1030] via-[#2b1547] to-[#3b1330] p-8 text-white lg:min-h-screen">
        <div className="flex items-center gap-3">
          <span className="icon-tile-red flex h-11 w-11 items-center justify-center rounded-card text-xl font-bold">K</span>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">KairosCRM</p>
            <p className="text-sm text-white/64">CRM para canais digitais</p>
          </div>
        </div>

        <div className="max-w-[360px] py-12 lg:py-0">
          <p className="eyebrow mb-5 text-[#a78bfa]">Atendimento e automação</p>
          <h1 className="display-title text-[2.15rem] text-white sm:text-[2.5rem]">
            Gerencie conversas, agentes e integrações com clareza operacional.
          </h1>
        </div>

        <div className="hidden border-t border-white/12 pt-6 text-sm text-white/72 lg:block">
          <p>WhatsApp via Evolution API</p>
          <p className="mt-3">Instagram via Meta</p>
          <p className="mt-3">Agentes com automações</p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-transparent p-5">
        <div className="surface-card surface-glow w-full max-w-[448px] p-7">
          <p className="eyebrow mb-3">{subtitle}</p>
          <h2 className="heading-xl mb-6">{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}
