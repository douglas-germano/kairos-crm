"use client";

import { io, Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/auth";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5001";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: false
    });
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
