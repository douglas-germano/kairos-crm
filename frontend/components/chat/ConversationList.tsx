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

// Avatares neutros — cinza, accent suave e escuro; sem cores aleatórias.
const AVATAR_PALETTES = [
  "bg-brand-neutral text-brand-ink",
  "bg-brand-red50 text-brand-red",
  "bg-brand-charcoal text-white",
  "bg-brand-canvas text-brand-charcoal",
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

      <section className="flex h-full flex-col overflow-hidden border-r border-brand-line bg-brand-white">
        {/* Header */}
        <div className="border-b border-brand-line px-4 pb-3.5 pt-4">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <h2 className="heading-md">Inbox</h2>
              <p className="ui-meta mt-0.5">{conversations.length} conversas</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Pill label="abertas" value={openCount} tone="green" />
              <Pill label="IA" value={aiCount} tone="accent" />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                title="Nova conversa"
                className="focus-ring ml-1 flex h-8 w-8 items-center justify-center rounded-card bg-brand-red text-white transition-colors hover:bg-brand-redDark"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>

          {onSyncWhatsApp && (
            <button
              type="button"
              onClick={onSyncWhatsApp}
              disabled={syncState === "syncing"}
              className={cn(
                "focus-ring mb-3 flex w-full items-center justify-center gap-2 rounded-card border px-3 py-2 text-xs font-semibold transition-colors",
                syncState === "done"
                  ? "border-brand-success/30 bg-brand-successSoft text-brand-successStrong"
                  : syncState === "error"
                    ? "border-red-200 bg-red-50 text-brand-danger"
                    : "border-brand-line bg-brand-canvas text-brand-muted hover:border-brand-lineStrong hover:text-brand-ink"
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

          {/* Busca */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa..."
              className="focus-ring h-9 w-full rounded-card border border-brand-line bg-brand-canvas pl-9 pr-3 text-sm font-medium text-brand-ink outline-none transition-colors placeholder:text-brand-faint hover:border-brand-lineStrong"
            />
          </div>

          {/* Filtros de canal — segmented control */}
          <div className="flex gap-1 rounded-card bg-brand-canvas p-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onChannelChange(f.value)}
                className={cn(
                  "focus-ring flex-1 rounded-[7px] px-2 py-1.5 text-xs font-semibold transition-colors",
                  channel === f.value
                    ? "bg-brand-white text-brand-ink shadow-xs"
                    : "text-brand-muted hover:text-brand-ink"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
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
  const unread = conversation.unread_count > 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring relative w-full border-b border-brand-line/70 px-4 py-3 text-left transition-colors duration-fast ease-brand",
        active
          ? "bg-brand-red50 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand-red"
          : "bg-brand-white hover:bg-brand-canvas"
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
            palette
          )}
        >
          {initials(name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm text-brand-ink", unread ? "font-semibold" : "font-medium")}>
              {name}
            </span>
            <span className="shrink-0 text-[11px] font-normal text-brand-faint">
              {formatRelativeTime(conversation.last_message_at)}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <ChannelIcon channel={conversation.channel} className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] text-brand-muted">
              {conversation.channel === "whatsapp" ? "WhatsApp" : "Instagram"}
            </span>

            <span className="ml-auto flex items-center gap-1.5">
              {conversation.ai_enabled && (
                <span className="flex items-center gap-0.5 rounded-pill bg-brand-red50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-red">
                  <Bot size={9} />
                  IA
                </span>
              )}
              {unread && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold text-white">
                  {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
                </span>
              )}
              <span
                className={cn("h-2 w-2 rounded-full", statusOpen ? "bg-brand-success" : "bg-brand-lineStrong")}
                title={statusOpen ? "Aberta" : conversation.status}
              />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function Pill({ label, value, tone }: { label: string; value: number; tone: "green" | "accent" }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-semibold",
        tone === "green" ? "bg-brand-successSoft text-brand-successStrong" : "bg-brand-red50 text-brand-red"
      )}
    >
      <span>{value}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-canvas">
        <MessageSquare size={20} className="text-brand-faint" />
      </span>
      <div>
        <p className="item-title">{search ? "Nenhum resultado" : "Sem conversas"}</p>
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
    <div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 border-b border-brand-line/70 px-4 py-3">
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
