// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// #9: a center-screen "What's new" popup shown once per release note. The note
// is authored by the Super Admin (Admin → What's new) with a type
// (feature / fix / update); it pops up once per note id. Users can opt out.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/language";
import { getQueryFn } from "@/lib/queryClient";

type WhatsNew = { id: number; type: "feature" | "fix" | "update"; text: string } | null;

const SEEN_KEY = "glidr-whatsnew-seen-id";
const MUTE_KEY = "glidr-whatsnew-mute";

const TYPE_STYLE: Record<string, string> = {
  feature: "bg-emerald-100 text-emerald-700 ring-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300",
  fix: "bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300",
  update: "bg-sky-100 text-sky-700 ring-sky-300 dark:bg-sky-900/30 dark:text-sky-300",
};

export function WhatsNewDialog() {
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "en" ? en : no);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const { data } = useQuery<WhatsNew>({
    queryKey: ["/api/whats-new"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (!data?.id) return;
    try {
      if (localStorage.getItem(MUTE_KEY) === "1") return;
      if (localStorage.getItem(SEEN_KEY) !== String(data.id)) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [data?.id]);

  const close = () => {
    try {
      if (data?.id) localStorage.setItem(SEEN_KEY, String(data.id));
      if (dontShow) localStorage.setItem(MUTE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  if (!data) return null;
  const typeLabel = data.type === "feature" ? L("Ny funksjon", "New feature")
    : data.type === "fix" ? L("Feilretting", "Bug fix")
    : L("Oppdatering", "Update");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md" data-testid="whats-new-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {L("Nytt i Glidr", "What's new in Glidr")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TYPE_STYLE[data.type] ?? TYPE_STYLE.update}`}>
            {typeLabel}
          </span>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.text}</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)} className="h-3.5 w-3.5" data-testid="whats-new-dont-show" />
            {L("Ikke vis slike oppdateringer igjen", "Don't show these updates again")}
          </label>
          <Button size="sm" onClick={close} data-testid="whats-new-close">{L("Skjønner", "Got it")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
