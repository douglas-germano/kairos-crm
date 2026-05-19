"use client";

import { useMemo, useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ConversationList } from "@/components/chat/ConversationList";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Channel, Conversation, ConversationSyncResult } from "@/lib/types";

export default function ConversationsPage() {
  const { workspace } = useAuth(true);
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [selected, setSelected] = useState<Conversation | undefined>();
  // Controla qual painel está visível no mobile (abaixo de xl)
  const [mobilePanel, setMobilePanel] = useState<"list" | "chat">("list");
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
    : undefined;

  function handleSelect(conv: Conversation) {
    setSelected(conv);
    setMobilePanel("chat");
  }

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
    <div className="grid h-full overflow-hidden app-canvas xl:grid-cols-[380px_1fr]">
      {/* Lista — sempre visível no xl; no mobile aparece quando mobilePanel === "list" */}
      <div className={cn("h-full min-h-0", mobilePanel === "list" ? "flex flex-col" : "hidden xl:flex xl:flex-col")}>
        <ConversationList
          conversations={conversations}
          selectedId={current?.id}
          onSelect={handleSelect}
          channel={channel}
          onChannelChange={setChannel}
          isLoading={isLoading}
          onNewConversation={(conv) => {
            void mutate();
            handleSelect(conv);
          }}
          syncState={syncState}
          syncResult={syncResult}
          onSyncWhatsApp={() => void syncWhatsAppConversations()}
        />
      </div>

      {/* Chat — sempre visível no xl; no mobile aparece quando mobilePanel === "chat" */}
      <div className={cn("h-full min-h-0", mobilePanel === "chat" ? "flex flex-col" : "hidden xl:flex xl:flex-col")}>
        <ChatWindow
          conversation={current}
          onConversationChange={() => void mutate()}
          onBack={() => setMobilePanel("list")}
          onConversationDeleted={(conversationId) => {
            if (selected?.id === conversationId || current?.id === conversationId) {
              setSelected(undefined);
              setMobilePanel("list");
            }
            void mutate();
          }}
        />
      </div>
    </div>
  );
}
