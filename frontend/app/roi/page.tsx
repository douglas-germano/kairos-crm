"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mesma premissa usada na calculadora de impacto do Leona Flow: sem automação a
// conversão de leads gira em torno de 2%; com atendimento instantâneo 24/7 e
// recuperação automática de carrinho, sobe para ~12,5%.
const CONVERSION_WITHOUT_AUTOMATION = 0.02;
const CONVERSION_WITH_KAIROS = 0.125;
const DEFAULT_LEADS = 10_000;
const DEFAULT_TICKET = 150;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0
});

const integer = new Intl.NumberFormat("pt-BR");

export default function RoiCalculatorPage() {
  const [leads, setLeads] = useState(DEFAULT_LEADS);
  const [ticket, setTicket] = useState(DEFAULT_TICKET);

  const result = useMemo(() => {
    const safeLeads = Math.max(0, leads);
    const safeTicket = Math.max(0, ticket);
    const salesWithout = Math.round(safeLeads * CONVERSION_WITHOUT_AUTOMATION);
    const salesWith = Math.round(safeLeads * CONVERSION_WITH_KAIROS);
    const revenueWithout = salesWithout * safeTicket;
    const revenueWith = salesWith * safeTicket;
    return {
      salesWithout,
      salesWith,
      revenueWithout,
      revenueWith,
      gain: revenueWith - revenueWithout
    };
  }, [leads, ticket]);

  return (
    <main className="min-h-screen bg-transparent">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="icon-tile-red flex h-9 w-9 items-center justify-center rounded-card text-lg font-bold leading-none text-white">
            K
          </span>
          <span className="font-display text-lg font-semibold text-brand-ink">KairosCRM</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Criar conta grátis</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-4 pt-10 text-center sm:pt-16">
        <p className="eyebrow mb-4 justify-center text-brand-red" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Sparkles size={13} /> Calculadora de impacto
        </p>
        <h1 className="display-title text-balance text-[2rem] text-brand-ink sm:text-[2.75rem]">
          Quanto você perde <span className="text-gradient-brand">sem automação?</span>
        </h1>
        <p className="body-muted mx-auto mt-4 max-w-xl text-[15px]">
          Leads que esperam resposta desistem. Carrinhos abandonados não voltam sozinhos.
          Simule o impacto de atendimento instantâneo 24/7 no seu volume de contatos.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div className="surface-card surface-glow rounded-panel p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="roi-leads">Leads / contatos por mês</Label>
              <Input
                id="roi-leads"
                type="number"
                min={0}
                step={100}
                value={leads}
                onChange={(event) => setLeads(Number(event.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roi-ticket">Ticket médio (R$)</Label>
              <Input
                id="roi-ticket"
                type="number"
                min={0}
                step={10}
                value={ticket}
                onChange={(event) => setTicket(Number(event.target.value) || 0)}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-panel border border-brand-line bg-brand-white p-5">
              <div className="mb-3 flex items-center gap-2 text-brand-muted">
                <TrendingDown size={16} />
                <span className="ui-label">Sem automação</span>
              </div>
              <p className="font-display text-2xl font-semibold text-brand-ink">
                {currency.format(result.revenueWithout)}
              </p>
              <p className="body-muted mt-1">faturamento potencial/mês</p>
              <div className="mt-4 space-y-1 text-sm text-brand-muted">
                <p>~{integer.format(result.salesWithout)} vendas ({(CONVERSION_WITHOUT_AUTOMATION * 100).toFixed(0)}% de conversão)</p>
                <p>Resposta lenta = lead frio</p>
                <p>Carrinhos perdidos</p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-panel border border-brand-red200 bg-brand-red50 p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-highlight/10 blur-2xl" />
              <div className="relative mb-3 flex items-center gap-2 text-brand-red">
                <TrendingUp size={16} />
                <span className="ui-label text-brand-red">Com Kairos</span>
              </div>
              <p className="relative font-display text-2xl font-semibold text-brand-ink">
                {currency.format(result.revenueWith)}
              </p>
              <p className="relative mt-1 font-semibold text-gradient-brand">
                +{currency.format(result.gain)} em vendas
              </p>
              <div className="mt-4 space-y-1 text-sm text-brand-muted">
                <p>~{integer.format(result.salesWith)} vendas ({(CONVERSION_WITH_KAIROS * 100).toFixed(1)}% de conversão)</p>
                <p>Resposta instantânea 24/7</p>
                <p>Recuperação automática de carrinho</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col items-center gap-3 border-t border-brand-line pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-xs text-brand-muted">
              * Simulação baseada nas taxas de conversão médias observadas antes/depois de automação
              de atendimento. Resultados variam por segmento e operação.
            </p>
            <Button asChild size="lg" className="w-full shrink-0 sm:w-auto">
              <Link href="/register">
                Criar conta grátis <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
