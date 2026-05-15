import { Bot, GitBranch, MessageSquare, Radio, Webhook } from "lucide-react";
import { Handle, NodeProps, Position } from "reactflow";

const nodeMeta = {
  TriggerNode: { icon: Radio, label: "Gatilho", color: "bg-brand-red", soft: "bg-red-50 text-brand-red" },
  MessageNode: { icon: MessageSquare, label: "Mensagem", color: "bg-emerald-600", soft: "bg-emerald-50 text-emerald-700" },
  ConditionNode: { icon: GitBranch, label: "Condicao", color: "bg-amber-500", soft: "bg-amber-50 text-amber-700" },
  AINode: { icon: Bot, label: "IA", color: "bg-brand-charcoal", soft: "bg-slate-100 text-brand-charcoal" },
  WebhookNode: { icon: Webhook, label: "Webhook", color: "bg-blue-600", soft: "bg-blue-50 text-blue-700" }
};

export function FlowNode({ data, type }: NodeProps) {
  const meta = nodeMeta[(type || "MessageNode") as keyof typeof nodeMeta] || nodeMeta.MessageNode;
  const Icon = meta.icon;
  const summary = String(data?.message || data?.system_prompt || data?.url || data?.description || "Configure este passo no painel lateral.");

  return (
    <div className="min-w-56 overflow-hidden rounded-card border border-black/10 bg-white">
      <Handle type="target" position={Position.Top} className="!bg-brand-charcoal" />
      <div className="border-b border-black/10 bg-[#fbfbfb] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`flex h-8 w-8 items-center justify-center rounded-card text-white ${meta.color}`}>
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-brand-charcoal">{String(data?.label || meta.label)}</div>
            <div className="text-[10px] font-bold uppercase text-brand-grey">{meta.label}</div>
          </div>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 max-w-56 text-xs leading-relaxed text-brand-grey">{summary}</p>
        <span className={`mt-3 inline-flex rounded-[32px] px-2 py-1 text-[10px] font-bold uppercase ${meta.soft}`}>
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
