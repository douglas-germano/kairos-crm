"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlow, addEdge, Background, Connection, Controls, Edge, MiniMap, Node, useEdgesState, useNodesState } from "@xyflow/react";
import { Bot, GitBranch, MessageSquare, Radio, Save, Trash2, Webhook, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import type { Flow } from "@/lib/types";
import { nodeTypes, SmallNodeIcon } from "@/components/flow/nodes/FlowNodes";

const palette = [
  { type: "TriggerNode", label: "Gatilho", description: "Inicia por primeira mensagem ou palavra-chave", icon: Radio },
  { type: "MessageNode", label: "Mensagem", description: "Envia uma resposta fixa ao contato", icon: MessageSquare },
  { type: "ConditionNode", label: "Condicao", description: "Cria caminhos por texto ou tag", icon: GitBranch },
  { type: "AINode", label: "IA", description: "Gera resposta com prompt customizado", icon: Bot },
  { type: "WebhookNode", label: "Webhook", description: "Chama uma URL externa via POST", icon: Webhook }
];

const defaultNodes: Node[] = [
  { id: "trigger-1", type: "TriggerNode", position: { x: 120, y: 80 }, data: { label: "Primeira mensagem", trigger_type: "first_message" } },
  { id: "message-1", type: "MessageNode", position: { x: 120, y: 250 }, data: { label: "Boas-vindas", message: "Olá, como posso ajudar?" } }
];

const defaultEdges: Edge[] = [{ id: "trigger-1-message-1", source: "trigger-1", target: "message-1" }];

export function FlowEditor({ flow, onSaved }: { flow: Flow; onSaved: (flow: Flow) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState((flow.nodes as unknown as Node[])?.length ? (flow.nodes as unknown as Node[]) : defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState((flow.edges as unknown as Edge[])?.length ? (flow.edges as unknown as Edge[]) : defaultEdges);
  const [name, setName] = useState(flow.name);
  const [active, setActive] = useState(flow.active);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedNodeId), [nodes, selectedNodeId]);

  const onConnect = useCallback((connection: Connection) => setEdges((current: Edge[]) => addEdge(connection, current)), [setEdges]);

  async function save() {
    setSaving(true);
    try {
      const updated = await apiFetch<Flow>(`/api/flows/${flow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          active,
          nodes,
          edges,
          trigger_type: "first_message",
          trigger_config: {}
        })
      });
      onSaved(updated);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void save();
    }, 2000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, name, active]);

  function addNode(type: string, label: string, description: string) {
    const id = `${type}-${Date.now()}`;
    setNodes((current: Node[]) => [
      ...current,
      {
        id,
        type,
        position: { x: 420, y: 120 + current.length * 35 },
        data: { label, description }
      }
    ]);
    setSelectedNodeId(id);
  }

  function updateSelectedData(field: string, value: string) {
    if (!selectedNodeId) return;
    setNodes((current: Node[]) => current.map((node) => (node.id === selectedNodeId ? { ...node, data: { ...node.data, [field]: value } } : node)));
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((current: Node[]) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current: Edge[]) => current.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  return (
    <div className="grid h-[calc(100vh-112px)] grid-cols-[280px_1fr_360px] app-canvas">
      <aside className="border-r border-brand-line bg-white/95">
        <div className="border-b border-brand-line p-4">
          <div className="heading-md">Blocos do fluxo</div>
          <p className="body-muted mt-1">Adicione etapas e conecte os blocos no canvas.</p>
        </div>
        <div className="space-y-2 p-3">
          {palette.map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item.type, item.label, item.description)}
              className="focus-ring surface-soft flex w-full items-start gap-3 rounded-card p-3 text-left transition hover:border-brand-red/40 hover:bg-brand-red50"
            >
              <SmallNodeIcon type={item.type} />
              <span className="min-w-0">
                <span className="item-title block">{item.label}</span>
                <span className="body-muted mt-1 block">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="relative overflow-hidden bg-[#eef1f4]">
        <div className="surface-card absolute left-5 right-5 top-5 z-10 flex items-center justify-between rounded-panel p-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="icon-tile icon-tile-red">
              <Zap size={17} />
            </div>
            <div className="min-w-0">
              <Input value={name} onChange={(event) => setName(event.target.value)} className="h-9 w-72 border-transparent bg-brand-canvas py-2 font-bold" />
              <div className="ui-meta mt-1">{nodes.length} blocos · {edges.length} conexoes</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-brand-ink cursor-pointer">
              <Switch checked={active} onCheckedChange={setActive} aria-label="Fluxo ativo" />
              Fluxo ativo
            </label>
            <Button onClick={() => void save()} disabled={saving}>
              <Save size={16} />
              {saving ? "Salvando" : "Salvar"}
            </Button>
          </div>
        </div>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id)}
          fitView
          className="pt-20"
        >
          <Background color="#cfd4da" gap={22} />
          <Controls />
          <MiniMap nodeColor="#e60000" maskColor="rgba(37,40,43,0.08)" />
        </ReactFlow>
      </section>

      <aside className="border-l border-brand-line bg-white/95">
        <div className="border-b border-brand-line p-4">
          <div className="item-title flex items-center gap-2">
            <Zap size={15} className="text-brand-red" />
            Propriedades
          </div>
          <p className="ui-meta mt-1">Edite o bloco selecionado.</p>
        </div>
        {selectedNode ? (
          <div className="space-y-4 p-4">
            <div className="surface-soft flex items-center gap-3 rounded-card p-3">
              <SmallNodeIcon type={selectedNode.type || "MessageNode"} />
              <div className="min-w-0">
                <div className="item-title truncate">{String(selectedNode.data?.label || selectedNode.type)}</div>
                <div className="ui-meta">{selectedNode.type}</div>
              </div>
            </div>

            <Field title="Nome do bloco">
              <Input value={String(selectedNode.data?.label || "")} onChange={(event) => updateSelectedData("label", event.target.value)} placeholder="Ex: Boas-vindas" />
            </Field>

            <Field title={selectedNode.type === "AINode" ? "Prompt da IA" : "Mensagem ou descricao"}>
              <Textarea
                value={String(selectedNode.data?.message || selectedNode.data?.system_prompt || selectedNode.data?.description || "")}
                onChange={(event) => updateSelectedData(selectedNode.type === "AINode" ? "system_prompt" : "message", event.target.value)}
                placeholder={selectedNode.type === "AINode" ? "Instrucao para esta etapa da IA" : "Texto enviado ou descricao da regra"}
                className="min-h-32"
              />
            </Field>

            {selectedNode.type === "ConditionNode" ? (
              <div className="grid grid-cols-[130px_1fr] gap-3">
                <Field title="Condicao">
                  <select
                    value={String(selectedNode.data?.condition_type || "contains")}
                    onChange={(event) => updateSelectedData("condition_type", event.target.value)}
                    className="focus-ring h-11 w-full rounded-card border border-brand-line bg-white px-3 text-sm"
                  >
                    <option value="contains">Contem</option>
                    <option value="equals">Igual</option>
                    <option value="starts_with">Comeca com</option>
                  </select>
                </Field>
                <Field title="Valor">
                  <Input value={String(selectedNode.data?.value || "")} onChange={(event) => updateSelectedData("value", event.target.value)} placeholder="palavra-chave" />
                </Field>
              </div>
            ) : null}

            {selectedNode.type === "WebhookNode" ? (
              <Field title="URL do webhook">
                <Input value={String(selectedNode.data?.url || "")} onChange={(event) => updateSelectedData("url", event.target.value)} placeholder="https://..." />
              </Field>
            ) : null}

            <div className="surface-soft body-muted rounded-card p-3">
              Conecte este bloco arrastando a alca inferior para o proximo passo. Em condicoes, use saidas true/false no canvas.
            </div>

            <Button type="button" variant="ghost" className="w-full border-brand-red text-brand-red" onClick={deleteSelectedNode}>
              <Trash2 size={16} />
              Remover bloco
            </Button>
          </div>
        ) : (
          <div className="p-4">
            <div className="surface-soft rounded-card border-dashed p-6 text-center">
              <Zap className="mx-auto mb-3 text-brand-red" size={24} />
              <p className="item-title">Selecione um bloco</p>
              <p className="body-muted mt-1">Clique em qualquer bloco no canvas para editar nome, mensagem, condicoes ou webhook.</p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="ui-label mb-2 block">{title}</span>
      {children}
    </label>
  );
}
