// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Pull-to-refresh for the installed app. A PWA has no address bar, so when a
// page looks stale or a request hangs there is no way to reload short of
// killing the app. Pulling down from the top of the page refetches everything
// and checks for a new app version; pulling much further forces a hard reload,
// which also recovers a genuinely wedged page.
import { useEffect, useRef, useState } from "react";
import { queryClient } from "@/lib/queryClient";

const TRIGGER_PX = 70;   // pull this far to refresh
const HARD_PX = 170;     // pull this far for a full reload
const MAX_PULL = 110;    // how far the indicator travels

export function usePullToRefresh(ref: React.RefObject<HTMLElement>) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const active = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Coarse pointers only — a mouse wheel should never trigger this.
    if (!window.matchMedia?.("(pointer: coarse)").matches) return;

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return;
      // Only from the very top, so normal scrolling is untouched.
      active.current = el.scrollTop <= 0;
      start.current = active.current ? e.touches[0].clientY : null;
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || start.current == null || busy) return;
      const delta = e.touches[0].clientY - start.current;
      if (delta <= 0) {
        setPull(0);
        active.current = false;
        return;
      }
      // Resist the pull so it feels like rubber, and keep the page still.
      if (e.cancelable) e.preventDefault();
      setPull(Math.min(MAX_PULL, delta * 0.5));
    };

    const finish = async () => {
      const distance = pull;
      active.current = false;
      start.current = null;
      if (distance >= HARD_PX * 0.5) {
        // Pulled hard: full reload — recovers even a wedged page.
        window.location.reload();
        return;
      }
      if (distance >= TRIGGER_PX * 0.5) {
        setBusy(true);
        setPull(TRIGGER_PX * 0.5);
        try {
          await queryClient.invalidateQueries();
          const reg = await navigator.serviceWorker?.getRegistration();
          await reg?.update().catch(() => {});
        } finally {
          setTimeout(() => { setBusy(false); setPull(0); }, 450);
        }
        return;
      }
      setPull(0);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", finish, { passive: true });
    el.addEventListener("touchcancel", finish, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove as EventListener);
      el.removeEventListener("touchend", finish);
      el.removeEventListener("touchcancel", finish);
    };
  }, [ref, pull, busy]);

  return { pull, busy };
}

/** The spinner that follows the pull. Rendered inside the scroll container. */
export function PullIndicator({ pull, busy }: { pull: number; busy: boolean }) {
  if (pull <= 0 && !busy) return null;
  const ready = pull >= TRIGGER_PX * 0.5;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
      style={{ transform: `translateY(${Math.max(8, pull - 20)}px)`, opacity: Math.min(1, pull / 30) }}
      data-testid="pull-to-refresh"
    >
      <div className="rounded-full bg-card shadow-md ring-1 ring-border p-2">
        <svg
          className={busy ? "animate-spin" : ""}
          style={{ transform: busy ? undefined : `rotate(${pull * 3}deg)` }}
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={ready || busy ? "hsl(var(--primary))" : "currentColor"}
          strokeWidth="2.2" strokeLinecap="round"
        >
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </div>
    </div>
  );
}
