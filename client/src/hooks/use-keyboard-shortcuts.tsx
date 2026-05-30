// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Global keyboard shortcuts for Glidr
import { useEffect } from "react";
import { useLocation } from "wouter";

type ShortcutMap = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  description: string;
  action: () => void;
};

export function useKeyboardShortcuts(shortcuts: ShortcutMap[]) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't fire when typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      for (const s of shortcuts) {
        const metaMatch = s.meta ? e.metaKey : true;
        const ctrlMatch = s.ctrl ? e.ctrlKey : true;
        const shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        if (
          e.key.toLowerCase() === s.key.toLowerCase() &&
          metaMatch && ctrlMatch && shiftMatch &&
          !e.metaKey && !e.ctrlKey // plain keys only unless meta/ctrl explicitly required
        ) {
          if (s.meta || s.ctrl) {
            if (s.meta && !e.metaKey) continue;
            if (s.ctrl && !e.ctrlKey) continue;
          } else {
            if (e.metaKey || e.ctrlKey) continue; // don't hijack Cmd/Ctrl+key combos
          }
          e.preventDefault();
          s.action();
          return;
        }
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

/** Page-level shortcuts wired up in app-shell */
export function useGlobalShortcuts() {
  const [, navigate] = useLocation();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          window.dispatchEvent(new Event("glidr-open-search"));
          break;
        case "g":
          // g+h = go home (dashboard)
          break;
        default:
          break;
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);
}
