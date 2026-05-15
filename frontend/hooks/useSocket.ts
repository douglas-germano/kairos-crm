"use client";

import { useEffect } from "react";
import { getSocket, joinWorkspace, leaveWorkspace } from "@/lib/socket";

type Handlers = {
  onNewMessage?: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
  onAgentResponseSent?: (payload: unknown) => void;
};

export function useSocket(workspaceId?: number, handlers: Handlers = {}) {
  useEffect(() => {
    if (!workspaceId) return;

    const socket = getSocket();
    joinWorkspace(workspaceId);

    if (handlers.onNewMessage) socket.on("new_message", handlers.onNewMessage);
    if (handlers.onConversationUpdated) socket.on("conversation_updated", handlers.onConversationUpdated);
    if (handlers.onAgentResponseSent) socket.on("agent_response_sent", handlers.onAgentResponseSent);

    return () => {
      if (handlers.onNewMessage) socket.off("new_message", handlers.onNewMessage);
      if (handlers.onConversationUpdated) socket.off("conversation_updated", handlers.onConversationUpdated);
      if (handlers.onAgentResponseSent) socket.off("agent_response_sent", handlers.onAgentResponseSent);
      leaveWorkspace(workspaceId);
    };
  }, [workspaceId, handlers]);
}
