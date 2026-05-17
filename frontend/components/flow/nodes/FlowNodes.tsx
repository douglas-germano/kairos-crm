import { Bot, GitBranch, MessageSquare, Radio, Webhook } from "lucide-react";
import { Handle, NodeProps, Position } from "@xyflow/react";

const nodeMeta = {
  TriggerNode: { icon: Radio, label: "Gatilho", color: "bg-brand-red", soft: "bg-brand-red50 text-brand-red" },
  MessageNode: { icon: MessageSquare, label: "Mensagem", color: "bg-brand-success", soft: "bg-brand-successSoft text-brand-successStrong" },
  ConditionNode: { icon: GitBranch, label: "Condicao", color: "bg-brand-warning", soft: "bg-brand-warningSoft text-brand-warningStrong" },
  AINode: { icon: Bot, label: "IA", color: "bg-brand-charcoal", soft: "bg-brand-canvas text-brand-charcoal" },
  WebhookNode: { icon: Webhook, label: "Webhook", color: "bg-brand-info", soft: "bg-brand-infoSoft text-brand-infoStrong" }
};

export function FlowNode({ data, type }: NodeProps) {
  const meta = nodeMeta[(type || "MessageNode") as keyof typeof nodeMeta] || nodeMeta.MessageNode;
  const Icon = meta.icon;
  const summary = String(data?.message || data?.system_prompt || data?.url || data?.description || "Configure este passo no painel lateral.");

  return (
    <div className="min-w-56 overflow-hidden rounded-card border border-brand-line bg-white">
      <Handle type="target" position={Position.Top} className="!bg-brand-charcoal" />
      <div className="border-b border-brand-line bg-brand-canvas px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-card text-white ${meta.color}`}>
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="item-title truncate">{String(data?.label || meta.label)}</div>
            <div className="ui-label text-[10px]">{meta.label}</div>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="body-muted line-clamp-2 max-w-56">{summary}</p>
        <span className={`mt-3 inline-flex rounded-pill px-2 py-1 font-condensed text-[10px] font-extrabold uppercase ${meta.soft}`}>
          {type}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-brand-red" />
    </div>
  );
}

export function SmallNodeIcon({ type }: { type: string }) {
  const meta = nodeMeta[(type || "MessageNode") as keyof typeof nodeMeta] || nodeMeta.MessageNode;
  const Icon = meta.icon;
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-white ${meta.color}`}>
          <Icon size={16} />
    </span>
  );
}

export const nodeTypes = {
  TriggerNode: FlowNode,
  MessageNode: FlowNode,
  ConditionNode: FlowNode,
  AINode: FlowNode,
  WebhookNode: FlowNode
};
