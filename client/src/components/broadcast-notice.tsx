// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Soft, dismissible "updates in progress" notice shown to all users when the
// Super Admin enables it. Non-blocking banner; standard localized text.
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { getQueryFn } from "@/lib/queryClient";

const DISMISS_KEY = "glidr-broadcast-dismissed";

export function BroadcastNotice() {
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "en" ? en : no);
  const { data } = useQuery<{ enabled: boolean; updatedAt: number }>({
    queryKey: ["/api/broadcast-notice"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 60000,
  });
  const [dismissedAt, setDismissedAt] = useState<number>(() => {
    try { return Number(localStorage.getItem(DISMISS_KEY)) || 0; } catch { return 0; }
  });

  // A fresh toggle (new updatedAt) re-shows the notice even if dismissed before.
  useEffect(() => {
    if (data?.enabled && data.updatedAt && data.updatedAt > dismissedAt) {
      // nothing to do — render handles it
    }
  }, [data, dismissedAt]);

  if (!data?.enabled || !data.updatedAt || data.updatedAt <= dismissedAt) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(data.updatedAt)); } catch {}
    setDismissedAt(data.updatedAt);
  };

  return (
    <div className="sticky top-0 z-50 flex items-start gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200" data-testid="broadcast-notice">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{L("Oppdateringer pågår.", "Updates in progress.")}</span>{" "}
        {L("Vi gjør forbedringer på Glidr akkurat nå. Tjenesten kan være ustabil til vi er ferdige — takk for tålmodigheten!",
           "We're improving Glidr right now. The service may be unstable until we're done — thanks for your patience!")}
      </div>
      <button onClick={dismiss} className="shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40" title={L("Lukk", "Dismiss")} data-testid="broadcast-dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
