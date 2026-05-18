"use client";

import { useMemo, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationList } from "@/components/chat/ConversationList";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { apiFetch } from "@/lib/api";
import type { Channel, Conversation, ConversationSyncResult } from "@/lib/types";

export default function ConversationsPage() {
  const { workspace } = useAuth(true);
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [selected, setSelected] = useState<Conversation | undefined>();
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [syncResult, setSyncResult] = useState<ConversationSyncResult | null>(null);
  const { data, isLoading, mutate } = useConversations(channel, "all");

  useSocket(
    workspace?.id,
    useMemo(
      () => ({
        onNewMessage: () => void mutate(),
        onConversationUpdated: () => void mutate(),
        onAgentResponseSent: () => void mutate(),
      }),
      [mutate]
    )
  );

  const conversations = data?.items ?? [];
  const current = selected
    ? conversations.find((item) => item.id === selected.id) ?? selected
    : conversations[0];

  async function syncWhatsAppConversations() {
    if (syncState === "syncing") return;
    setSyncState("syncing");
    setSyncResult(null);
    try {
      const result = await apiFetch<ConversationSyncResult>("/api/conversations/sync-whatsapp", {
        method: "POST",
      });
      setSyncResult(result);
      setSyncState("done");
      await mutate();
    } catch {
      setSyncState("error");
    } finally {
      setTimeout(() => setSyncState((state) => (state !== "syncing" ? "idle" : state)), 5000);
    }
  }

  return (
    <div className="grid h-full grid-rows-[1fr] overflow-hidden app-canvas xl:grid-cols-[380px_1fr]">
      <ConversationList
        conversations={conversations}
        selectedId={current?.id}
        onSelect={setSelected}
        channel={channel}
        onChannelChange={setChannel}
        isLoading={isLoading}
        onNewConversation={(conv) => {
          void mutate();
          setSelected(conv);
        }}
        syncState={syncState}
        syncResult={syncResult}
        onSyncWhatsApp={() => void syncWhatsAppConversations()}
      />
      <ChatWindow
        conversation={current}
        onConversationChange={() => void mutate()}
        onConversationDeleted={(conversationId) => {
          if (selected?.id === conversationId || current?.id === conversationId) {
            setSelected(undefined);
          }
          void mutate();
        }}
      />
    </div>
  );
}
