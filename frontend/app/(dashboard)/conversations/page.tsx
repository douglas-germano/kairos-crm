"use client";

import { useMemo, useState } from "react";
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
        onAgentResponseSent: () => void mutate(),
      }),
      [mutate]
    )
  );

  const conversations = data?.items ?? [];
  const current = selected
    ? conversations.find((item) => item.id === selected.id) ?? selected
    : conversations[0];

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
