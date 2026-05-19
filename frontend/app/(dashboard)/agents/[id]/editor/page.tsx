"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { FlowEditor } from "@/components/flow/FlowEditor";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { Flow } from "@/lib/types";
import { useAgent, useFlows } from "@/hooks/useAgent";

export const runtime = "edge";

export default function AgentEditorPage() {
  const params = useParams<{ id: string }>();
  const agentId = Number(params.id);
  const { data: agent } = useAgent(agentId);
  const { data: flows = [], mutate } = useFlows(agentId);
  const flow = flows[0];

  async function createFlow() {
    const created = await apiFetch<Flow>("/api/flows", {
      method: "POST",
      body: JSON.stringify({
        agent_id: agentId,
        name: "Fluxo principal",
        trigger_type: "first_message",
        trigger_config: {},
        active: true,
        nodes: [],
        edges: []
      })
    });
    await mutate([created], false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Fluxo"
        title={agent?.name || "Agente"}
        description="Configure gatilho, condicoes, mensagens, IA e webhooks."
        action={
          <div className="flex gap-3">
            <Link href="/agents">
              <Button variant="ghost">
                <ArrowLeft size={17} />
                Agentes
              </Button>
            </Link>
            {!flow ? (
              <Button onClick={() => void createFlow()}>
                <Plus size={17} />
                Criar fluxo
              </Button>
            ) : null}
          </div>
        }
      />
      {flow ? (
        <FlowEditor flow={flow} onSaved={(updated) => void mutate(flows.map((item) => (item.id === updated.id ? updated : item)), false)} />
      ) : (
        <div className="flex min-h-[calc(100vh-112px)] items-center justify-center p-6 text-center">
          <div className="surface-card rounded-panel p-8">
            <h2 className="heading-xl">Nenhum fluxo criado</h2>
            <p className="body-muted mt-2 max-w-md">Crie um fluxo principal para este agente e configure os nodes de automacao.</p>
            <Button className="mt-6" onClick={() => void createFlow()}>
              <Plus size={17} />
              Criar fluxo
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
