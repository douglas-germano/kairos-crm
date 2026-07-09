"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { AlertCircle, Bot, CircleSlash, Loader2, MoreHorizontal, RefreshCw, Trash2, X } from "lucide-react";
import { apiFetch, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import type { Conversation, Message } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Toggle } from "@/components/ui/toggle";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 50;

type SyncState = "idle" | "syncing" | "done" | "error";

type Props = {
  conversation?: Conversation;
  onConversationChange: () => void;
  onConversationDeleted?: (conversationId: number) => void;
};

export function ChatWindow({ conversation, onConversationChange, onConversationDeleted }: Props) {
  const { workspace, user } = useAuth(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncCount, setSyncCount] = useState<number | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [agentTyping, setAgentTyping] = useState(false);
  const autoSyncedRef = useRef<Set<number>>(new Set());
  const readMarkedRef = useRef<Set<number>>(new Set());
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef(false);
  const scrollToBottomRef = useRef(false);

  // Cursor-based pagination: page 0 = latest 50, page N = older with before_id
  const getKey = useCallback(
    (pageIndex: number, previousPageData: Message[] | null) => {
      if (!conversation) return null;
      if (pageIndex === 0) return `/api/messages/${conversation.id}?limit=${PAGE_SIZE}`;
      if (!previousPageData || previousPageData.length === 0) return null;
      const oldestId = previousPageData[0]?.id;
      return `/api/messages/${conversation.id}?before_id=${oldestId}&limit=${PAGE_SIZE}`;
    },
    [conversation]
  );

  const {
    data: pages,
    size,
    setSize,
    mutate,
    error,
    isLoading,
  } = useSWRInfinite<Message[]>(getKey, swrFetcher, {
    refreshInterval: 1000,
    revalidateFirstPage: true,
    revalidateAll: false,
  });

  // Renderiza sempre em ordem cronológica: antigas em cima, novas embaixo.
  const messages: Message[] = pages
    ? [...pages]
        .reverse()
        .flat()
        .sort((a, b) => {
          const byDate = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          return byDate || a.id - b.id;
        })
    : [];
  const hasMore = (pages?.[pages.length - 1]?.length ?? 0) === PAGE_SIZE;
  const isLoadingMore = size > 1 && !pages?.[size - 1];

  // ── Auto-sync na primeira abertura de conversas WhatsApp não sincronizadas ──
  useEffect(() => {
    if (
      !conversation ||
      conversation.channel !== "whatsapp" ||
      isLoading ||
      autoSyncedRef.current.has(conversation.id)
    ) return;

    // Dispara sync se nunca foi sincronizado (synced_at === null)
    if (!conversation.synced_at) {
      autoSyncedRef.current.add(conversation.id);
      void handleSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.synced_at, isLoading]);

  async function handleSync() {
    if (!conversation || syncState === "syncing") return;
    setSyncState("syncing");
    setSyncCount(null);
    try {
      const res = await apiFetch<{ synced: number; total: number }>(
        `/api/messages/${conversation.id}/sync`,
        { method: "POST" }
      );
      setSyncCount(res.synced);
      setSyncState("done");
      await mutate();
      onConversationChange();
    } catch {
      setSyncState("error");
    } finally {
      setTimeout(() => setSyncState((s) => (s !== "syncing" ? "idle" : s)), 4000);
    }
  }

  // ── Ao trocar de conversa: sinaliza que deve rolar ao final quando carregar ──
  useEffect(() => {
    scrollToBottomRef.current = true;
    setSyncState("idle");
    setSyncCount(null);
    setTypingUser(null);
    setAgentTyping(false);
  }, [conversation?.id]);

  // ── Marca a conversa como lida ao abrir (uma vez por conversa com não lidas) ──
  useEffect(() => {
    if (!conversation || !conversation.unread_count || readMarkedRef.current.has(conversation.id)) return;
    readMarkedRef.current.add(conversation.id);
    void apiFetch(`/api/conversations/${conversation.id}/read`, { method: "POST" }).then(() => {
      onConversationChange();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.unread_count]);

  // ── Scroll após mensagens carregarem ──────────────────────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isLoadingMoreRef.current) return;

    if (scrollToBottomRef.current && messages.length > 0) {
      el.scrollTop = el.scrollHeight;
      scrollToBottomRef.current = false;
      return;
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 150) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // ── Após carregar mensagens antigas: restaura posição do scroll ────────────
  useEffect(() => {
    if (!isLoadingMore && prevScrollHeightRef.current > 0) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = 0;
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingMore]);

  // ── Detecta scroll no topo para carregar mais mensagens ───────────────────
  function handleScroll() {
    const el = scrollRef.current;
    if (!el || !hasMore || isLoadingMoreRef.current) return;
    if (el.scrollTop < 80) {
      isLoadingMoreRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      void setSize((s) => s + 1);
    }
  }

  // ── Socket: atualiza apenas a primeira página (mensagens recentes) ─────────
  const handleNewMessage = useCallback(
    (payload: unknown) => {
      const p = payload as { conversation_id?: number };
      if (p?.conversation_id === conversation?.id) {
        void mutate();
      }
    },
    [conversation?.id, mutate]
  );

  const handleStatusUpdated = useCallback(
    (payload: unknown) => {
      const p = payload as { conversation_id?: number };
      if (p?.conversation_id === conversation?.id) {
        void mutate();
      }
    },
    [conversation?.id, mutate]
  );

  const handleOperatorTyping = useCallback(
    (payload: unknown) => {
      const p = payload as { conversation_id?: number; user_id?: number; user_name?: string | null; is_typing?: boolean };
      if (p?.conversation_id !== conversation?.id || p?.user_id === user?.id) return;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (p.is_typing) {
        setTypingUser(p.user_name || "Alguém");
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 5000);
      } else {
        setTypingUser(null);
      }
    },
    [conversation?.id, user?.id]
  );

  const handleAgentTyping = useCallback(
    (payload: unknown) => {
      const p = payload as { conversation_id?: number; is_typing?: boolean };
      if (p?.conversation_id !== conversation?.id) return;
      setAgentTyping(Boolean(p.is_typing));
    },
    [conversation?.id]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useSocket(
    workspace?.id,
    useMemo(
      () => ({
        onNewMessage: handleNewMessage,
        onAgentResponseSent: handleNewMessage,
        onMessageStatusUpdated: handleStatusUpdated,
        onOperatorTyping: handleOperatorTyping,
        onAgentTyping: handleAgentTyping,
      }),
      [handleNewMessage, handleStatusUpdated, handleOperatorTyping, handleAgentTyping]
    )
  );

  async function toggleAi(checked: boolean) {
    if (!conversation) return;
    await apiFetch(`/api/conversations/${conversation.id}/ai`, {
      method: "PATCH",
      body: JSON.stringify({ ai_enabled: checked }),
    });
    onConversationChange();
  }

  async function sendMessage(
    content: string,
    contentType = "text",
    options?: { caption?: string; fileName?: string }
  ) {
    if (!conversation) return;
    setSendError(null);
    try {
      await apiFetch<Message>(`/api/messages/${conversation.id}`, {
        method: "POST",
        body: JSON.stringify({
          content,
          content_type: contentType,
          caption: options?.caption,
          file_name: options?.fileName,
        }),
      });
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Falha ao enviar mensagem");
    } finally {
      await mutate();
      onConversationChange();
    }
  }

  async function retryMessage(messageId: number) {
    setSendError(null);
    try {
      await apiFetch<Message>(`/api/messages/${messageId}/retry`, { method: "POST" });
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Falha ao reenviar mensagem");
    } finally {
      await mutate();
    }
  }

  async function deleteConversation() {
    if (!conversation) return;
    const name =
      conversation.contact?.name ||
      conversation.contact?.external_id ||
      `Conversa #${conversation.id}`;
    const confirmed = window.confirm(`Excluir a conversa com "${name}" e todas as mensagens?`);
    if (!confirmed) return;

    await apiFetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    onConversationDeleted?.(conversation.id);
    onConversationChange();
  }

  if (!conversation) {
    return (
      <section className="flex h-full items-center justify-center app-canvas p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-white shadow-sm ring-1 ring-brand-line">
            <CircleSlash className="text-brand-red" size={26} />
          </span>
          <h2 className="heading-xl">Selecione uma conversa</h2>
          <p className="body-muted mx-auto mt-2 max-w-sm">
            A janela de atendimento mostra o histórico, o canal e o controle de IA por conversa.
          </p>
        </div>
      </section>
    );
  }

  const name =
    conversation.contact?.name ||
    conversation.contact?.external_id ||
    `Conversa #${conversation.id}`;

  const isWhatsApp = conversation.channel === "whatsapp";

  return (
    <section className="flex h-full flex-col overflow-hidden bg-brand-canvas">
      {/* Header */}
      <header className="shrink-0 border-b border-brand-line bg-brand-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-canvas ring-1 ring-brand-line">
              <ChannelIcon channel={conversation.channel} className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="card-title truncate">{name}</h2>
              <div className="ui-meta mt-0.5">
                Última atividade: {formatDateTime(conversation.last_message_at)}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Toggle checked={conversation.ai_enabled} onChange={toggleAi} label="IA ativa" />

            {/* Sync button — WhatsApp only */}
            {isWhatsApp && (
              <SyncButton
                state={syncState}
                count={syncCount}
                onSync={() => void handleSync()}
              />
            )}

            <button
              onClick={() => void deleteConversation()}
              className="focus-ring rounded-card border border-brand-line bg-brand-white p-2 text-brand-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-brand-danger"
              aria-label="Excluir conversa"
              title="Excluir conversa"
            >
              <Trash2 size={17} />
            </button>

            <button
              className="focus-ring rounded-card border border-brand-line bg-brand-white p-2 text-brand-muted transition-colors hover:border-brand-lineStrong hover:text-brand-ink"
              aria-label="Mais opções"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-brand-canvas pl-4 pr-5 py-4"
      >
        {/* Indicador de carregamento de mensagens antigas */}
        {isLoadingMore && (
          <div className="mb-3 flex justify-center">
            <span className="surface-card flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs text-brand-muted">
              <Loader2 size={12} className="animate-spin" />
              Carregando mensagens antigas…
            </span>
          </div>
        )}

        {/* Indicador: início do histórico */}
        {!hasMore && messages.length > 0 && !isLoading && (
          <div className="mb-3 flex justify-center">
            <span className="surface-card rounded-pill px-3 py-1 text-[11px] font-semibold text-brand-muted">
              Início da conversa
            </span>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AlertCircle size={32} className="text-brand-danger" />
            <p className="item-title">Erro ao carregar mensagens</p>
            <p className="ui-meta">{String(error?.message ?? error)}</p>
            <button
              onClick={() => void mutate()}
              className="focus-ring flex items-center gap-1.5 rounded-card border border-brand-line bg-brand-white px-3 py-1.5 ui-meta font-bold hover:bg-brand-canvas"
            >
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        ) : isLoading || syncState === "syncing" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Loader2 size={24} className="animate-spin text-brand-muted" />
            {syncState === "syncing" && (
              <p className="ui-meta">Sincronizando histórico do WhatsApp…</p>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <Bot className="mx-auto mb-3 text-brand-red" size={32} />
              <p className="body-muted">Sem mensagens nesta conversa.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onRetry={retryMessage} />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="shrink-0">
        {(typingUser || agentTyping) && (
          <div className="flex items-center gap-1.5 border-t border-brand-line bg-brand-white px-4 py-1.5 text-xs font-medium text-brand-muted">
            <span className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
            </span>
            {agentTyping ? "IA está digitando…" : `${typingUser} está digitando…`}
          </div>
        )}
        {sendError && (
          <div className="flex items-center gap-2 border-t border-brand-danger/30 bg-brand-dangerSoft px-4 py-2 text-xs font-semibold text-brand-danger">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{sendError}</span>
            <button onClick={() => setSendError(null)} aria-label="Fechar erro">
              <X size={14} />
            </button>
          </div>
        )}
        <MessageInput
          onSend={(content, type, options) => sendMessage(content, type, options)}
          workspaceId={workspace?.id}
          conversationId={conversation.id}
        />
      </div>
    </section>
  );
}

function SyncButton({
  state,
  count,
  onSync,
}: {
  state: SyncState;
  count: number | null;
  onSync: () => void;
}) {
  const label =
    state === "syncing"
      ? "Sincronizando…"
      : state === "done"
        ? count === 0
          ? "Já sincronizado"
          : `${count} msg${count !== 1 ? "s" : ""} importada${count !== 1 ? "s" : ""}`
        : state === "error"
          ? "Erro ao sincronizar"
          : "Sincronizar histórico";

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={state === "syncing"}
      title={label}
      className={`focus-ring flex items-center gap-1.5 rounded-card border px-2.5 py-1.5 text-[11px] font-semibold transition-colors
        ${state === "done"
          ? "border-brand-success/30 bg-brand-successSoft text-brand-successStrong"
          : state === "error"
            ? "border-red-200 bg-red-50 text-brand-danger"
            : "border-brand-line bg-brand-white text-brand-muted hover:border-brand-lineStrong hover:text-brand-ink"
        } disabled:opacity-60`}
    >
      <RefreshCw size={12} className={state === "syncing" ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
