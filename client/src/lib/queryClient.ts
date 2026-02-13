import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { setCachedData, getCachedData } from "./offline-db";

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
    throw new OfflineError(method, url, data);
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
