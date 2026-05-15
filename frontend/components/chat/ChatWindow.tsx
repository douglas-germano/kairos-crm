"use client";

import { useState } from "react";
import useSWR from "swr";
import { AlertCircle, Bot, CircleSlash, MoreHorizontal, X } from "lucide-react";
import { apiFetch, swrFetcher } from "@/lib/api";
import type { Conversation, Message } from "@/lib/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { Toggle } from "@/components/ui/Toggle";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { formatDateTime } from "@/lib/utils";

type Props = {
  conversation?: Conversation;
  onConversationChange: () => void;
};

export function ChatWindow({ conversation, onConversationChange }: Props) {
  const { data: messages = [], mutate } = useSWR<Message[]>(
    conversation ? `/api/messages/${conversation.id}` : null,
    swrFetcher,
    { refreshInterval: 12000 }
  );
  const [sendError, setSendError] = useState<string | null>(null);

  async function toggleAi(checked: boolean) {
    if (!conversation) return;
    await apiFetch(`/api/conversations/${conversation.id}/ai`, {
      method: "PATCH",
      body: JSON.stringify({ ai_enabled: checked }),
    });
    onConversationChange();
  }

  async function sendMessage(content: string) {
    if (!conversation) return;
    setSendError(null);
    try {
      await apiFetch<Message>(`/api/messages/${conversation.id}`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Falha ao enviar mensagem");
    } finally {
      // Atualiza mensagens independente do resultado — mensagem pode ter sido salva
      await mutate();
      onConversationChange();
    }
  }

  if (!conversation) {
    return (
      <section className="flex min-h-[calc(100vh-96px)] items-center justify-center bg-white p-6">
        <div className="max-w-md text-center">
          <CircleSlash className="mx-auto mb-4 text-brand-red" size={34} />
          <h2 className="text-2xl font-light">Selecione uma conversa</h2>
          <p className="mt-2 text-sm text-brand-grey">
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
    <section className="grid min-h-[calc(100vh-96px)] grid-rows-[auto_1fr_auto] bg-white">
      <header className="border-b border-black/10 p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <ChannelIcon channel={conversation.channel} className="h-9 w-9" />
            <div>
              <h2 className="text-sm font-black">{name}</h2>
              <div className="mt-1 text-xs text-brand-grey">
                Última atividade: {formatDateTime(conversation.last_message_at)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Toggle checked={conversation.ai_enabled} onChange={toggleAi} label="IA ativa" />
            <button className="focus-ring rounded-tight bg-[#f6f7f8] p-2" aria-label="Mais opções">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="scrollbar-thin space-y-3 overflow-y-auto bg-[#f6f7f8] p-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-80 items-center justify-center text-center">
            <div>
              <Bot className="mx-auto mb-3 text-brand-red" size={32} />
              <p className="text-sm text-brand-grey">Sem mensagens carregadas para esta conversa.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
      </div>

      {/* Banner de erro de envio — não crashea a página */}
      {sendError && (
        <div className="flex items-center gap-2 border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1">{sendError}</span>
          <button onClick={() => setSendError(null)} aria-label="Fechar erro">
            <X size={14} />
          </button>
        </div>
      )}

      <MessageInput onSend={sendMessage} />
    </section>
  );
}
