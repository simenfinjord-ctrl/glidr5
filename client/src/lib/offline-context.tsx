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

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    const count = await getMutationCount();
    setPendingCount(count);
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({ title: "Back online", description: "Syncing pending changes..." });
      syncNow();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast({ title: "You are offline", description: "Changes will be saved locally and synced when you reconnect." });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
          title: "Sync complete",
          description: `${successCount} change${successCount > 1 ? "s" : ""} synced successfully.${failCount > 0 ? ` ${failCount} failed.` : ""}`,
        });
      } else if (failCount > 0) {
        toast({
          title: "Sync issues",
          description: `${failCount} change${failCount > 1 ? "s" : ""} could not be synced.`,
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
