"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { apiFetch, swrFetcher } from "@/lib/api";
import { clearTokens, getAccessToken, setTokens } from "@/lib/auth";
import type { User, Workspace } from "@/lib/types";

type MeResponse = {
  user: User;
  workspaces: Workspace[];
};

type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: User;
  workspace?: Workspace;
};

export function useAuth(requireAuth = true) {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    setHasToken(Boolean(token));
    if (requireAuth && !token) {
      router.replace("/login");
    }
  }, [requireAuth, router]);

  const { data, error, isLoading, mutate } = useSWR<MeResponse>(hasToken ? "/auth/me" : null, swrFetcher);

  async function login(email: string, password: string) {
    const response = await apiFetch<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuth: true
      }
    );
    setTokens(response.access_token, response.refresh_token);
    setHasToken(true);
    await mutate();
    router.replace("/conversations");
  }

  async function register(name: string, email: string, password: string) {
    const response = await apiFetch<AuthResponse>(
      "/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
        skipAuth: true
      }
    );
    setTokens(response.access_token, response.refresh_token);
    setHasToken(true);
    await mutate();
    router.replace("/conversations");
  }

  function logout() {
    clearTokens();
    setHasToken(false);
    router.replace("/login");
  }

  return {
    user: data?.user,
    workspace: data?.workspaces?.[0],
    workspaces: data?.workspaces ?? [],
    isLoading: hasToken && isLoading,
    error,
    login,
    register,
    logout,
    mutate
  };
}
