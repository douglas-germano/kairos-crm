"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Bot, Brain, MessageCircle, Plus, SlidersHorizontal, Sparkles, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import { useAgents } from "@/hooks/useAgent";
import type { Agent, Channel } from "@/lib/types";

export default function AgentsPage() {
  const { data: agents = [], isLoading, mutate } = useAgents();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["whatsapp", "instagram"]);
  const [temperature, setTemperature] = useState(0.7);

  async function createAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch<Agent>("/api/agents", {
      method: "POST",
      body: JSON.stringify({ name, system_prompt: systemPrompt, channels, temperature, enabled: true }),
    });
    setName("");
    setSystemPrompt("");
    setTemperature(0.7);
    setShowForm(false);
    await mutate();
  }

  async function toggleAgent(agent: Agent, enabled: boolean) {
    await apiFetch(`/api/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    await mutate();
  }

  function toggleChannel(channel: Channel) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Automacao"
        title="Agentes"
        description="Configure personalidade, canais e fluxo de resposta dos agentes."
        action={
          <Button onClick={() => setShowForm(true)}>
            <Plus size={17} />
            Novo agente
          </Button>
        }
      />

      <div className="section-pad">
        <section className="grid gap-4 xl:grid-cols-2">
          {isLoading && <p className="body-muted">Carregando agentes</p>}

          {agents.map((agent) => (
            <article key={agent.id} className="surface-card overflow-hidden rounded-panel">
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="icon-tile icon-tile-red">
                    <Bot size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="card-title truncate">{agent.name}</h2>
                      <Badge tone={agent.enabled ? "green" : "neutral"}>
                        {agent.enabled ? "Ativo" : "Pausado"}
                      </Badge>
                    </div>
                    <p className="ui-meta mt-1 truncate">{agent.model}</p>
                  </div>
                </div>
                <Switch
                  checked={agent.enabled}
                  onCheckedChange={(checked) => void toggleAgent(agent, checked)}
                  aria-label="Ativar agente"
                />
              </div>

              <Separator />

              <div className="grid gap-4 p-4">
                <div className="surface-soft rounded-card p-3">
                  <div className="ui-label mb-2 flex items-center gap-2">
                    <Brain size={14} />
                    Prompt do agente
                  </div>
                  <p className="ui-body line-clamp-3 min-h-12">
                    {agent.system_prompt ||
                      "Sem prompt definido. Configure uma personalidade e regras de atendimento."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <ConfigStat icon={<MessageCircle size={15} />} label="Canais">
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {agent.channels.length ? (
                        agent.channels.map((ch) => (
                          <Badge key={ch} tone="red" className="px-2 py-0.5 text-[10px]">
                            {ch}
                          </Badge>
                        ))
                      ) : (
                        <span className="ui-meta">Nenhum</span>
                      )}
                    </div>
                  </ConfigStat>
                  <ConfigStat icon={<SlidersHorizontal size={15} />} label="Temperatura">
                    <div className="mt-2 text-lg font-black">{agent.temperature.toFixed(1)}</div>
                  </ConfigStat>
                  <ConfigStat icon={<Sparkles size={15} />} label="Status">
                    <div className="item-title mt-2">{agent.enabled ? "Respondendo" : "Pausado"}</div>
                  </ConfigStat>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-brand-line pt-4">
                  <p className="ui-meta">Edite o fluxo para definir gatilhos, mensagens e IA.</p>
                  <Link href={`/agents/${agent.id}/editor`}>
                    <Button variant="ghost" size="sm">
                      <Workflow size={15} />
                      Fluxo
                    </Button>
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {!isLoading && agents.length === 0 && (
            <div className="surface-card rounded-panel border-dashed p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-card bg-brand-canvas">
                <Bot size={22} />
              </div>
              <h2 className="card-title">Nenhum agente criado</h2>
              <p className="body-muted mx-auto mt-2 max-w-sm">
                Crie um agente para configurar canais, prompt e fluxo visual de atendimento.
              </p>
              <Button className="mt-5" onClick={() => setShowForm(true)}>
                <Plus size={17} />
                Novo agente
              </Button>
            </div>
          )}
        </section>
      </div>

      {/* Dialog de criação */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="icon-tile icon-tile-red">
                <Bot size={19} />
              </span>
              <div>
                <DialogTitle className="text-base">Novo agente</DialogTitle>
                <DialogDescription>Defina nome, canais e comportamento inicial.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={(e) => void createAgent(e)}>
            <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-name">Nome do agente</Label>
                  <p className="text-[11px] text-brand-muted">Nome interno para identificar o atendimento.</p>
                  <Input
                    id="agent-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Atendimento Advantage"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-prompt">Prompt de comportamento</Label>
                  <p className="text-[11px] text-brand-muted">Regras, tom de voz e limites da IA.</p>
                  <Textarea
                    id="agent-prompt"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Ex: Voce e um atendente consultivo. Responda curto, confirme dados importantes e encaminhe casos complexos para humano."
                    className="min-h-40"
                  />
                </div>
              </div>

              <aside className="surface-soft space-y-4 rounded-card p-4">
                <div className="space-y-1.5">
                  <Label>Canais</Label>
                  <p className="text-[11px] text-brand-muted">Onde este agente pode responder.</p>
                  <div className="grid gap-2 pt-1">
                    {(["whatsapp", "instagram"] as Channel[]).map((channel) => (
                      <button
                        type="button"
                        key={channel}
                        onClick={() => toggleChannel(channel)}
                        className={`focus-ring flex h-10 items-center justify-between rounded-card border px-3 text-sm font-bold transition-colors ${
                          channels.includes(channel)
                            ? "border-brand-red bg-brand-white text-brand-red"
                            : "border-brand-line bg-brand-white text-brand-ink"
                        }`}
                      >
                        <span>{channel === "whatsapp" ? "WhatsApp" : "Instagram"}</span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full transition-colors ${
                            channels.includes(channel) ? "bg-brand-red" : "bg-brand-lineStrong"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Criatividade</Label>
                  <p className="text-[11px] text-brand-muted">
                    Baixo para atendimento direto; alto para respostas mais livres.
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full accent-brand-red"
                  />
                  <div className="ui-meta flex items-center justify-between">
                    <span>Direto</span>
                    <strong className="text-brand-ink">{temperature.toFixed(1)}</strong>
                    <span>Criativo</span>
                  </div>
                </div>
              </aside>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar agente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConfigStat({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="surface-soft rounded-card p-3">
      <div className="ui-label flex items-center gap-2">
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}
