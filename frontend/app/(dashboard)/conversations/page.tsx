"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationList } from "@/components/chat/ConversationList";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import type { Channel, Conversation } from "@/lib/types";

export default function ConversationsPage() {
  const { workspace } = useAuth(true);
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [selected, setSelected] = useState<Conversation | undefined>();
  const { data, isLoading, mutate } = useConversations(channel, "all");

  useSocket(
    workspace?.id,
    useMemo(
      () => ({
        onNewMessage: () => void mutate(),
        onConversationUpdated: () => void mutate(),
        onAgentResponseSent: () => void mutate()
      }),
      [mutate]
    )
  );

  const conversations = data?.items ?? [];
  const current = selected ? conversations.find((item) => item.id === selected.id) || selected : conversations[0];

  return (
    <>
      <PageHeader
        eyebrow="Atendimento"
        title="Conversas"
        description="Inbox centralizada para acompanhar clientes, canal e status de IA."
        action={
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Abertas" value={conversations.filter((item) => item.status === "open").length} />
            <Metric label="Com IA" value={conversations.filter((item) => item.ai_enabled).length} />
            <Metric label="Total" value={data?.total ?? 0} />
          </div>
        }
      />
      <div className="grid min-h-[calc(100vh-96px)] bg-white xl:grid-cols-[440px_1fr]">
        <ConversationList conversations={conversations} selectedId={current?.id} onSelect={setSelected} channel={channel} onChannelChange={setChannel} />
        {isLoading ? (
          <div className="flex items-center justify-center text-sm text-brand-grey">Carregando conversas...</div>
        ) : (
          <ChatWindow conversation={current} onConversationChange={() => void mutate()} />
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-card border border-black/10 bg-[#f6f7f8] px-3 py-2">
      <div className="text-base font-black leading-none">{value}</div>
      <div className="text-[11px] font-bold uppercase text-brand-grey">{label}</div>
    </div>
  );
}
