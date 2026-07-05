"use client";

import { useEffect, useRef } from "react";
import { getSocket, joinWorkspace, leaveWorkspace } from "@/lib/socket";

type Handlers = {
  onNewMessage?: (payload: unknown) => void;
  onConversationUpdated?: (payload: unknown) => void;
  onAgentResponseSent?: (payload: unknown) => void;
  onMessageStatusUpdated?: (payload: unknown) => void;
  onOperatorTyping?: (payload: unknown) => void;
  onAgentTyping?: (payload: unknown) => void;
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
    const onMessageStatusUpdated = (payload: unknown) => handlersRef.current.onMessageStatusUpdated?.(payload);
    const onOperatorTyping = (payload: unknown) => handlersRef.current.onOperatorTyping?.(payload);
    const onAgentTyping = (payload: unknown) => handlersRef.current.onAgentTyping?.(payload);

    socket.on("new_message", onNewMessage);
    socket.on("conversation_updated", onConversationUpdated);
    socket.on("agent_response_sent", onAgentResponseSent);
    socket.on("message_status_updated", onMessageStatusUpdated);
    socket.on("operator_typing", onOperatorTyping);
    socket.on("agent_typing", onAgentTyping);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("conversation_updated", onConversationUpdated);
      socket.off("agent_response_sent", onAgentResponseSent);
      socket.off("message_status_updated", onMessageStatusUpdated);
      socket.off("operator_typing", onOperatorTyping);
      socket.off("agent_typing", onAgentTyping);
      leaveWorkspace(workspaceId);
    };
  }, [workspaceId]);
}
