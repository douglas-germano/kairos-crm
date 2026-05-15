"use client";

import useSWR from "swr";
import { swrFetcher } from "@/lib/api";
import type { Agent, Flow } from "@/lib/types";

export function useAgents() {
  return useSWR<Agent[]>("/api/agents", swrFetcher);
}

export function useAgent(agentId?: number) {
  return useSWR<Agent>(agentId ? `/api/agents/${agentId}` : null, swrFetcher);
}

export function useFlows(agentId?: number) {
  return useSWR<Flow[]>(agentId ? `/api/flows?agent_id=${agentId}` : "/api/flows", swrFetcher);
}
