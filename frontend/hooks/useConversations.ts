"use client";

import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import type { Channel, ConversationPage } from "@/lib/types";

export function useConversations(channel?: Channel | "all", status?: string) {
  const params = new URLSearchParams();
  if (channel && channel !== "all") params.set("channel", channel);
  if (status && status !== "all") params.set("status", status);
  const query = params.toString();

  return useSWR<ConversationPage>(`/api/conversations${query ? `?${query}` : ""}`, swrFetcher, {
    refreshInterval: 1000
  });
}
