import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import {
  addMutation,
  getAllMutations,
  removeMutation,
  getMutationCount,
  setCachedData,
  getCachedData,
  generateId,
  type QueuedMutation,
} from "./offline-db";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "./queryClient";

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  queueMutation: (method: string, url: string, body?: unknown, description?: string) => Promise<void>;
  syncNow: () => Promise<void>;
  cacheQueryData: (key: string, data: unknown) => Promise<void>;
  getCachedQueryData: <T>(key: string) => Promise<T | null>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

// Endpoints that are pre-fetched and cached for offline use.
// These are the pages most likely to be visited in the field.
const PREFETCH_KEYS = [
  "/api/tests",
  "/api/products",
  "/api/weather",
  "/api/user",
  "/api/skis",
  "/api/athletes",
];

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const syncingRef = useRef(false);
  const hasPrefetchedRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await getMutationCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // ── Restore cached API data into React Query when going offline ───────────
  const restoreCacheToQueryClient = useCallback(async () => {
    for (const key of PREFETCH_KEYS) {
      const cached = await getCachedData(key);
      if (cached != null) {
        queryClient.setQueryData([key], cached);
      }
    }
    // Also restore any other keys that were cached via the query cache subscriber
    const cache = queryClient.getQueryCache();
    const allKeys = cache.getAll().map(q => q.queryKey[0] as string).filter(k => typeof k === "string" && k.startsWith("/api/"));
    for (const key of allKeys) {
      if (!PREFETCH_KEYS.includes(key)) {
        const cached = await getCachedData(key);
        if (cached != null) {
          queryClient.setQueryData([key], cached);
        }
      }
    }
  }, []);

  // ── Auto-cache every successful API fetch ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(async (event) => {
      if (event.type === "updated" && event.query.state.status === "success") {
        const key = event.query.queryKey[0];
        if (typeof key === "string" && key.startsWith("/api/") && event.query.state.data != null) {
          await setCachedData(key, event.query.state.data);
        }
      }
    });
    return unsubscribe;
  }, []);

  // ── Pre-fetch critical endpoints once after mount (while online) ──────────
  useEffect(() => {
    if (!navigator.onLine || hasPrefetchedRef.current) return;
    hasPrefetchedRef.current = true;

    const prefetch = async () => {
      for (const key of PREFETCH_KEYS) {
        try {
          // Only fetch if not already in React Query cache
          const existing = queryClient.getQueryData([key]);
          if (existing != null) {
            // Already in React Query cache — persist to IndexedDB too
            await setCachedData(key, existing);
            continue;
          }
          const res = await fetch(key, { credentials: "include" });
          if (res.ok) {
            const data = await res.json();
            queryClient.setQueryData([key], data);
            await setCachedData(key, data);
          }
        } catch {
          // Silently skip — prefetch is best-effort
        }
      }
    };

    // Delay slightly so the app has time to finish its own initial queries first
    const timer = setTimeout(prefetch, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Tilkoblet igjen",
        description: "Synkroniserer ventende endringer…",
      });
      syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Du er offline",
        description: "Endringer lagres lokalt og synkroniseres når du er tilkoblet igjen.",
      });
      restoreCacheToQueryClient();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [restoreCacheToQueryClient]);

  const queueMutation = useCallback(async (method: string, url: string, body?: unknown, description?: string) => {
    const mutation: QueuedMutation = {
      id: generateId(),
      method,
      url,
      body: body ? JSON.stringify(body) : null,
      timestamp: Date.now(),
      description: description || `${method} ${url}`,
    };
    await addMutation(mutation);
    await refreshCount();
  }, [refreshCount]);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setIsSyncing(true);

    try {
      const mutations = await getAllMutations();
      if (mutations.length === 0) {
        setIsSyncing(false);
        syncingRef.current = false;
        return;
      }

      const sorted = mutations.sort((a, b) => a.timestamp - b.timestamp);
      let successCount = 0;
      let failCount = 0;

      for (const m of sorted) {
        try {
          const res = await fetch(m.url, {
            method: m.method,
            headers: m.body ? { "Content-Type": "application/json" } : {},
            body: m.body || undefined,
            credentials: "include",
          });

          if (res.ok) {
            await removeMutation(m.id);
            successCount++;
          } else if (res.status >= 400 && res.status < 500) {
            await removeMutation(m.id);
            failCount++;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      await refreshCount();
      queryClient.invalidateQueries();

      if (successCount > 0) {
        toast({
          title: "Synkronisering fullført",
          description: `${successCount} endring${successCount > 1 ? "er" : ""} synkronisert.${failCount > 0 ? ` ${failCount} mislyktes.` : ""}`,
        });
      } else if (failCount > 0) {
        toast({
          title: "Synkroniseringsfeil",
          description: `${failCount} endring${failCount > 1 ? "er" : ""} kunne ikke synkroniseres.`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshCount, toast]);

  const cacheQueryData = useCallback(async (key: string, data: unknown) => {
    await setCachedData(key, data);
  }, []);

  const getCachedQueryData = useCallback(async <T,>(key: string): Promise<T | null> => {
    return getCachedData<T>(key);
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        pendingCount,
        isSyncing,
        queueMutation,
        syncNow,
        cacheQueryData,
        getCachedQueryData,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
}
