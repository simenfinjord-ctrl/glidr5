import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import {
  addMutation,
  getAllMutations,
  removeMutation,
  getMutationCount,
  addFailedMutation,
  setCachedData,
  getCachedData,
  generateId,
  type QueuedMutation,
} from "./offline-db";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "./language";
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
  "/api/auth/me",
  "/api/user/teams",
  "/api/tests",
  "/api/products",
  "/api/weather",
  "/api/user",
  "/api/skis",
  "/api/athletes",
  "/api/groups",
  "/api/testskis",
  "/api/race-prep",
  "/api/suggestions",
];

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;
  const tr = (no: string, en: string) => (langRef.current === "no" ? no : en);
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
      const failedDescriptions: string[] = [];

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
            // Server rejected the change. NEVER drop it silently — move it to
            // the failed store with the server's reason so it can be inspected.
            let reason = `HTTP ${res.status}`;
            try { reason = `${res.status}: ${(await res.text()).slice(0, 200)}`; } catch {}
            await addFailedMutation({ ...m, error: reason, failedAt: Date.now() }).catch(() => {});
            await removeMutation(m.id);
            failCount++;
            failedDescriptions.push(m.description);
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
          title: tr("Synkronisering fullført", "Sync complete"),
          description: tr(
            `${successCount} endring${successCount > 1 ? "er" : ""} synkronisert.${failCount > 0 ? ` ${failCount} mislyktes.` : ""}`,
            `${successCount} change${successCount > 1 ? "s" : ""} synced.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
          ),
        });
      } else if (failCount > 0) {
        toast({
          title: tr("Synkroniseringsfeil", "Sync error"),
          description: tr(
            `${failCount} endring${failCount > 1 ? "er" : ""} ble avvist av serveren: ${failedDescriptions.slice(0, 3).join(", ")}${failCount > 3 ? " …" : ""}`,
            `${failCount} change${failCount > 1 ? "s" : ""} rejected by the server: ${failedDescriptions.slice(0, 3).join(", ")}${failCount > 3 ? " …" : ""}`,
          ),
          variant: "destructive",
        });
      }
    } finally {
      setIsSyncing(false);
      syncingRef.current = false;
    }
  }, [refreshCount, toast]);

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

      // Also pre-cache the RESULT ROWS of the most recent tests, so tests can
      // be opened (not just listed) without coverage in the field.
      try {
        const tests = (queryClient.getQueryData(["/api/tests"]) as any[]) ?? [];
        const recent = [...tests]
          .sort((a, b) => String(b?.date ?? "").localeCompare(String(a?.date ?? "")))
          .slice(0, 20);
        for (const t of recent) {
          const entriesKey = `/api/tests/${t.id}/entries`;
          if (queryClient.getQueryData([entriesKey]) != null) continue;
          try {
            const r = await fetch(entriesKey, { credentials: "include" });
            if (r.ok) {
              const entries = await r.json();
              queryClient.setQueryData([entriesKey], entries);
              await setCachedData(entriesKey, entries);
            }
          } catch { /* best-effort */ }
        }
      } catch { /* best-effort */ }
    };

    // Delay slightly so the app has time to finish its own initial queries first
    const timer = setTimeout(prefetch, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: tr("Tilkoblet igjen", "Back online"),
        description: tr("Synkroniserer ventende endringer…", "Syncing pending changes…"),
      });
      syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: tr("Du er offline", "You are offline"),
        description: tr("Endringer lagres lokalt og synkroniseres når du er tilkoblet igjen.", "Changes are saved locally and synced when you're back online."),
      });
      restoreCacheToQueryClient();
    };

    // apiRequest fires this after auto-queuing an offline write, so the pending
    // badge updates immediately app-wide.
    const handleQueued = () => { refreshCount(); };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("glidr-offline-queued", handleQueued);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("glidr-offline-queued", handleQueued);
    };
  }, [restoreCacheToQueryClient, syncNow, refreshCount]);

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
