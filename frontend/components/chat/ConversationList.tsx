"use client";

import { useState } from "react";
import { Bot, Loader2, MessageSquare, Plus, RefreshCw, Search } from "lucide-react";
import type { Channel, Conversation, ConversationSyncResult } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { NewConversationModal } from "@/components/chat/NewConversationModal";
import { cn, formatRelativeTime, initials } from "@/lib/utils";

type Props = {
  conversations: Conversation[];
  selectedId?: number;
  onSelect: (conversation: Conversation) => void;
  channel: Channel | "all";
  onChannelChange: (channel: Channel | "all") => void;
  isLoading?: boolean;
  onNewConversation?: (conversation: Conversation) => void;
  syncState?: "idle" | "syncing" | "done" | "error";
  syncResult?: ConversationSyncResult | null;
  onSyncWhatsApp?: () => void;
};

const FILTERS: Array<{ label: string; value: Channel | "all" }> = [
  { label: "Todos", value: "all" },
  { label: "WhatsApp", value: "whatsapp" },
  { label: "Instagram", value: "instagram" },
];

const AVATAR_PALETTES = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
];

function avatarColor(name: string) {
  return AVATAR_PALETTES[(name.charCodeAt(0) || 0) % AVATAR_PALETTES.length];
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  channel,
  onChannelChange,
  isLoading,
  onNewConversation,
  syncState = "idle",
  syncResult,
  onSyncWhatsApp,
}: Props) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = search.trim()
    ? conversations.filter((c) => {
        const name = (c.contact?.name ?? c.contact?.external_id ?? "").toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : conversations;

  const openCount = conversations.filter((c) => c.status === "open").length;
  const aiCount = conversations.filter((c) => c.ai_enabled).length;

  return (
    <>
      <NewConversationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(conv) => {
          setModalOpen(false);
          onNewConversation?.(conv);
        }}
      />

    <section className="flex h-full flex-col overflow-hidden border-r border-brand-line bg-white/95">
      {/* Header */}
      <div className="border-b border-brand-line px-4 pb-4 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">Atendimento</p>
            <h2 className="heading-md">Inbox</h2>
            <p className="ui-meta mt-1">{conversations.length} conversas</p>
          </div>
          <div className="flex items-center gap-2">
            <Pill label="Abertas" value={openCount} tone="green" />
            <Pill label="IA" value={aiCount} tone="red" />
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Nova conversa"
              className="focus-ring flex h-7 w-7 items-center justify-center rounded-full bg-brand-charcoal text-white transition hover:bg-brand-ink"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {onSyncWhatsApp && (
          <button
            type="button"
            onClick={onSyncWhatsApp}
            disabled={syncState === "syncing"}
            className={cn(
              "focus-ring mb-3 flex w-full items-center justify-center gap-2 rounded-card border px-3 py-2 text-[11px] font-extrabold transition",
              syncState === "done"
                ? "border-brand-success/30 bg-brand-successSoft text-brand-successStrong"
                : syncState === "error"
                  ? "border-brand-red/30 bg-brand-red50 text-brand-red"
                  : "border-brand-line bg-brand-canvas text-brand-muted hover:text-brand-ink"
            )}
          >
            {syncState === "syncing" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <RefreshCw size={13} />
            )}
            <span>{syncButtonLabel(syncState, syncResult)}</span>
          </button>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conversa..."
            className="focus-ring w-full rounded-card border border-brand-line bg-brand-canvas py-2.5 pl-9 pr-3 text-sm font-medium placeholder:text-brand-muted"
          />
        </div>

        {/* Channel filters */}
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onChannelChange(f.value)}
              className={cn(
                "focus-ring rounded-card px-3 py-1.5 text-[11px] font-extrabold transition",
                channel === f.value
                  ? "bg-brand-charcoal text-white"
                  : "bg-brand-canvas text-brand-muted hover:bg-brand-neutral hover:text-brand-ink"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          filtered.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              active={selectedId === conversation.id}
              onClick={() => onSelect(conversation)}
            />
          ))
        )}
      </div>
    </section>
    </>
  );
}

function syncButtonLabel(
  state: "idle" | "syncing" | "done" | "error",
  result?: ConversationSyncResult | null
) {
  if (state === "syncing") return "Sincronizando conversas do WhatsApp...";
  if (state === "error") return "Erro ao sincronizar conversas";
  if (state === "done" && result) {
    if (result.imported === 0 && result.updated === 0) return "Conversas já sincronizadas";
    return `${result.imported} nova${result.imported !== 1 ? "s" : ""}, ${result.updated} atualizada${result.updated !== 1 ? "s" : ""}`;
  }
  return "Sincronizar conversas do WhatsApp";
}

function ConversationItem({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const name =
    conversation.contact?.name ||
    conversation.contact?.external_id ||
    `Conversa #${conversation.id}`;

  const palette = avatarColor(name);
  const statusOpen = conversation.status === "open";

  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring w-full border-b border-brand-line/70 px-4 py-3.5 text-left transition-colors",
        active
          ? "border-l-4 border-l-brand-red bg-red-50/80"
          : "border-l-4 border-l-transparent bg-white hover:bg-brand-canvas"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black",
            palette
          )}
        >
          {initials(name)}
        </span>

        <div className="min-w-0 flex-1">
          {/* Row 1: name + time */}
          <div className="flex items-center justify-between gap-2">
            <span className="item-title truncate">{name}</span>
            <span className="ui-meta shrink-0">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>

          {/* Row 2: channel + badges */}
          <div className="mt-1 flex items-center gap-2">
            <ChannelIcon channel={conversation.channel} className="h-3.5 w-3.5 shrink-0" />
            <span className="ui-meta">
              {conversation.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
            </span>

            <span className="ml-auto flex items-center gap-1.5">
              {conversation.ai_enabled && (
                <span className="flex items-center gap-0.5 rounded-[32px] bg-red-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-red">
                  <Bot size={9} />
                  IA
                </span>
              )}
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  statusOpen ? "bg-emerald-400" : "bg-brand-grey/40"
                )}
                title={statusOpen ? "Aberta" : conversation.status}
              />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: "green" | "red" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-card px-2 py-1 font-condensed text-[10px] font-extrabold",
        tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-brand-red"
      )}
    >
      <span>{value}</span>
      <span className="text-[10px] opacity-70">{label}</span>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <MessageSquare size={32} className="text-brand-muted/40" />
      <div>
        <p className="item-title">
          {search ? "Nenhum resultado" : "Sem conversas"}
        </p>
        <p className="ui-meta mt-1">
          {search
            ? `Nenhuma conversa com "${search}"`
            : "Quando clientes enviarem mensagens, elas aparecerão aqui."}
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-black/[0.06]">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-brand-neutral" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 w-2/3 animate-pulse rounded bg-brand-neutral" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-brand-neutral" />
          </div>
        </div>
      ))}
    </div>
  );
}
