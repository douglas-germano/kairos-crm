"use client";

import { Bot, CheckCircle2 } from "lucide-react";
import type { Channel, Conversation } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDateTime, initials } from "@/lib/utils";

type Props = {
  conversations: Conversation[];
  selectedId?: number;
  onSelect: (conversation: Conversation) => void;
  channel: Channel | "all";
  onChannelChange: (channel: Channel | "all") => void;
};

const filters: Array<{ label: string; value: Channel | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Instagram", value: "instagram" }
];

export function ConversationList({ conversations, selectedId, onSelect, channel, onChannelChange }: Props) {
  return (
    <section className="grid min-h-[calc(100vh-96px)] border-r border-black/10 bg-white grid-rows-[auto_1fr]">
      <aside className="border-b border-black/10 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-black uppercase text-brand-grey">Inbox</div>
          <span className="text-xs font-semibold text-brand-grey">{conversations.length} conversas</span>
        </div>
        <div className="flex gap-2 overflow-auto">
          {filters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onChannelChange(filter.value)}
              className={cn(
                "focus-ring flex shrink-0 items-center gap-2 rounded-tight px-2.5 py-2 text-xs font-bold",
                channel === filter.value ? "bg-brand-red text-white" : "bg-[#f6f7f8] text-brand-charcoal hover:bg-brand-neutral"
              )}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {filter.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="scrollbar-thin max-h-[calc(100vh-162px)] overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-6 text-sm text-brand-grey">Nenhuma conversa encontrada para o filtro atual.</div>
        ) : null}
        {conversations.map((conversation) => {
          const name = conversation.contact?.name || conversation.contact?.external_id || `Conversa #${conversation.id}`;
          const active = selectedId === conversation.id;
          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation)}
              className={cn(
                "focus-ring w-full border-b border-black/10 p-3 text-left transition hover:bg-brand-neutral",
                active ? "border-l-4 border-l-brand-red bg-[#fff7f7]" : "border-l-4 border-l-transparent bg-white"
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef0f2] text-sm font-black text-brand-charcoal">
                    {initials(name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-brand-charcoal">{name}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-brand-grey">
                      <ChannelIcon channel={conversation.channel} className="h-5 w-5" />
                      {conversation.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
                    </div>
                  </div>
                </div>
                {conversation.ai_enabled ? <Bot className="shrink-0 text-brand-red" size={16} /> : <CheckCircle2 className="shrink-0 text-brand-grey" size={16} />}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={conversation.status === "open" ? "green" : "neutral"}>{conversation.status}</Badge>
                <span className="text-xs text-brand-grey">{formatDateTime(conversation.last_message_at)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
