// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { setCachedData, getCachedData, addMutation, generateId } from "./offline-db";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export class OfflineError extends Error {
  constructor(
    public method: string,
    public url: string,
    public body?: unknown,
  ) {
    super("You are offline. This change has been saved locally and will sync when you reconnect.");
    this.name = "OfflineError";
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  if (!navigator.onLine && method !== "GET") {
    // Offline: save the change to the replay queue (works for EVERY page, not
    // just the few that catch OfflineError), then return a synthetic success so
    // the mutation's onSuccess runs optimistically. The body is echoed back so
    // field reads work; server-generated ids are filled in on sync/refresh.
    try {
      await addMutation({
        id: generateId(),
        method,
        url,
        body: data != null ? JSON.stringify(data) : null,
        timestamp: Date.now(),
        description: `${method} ${url}`,
      });
    } catch {
      // If we can't even queue it, fall back to the old behaviour so the caller
      // can handle it explicitly rather than silently losing the change.
      throw new OfflineError(method, url, data);
    }
    try { window.dispatchEvent(new Event("glidr-offline-queued")); } catch {}
    return new Response(JSON.stringify(data ?? { queuedOffline: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const cacheKey = queryKey.join("/");

    try {
      const res = await fetch(cacheKey as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      if (res.status === 401) {
        // A single data-endpoint 401 must NOT force a global logout: during a
        // redeploy/restart the session store can briefly reconnect and return a
        // transient 401 even though the real session (stored in Postgres) is
        // intact. Wiping ["/api/auth/me"] here caused spurious logouts. Instead
        // we just fail this one query; /api/auth/me stays the source of truth
        // (re-checked on reload), so a genuine logout is still caught.
        throw new Error("401: Unauthorized");
      }

      await throwIfResNotOk(res);
      const data = await res.json();

      if (cacheKey.startsWith("/api/")) {
        setCachedData(cacheKey, data).catch(() => {});
      }

      return data;
    } catch (err) {
      if (!navigator.onLine) {
        const cached = await getCachedData(cacheKey);
        if (cached !== null) return cached;
      }
      throw err;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) return false;
        if (error instanceof Error && error.message === "Session expired") return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
