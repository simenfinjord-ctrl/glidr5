// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { setCachedData, getCachedData, addMutation, generateId } from "./offline-db";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// A stalled request must fail fast and retry instead of hanging the page
// forever (Render cold start, mobile network dropping mid-request). Reads get
// a shorter leash than writes — writes that time out are queued offline.
const READ_TIMEOUT_MS = 20_000;
const WRITE_TIMEOUT_MS = 30_000;
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(ms)
    : undefined;
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

// Save a write to the replay queue and return a synthetic success so the
// mutation's onSuccess runs optimistically. The body is echoed back so field
// reads work; server-generated ids are filled in on sync/refresh.
async function queueOfflineWrite(method: string, url: string, data?: unknown): Promise<Response> {
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
    // If we can't even queue it, surface it explicitly rather than silently
    // losing the change.
    throw new OfflineError(method, url, data);
  }
  try { window.dispatchEvent(new Event("glidr-offline-queued")); } catch {}
  return new Response(JSON.stringify(data ?? { queuedOffline: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Known-offline: queue writes immediately (works for EVERY page).
  if (!navigator.onLine && method !== "GET") {
    return queueOfflineWrite(method, url, data);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: timeoutSignal(WRITE_TIMEOUT_MS),
    });
  } catch (networkErr) {
    // "Connected but no data" — the mountain case: navigator.onLine is true but
    // the request never reached the server (fetch threw, no HTTP response).
    // Queue the write instead of losing it. Server rejections (4xx/5xx) do NOT
    // land here — they produce a response and are thrown below as before.
    if (method !== "GET") {
      return queueOfflineWrite(method, url, data);
    }
    throw networkErr;
  }

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
        signal: timeoutSignal(READ_TIMEOUT_MS),
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
      // Fall back to the local copy on any NETWORK-shaped failure, not only
      // when navigator.onLine is false. The field case is precisely the
      // opposite: connected to a mast, but no data gets through — fetch
      // throws or times out while onLine still reads true. Real server
      // answers (401/403/404, validation errors) are NOT network failures
      // and must keep throwing, or stale data would mask revoked access.
      const msg = err instanceof Error ? err.message : "";
      const isServerAnswer = /^\d{3}:/.test(msg) && !msg.startsWith("503:");
      if (!isServerAnswer) {
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
      // Refetch when the app regains focus — critical for the installed PWA,
      // where there is no address bar to pull-refresh with. staleTime still
      // throttles so quick app switches don't hammer the API.
      refetchOnWindowFocus: true,
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
