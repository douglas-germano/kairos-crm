"use client";

import { Handle, Position, NodeProps, useNodeConnections } from "@xyflow/react";
import { Bot, GitBranch, Link2, MessageSquare, Radio, Webhook, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NodeKind = "TriggerNode" | "MessageNode" | "ConditionNode" | "AINode" | "WebhookNode";

// Cor só no crachá do ícone, não no bloco inteiro — o canvas precisa parecer
// um diagrama técnico (tipo n8n/Temporal), não uma fileira de cards de vidro.
const NODE_META: Record<NodeKind, { icon: LucideIcon; tint: string; iconColor: string; dot: string; kind: string }> = {
  TriggerNode: { icon: Radio, tint: "bg-brand-red/12", iconColor: "text-brand-red", dot: "#7c3aed", kind: "Gatilho" },
  MessageNode: { icon: MessageSquare, tint: "bg-brand-info/12", iconColor: "text-brand-info", dot: "#22d3ee", kind: "Mensagem" },
  ConditionNode: { icon: GitBranch, tint: "bg-brand-warning/12", iconColor: "text-brand-warning", dot: "#f59e0b", kind: "Condição" },
  AINode: { icon: Bot, tint: "bg-brand-highlight/12", iconColor: "text-brand-highlight", dot: "#d946ef", kind: "IA" },
  WebhookNode: { icon: Webhook, tint: "bg-brand-cyan/12", iconColor: "text-brand-cyan", dot: "#22d3ee", kind: "Webhook" }
};

// Badge de contagem de conexões (estilo "plug + número" de diagramas de
// pipeline técnicos) — usa o grafo interno do React Flow, não precisa
// receber edges via props.
function ConnectionsBadge() {
  const connections = useNodeConnections();
  if (connections.length === 0) return null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-brand-line bg-brand-canvas px-1.5 py-0.5 text-[10px] font-bold text-brand-muted">
      <Link2 size={9} />
      {connections.length}
    </span>
  );
}

function NodeShell({
  kind,
  label,
  selected,
  dimmed,
  caption,
  children
}: {
  kind: NodeKind;
  label: string;
  selected?: boolean;
  dimmed?: boolean;
  caption?: string;
  children?: React.ReactNode;
}) {
  const meta = NODE_META[kind];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "min-w-[192px] rounded-md border bg-brand-white px-3 py-2.5 font-sans text-sm transition-all duration-200",
        dimmed && !selected ? "opacity-40 saturate-50" : "opacity-100",
        selected ? "border-brand-red ring-2 ring-brand-red/25" : "border-brand-line hover:border-brand-lineStrong"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded", meta.tint)}>
          <Icon size={13} className={meta.iconColor} />
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-brand-ink">{label}</span>
        <ConnectionsBadge />
      </div>
      {caption ? (
        <p className="mt-1.5 truncate pl-8 font-mono text-[10px] text-brand-muted">{caption}</p>
      ) : null}
      {children}
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps) {
  return (
    <NodeShell
      kind="TriggerNode"
      selected={selected}
      dimmed={Boolean(data.dimmed)}
      label={String(data.label ?? "Gatilho")}
      caption={String(data.trigger_type ?? "first_message").replace(/_/g, " ")}
    >
      <Handle type="source" position={Position.Bottom} />
    </NodeShell>
  );
}

export function MessageNode({ data, selected }: NodeProps) {
  return (
    <NodeShell
      kind="MessageNode"
      selected={selected}
      dimmed={Boolean(data.dimmed)}
      label={String(data.label ?? "Mensagem")}
      caption={String(data.message ?? "") || undefined}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }: NodeProps) {
  const conditionType = String(data.condition_type ?? "contains");
  const value = String(data.value ?? "");
  const caption = value ? `${conditionType} "${value}"` : undefined;
  return (
    <NodeShell
      kind="ConditionNode"
      selected={selected}
      dimmed={Boolean(data.dimmed)}
      label={String(data.label ?? "Condição")}
      caption={caption}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: "70%" }} />
      <div className="mt-1.5 flex justify-between pl-8 text-[9px] font-bold uppercase tracking-wide text-brand-muted">
        <span>sim</span>
        <span>não</span>
      </div>
    </NodeShell>
  );
}

export function AINode({ data, selected }: NodeProps) {
  return (
    <NodeShell
      kind="AINode"
      selected={selected}
      dimmed={Boolean(data.dimmed)}
      label={String(data.label ?? "IA")}
      caption={String(data.prompt ?? data.system_prompt ?? "") || undefined}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeShell>
  );
}

export function WebhookNode({ data, selected }: NodeProps) {
  return (
    <NodeShell
      kind="WebhookNode"
      selected={selected}
      dimmed={Boolean(data.dimmed)}
      label={String(data.label ?? "Webhook")}
      caption={String(data.url ?? "") || undefined}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeShell>
  );
}

export const nodeTypes = {
  TriggerNode,
  MessageNode,
  ConditionNode,
  AINode,
  WebhookNode
};

export function SmallNodeIcon({ type, className }: { type: string; className?: string }) {
  const meta = NODE_META[type as NodeKind] ?? NODE_META.TriggerNode;
  const Icon = meta.icon;
  return <Icon size={14} className={className ?? meta.iconColor} />;
}

export function nodeDotColor(type?: string | null): string {
  const meta = NODE_META[type as NodeKind] ?? NODE_META.TriggerNode;
  return meta.dot;
}
