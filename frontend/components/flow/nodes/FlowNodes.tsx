"use client";

import { Handle, Position, NodeProps } from "@xyflow/react";
import { Bot, GitBranch, MessageSquare, Radio, Webhook } from "lucide-react";

const baseClass =
  "min-w-[180px] rounded-card border border-brand-line bg-brand-white px-3.5 py-3 font-sans text-sm";

export function TriggerNode({ data }: NodeProps) {
  return (
    <div className={baseClass}>
      <div className="flex items-center gap-2 mb-1">
        <Radio size={14} className="text-brand-red shrink-0" />
        <span className="font-extrabold text-brand-ink text-xs truncate">{String(data.label ?? "Gatilho")}</span>
      </div>
      <p className="text-[10px] text-brand-muted capitalize">{String(data.trigger_type ?? "first_message").replace(/_/g, " ")}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function MessageNode({ data }: NodeProps) {
  return (
    <div className={baseClass}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare size={14} className="text-brand-info shrink-0" />
        <span className="font-extrabold text-brand-ink text-xs truncate">{String(data.label ?? "Mensagem")}</span>
      </div>
      <p className="text-[10px] text-brand-muted line-clamp-2">{String(data.message ?? "")}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function ConditionNode({ data }: NodeProps) {
  return (
    <div className={baseClass}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <GitBranch size={14} className="text-brand-warning shrink-0" />
        <span className="font-extrabold text-brand-ink text-xs truncate">{String(data.label ?? "Condição")}</span>
      </div>
      <p className="text-[10px] text-brand-muted">{String(data.condition ?? "")}</p>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: "30%" }} />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: "70%" }} />
    </div>
  );
}

export function AINode({ data }: NodeProps) {
  return (
    <div className={baseClass}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <Bot size={14} className="text-brand-red shrink-0" />
        <span className="font-extrabold text-brand-ink text-xs truncate">{String(data.label ?? "IA")}</span>
      </div>
      <p className="text-[10px] text-brand-muted line-clamp-2">{String(data.prompt ?? "")}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function WebhookNode({ data }: NodeProps) {
  return (
    <div className={baseClass}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2 mb-1">
        <Webhook size={14} className="text-brand-charcoal shrink-0" />
        <span className="font-extrabold text-brand-ink text-xs truncate">{String(data.label ?? "Webhook")}</span>
      </div>
      <p className="text-[10px] text-brand-muted truncate">{String(data.url ?? "")}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const nodeTypes = {
  TriggerNode,
  MessageNode,
  ConditionNode,
  AINode,
  WebhookNode,
};

const NODE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  TriggerNode: Radio,
  MessageNode: MessageSquare,
  ConditionNode: GitBranch,
  AINode: Bot,
  WebhookNode: Webhook,
};

export function SmallNodeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = NODE_ICONS[type] ?? Radio;
  return <Icon size={14} className={className} />;
}
