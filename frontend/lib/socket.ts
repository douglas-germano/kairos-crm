"use client";

import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth";

const DEFAULT_SOCKET_URL =
  process.env.NODE_ENV === "production"
    ? "https://backend-production-33ef.up.railway.app"
    : "http://localhost:5001";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || DEFAULT_SOCKET_URL;

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false
    } as Parameters<typeof io>[1]);
  }
  return socket;
}

export function joinWorkspace(workspaceId: number) {
  const token = getAccessToken();
  const activeSocket = getSocket();
  if (!activeSocket.connected) activeSocket.connect();
  activeSocket.emit("join_workspace", { workspace_id: workspaceId, token });
}

export function leaveWorkspace(workspaceId: number) {
  getSocket().emit("leave_workspace", { workspace_id: workspaceId });
}

export function emitTyping(workspaceId: number, conversationId: number, isTyping: boolean) {
  const token = getAccessToken();
  getSocket().emit("typing", {
    workspace_id: workspaceId,
    conversation_id: conversationId,
    is_typing: isTyping,
    token,
  });
}
