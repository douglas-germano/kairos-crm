"use client";

import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth";

const DEFAULT_API_URL =
  process.env.NODE_ENV === "production"
    ? "https://backend-production-33ef.up.railway.app"
    : "http://localhost:5001";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ApiOptions = RequestInit & {
  skipAuth?: boolean;
};

let _refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${refreshToken}`
      }
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = (await response.json()) as { access_token: string };
    setTokens(data.access_token, refreshToken);
    return data.access_token;
  })().finally(() => {
    _refreshPromise = null;
  });

  return _refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getAccessToken();

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && retry && !options.skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, false);
    }
  }

  if (!response.ok) {
    let message = "Falha na requisição";
    let code: string | undefined;
    try {
      const data = await response.json();
      message = data.error || message;
      code = data.code;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const swrFetcher = <T>(path: string) => apiFetch<T>(path);
