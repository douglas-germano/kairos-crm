"use client";

import { useEffect, useRef } from "react";
import { getSocket, joinWorkspace, leaveWorkspace } from "@/lib/socket";

type Handlers = {
  onNewMessage?: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
  onAgentResponseSent?: (payload: unknown) => void;
};

export function useSocket(workspaceId?: number, handlers: Handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!workspaceId) return;

    const socket = getSocket();
    joinWorkspace(workspaceId);

    const onNewMessage = (payload: unknown) => handlersRef.current.onNewMessage?.(payload);
    const onConversationUpdated = (payload: unknown) => handlersRef.current.onConversationUpdated?.(payload);
    const onAgentResponseSent = (payload: unknown) => handlersRef.current.onAgentResponseSent?.(payload);

    socket.on("new_message", onNewMessage);
    socket.on("conversation_updated", onConversationUpdated);
    socket.on("agent_response_sent", onAgentResponseSent);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("conversation_updated", onConversationUpdated);
      socket.off("agent_response_sent", onAgentResponseSent);
      leaveWorkspace(workspaceId);
    };
  }, [workspaceId]);
}
