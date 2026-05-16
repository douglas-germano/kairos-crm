"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";
import { AlertCircle, Bot, CircleSlash, Loader2, MoreHorizontal, RefreshCw, X } from "lucide-react";
import { apiFetch, swrFetcher } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import type { Conversation, Message } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Toggle } from "@/components/ui/Toggle";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 50;

type Props = {
  conversation?: Conversation;
  onConversationChange: () => void;
};

export function ChatWindow({ conversation, onConversationChange }: Props) {
  const { workspace } = useAuth(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const isLoadingMoreRef = useRef(false);

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

  // pages[0] = latest msgs, pages[1] = older, ... → reverse for display order
  const messages: Message[] = pages ? [...pages].reverse().flat() : [];
  const hasMore = (pages?.[pages.length - 1]?.length ?? 0) === PAGE_SIZE;
  const isLoadingMore = size > 1 && !pages?.[size - 1];

  // ── Scroll ao trocar de conversa: vai direto ao final ──────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversation?.id]);

  // ── Scroll para mensagens novas: só move se já estava perto do final ───────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isLoadingMoreRef.current) return;
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

  useSocket(
    workspace?.id,
    useMemo(
      () => ({ onNewMessage: handleNewMessage, onAgentResponseSent: handleNewMessage }),
      [handleNewMessage]
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

  async function sendMessage(content: string, contentType = "text") {
    if (!conversation) return;
    setSendError(null);
    try {
      await apiFetch<Message>(`/api/messages/${conversation.id}`, {
        method: "POST",
        body: JSON.stringify({ content, content_type: contentType }),
      });
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Falha ao enviar mensagem");
    } finally {
      await mutate();
      onConversationChange();
    }
  }

  if (!conversation) {
    return (
      <section className="flex h-full items-center justify-center app-canvas p-6">
        <div className="surface-card max-w-md rounded-panel p-8 text-center">
          <CircleSlash className="mx-auto mb-4 text-brand-red" size={34} />
          <h2 className="heading-xl">Selecione uma conversa</h2>
          <p className="body-muted mt-2">
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

  return (
    <section className="flex h-full flex-col overflow-hidden bg-white/90">
      {/* Header */}
      <header className="shrink-0 border-b border-brand-line bg-white/92 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChannelIcon channel={conversation.channel} className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <h2 className="card-title truncate">{name}</h2>
              <div className="ui-meta mt-0.5">
                Última atividade: {formatDateTime(conversation.last_message_at)}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Toggle checked={conversation.ai_enabled} onChange={toggleAi} label="IA ativa" />
            <button className="focus-ring rounded-card bg-brand-canvas p-2 text-brand-muted transition hover:text-brand-ink" aria-label="Mais opções">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8f9fb_0%,#f3f5f7_100%)] p-4"
      >
        {/* Indicador de carregamento de mensagens antigas */}
        {isLoadingMore && (
          <div className="mb-3 flex justify-center">
            <span className="surface-card flex items-center gap-1.5 rounded-[32px] px-3 py-1.5 text-xs text-brand-muted">
              <Loader2 size={12} className="animate-spin" />
              Carregando mensagens antigas…
            </span>
          </div>
        )}

        {/* Indicador: início do histórico */}
        {!hasMore && messages.length > 0 && !isLoading && (
          <div className="mb-3 flex justify-center">
            <span className="surface-card rounded-[32px] px-3 py-1 text-[11px] font-semibold text-brand-muted">
              Início da conversa
            </span>
          </div>
        )}

        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <AlertCircle size={32} className="text-brand-red" />
            <p className="item-title">Erro ao carregar mensagens</p>
            <p className="ui-meta">{String(error?.message ?? error)}</p>
            <button
              onClick={() => void mutate()}
              className="focus-ring flex items-center gap-1.5 rounded-card border border-brand-line bg-white px-3 py-1.5 ui-meta font-bold hover:bg-brand-canvas"
            >
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-brand-muted" />
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
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="shrink-0">
        {sendError && (
          <div className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{sendError}</span>
            <button onClick={() => setSendError(null)} aria-label="Fechar erro">
              <X size={14} />
            </button>
          </div>
        )}
        <MessageInput onSend={(content, type) => sendMessage(content, type)} />
      </div>
    </section>
  );
}
