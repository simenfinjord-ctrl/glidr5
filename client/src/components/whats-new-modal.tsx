import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";
import {
  RELEASES,
  LATEST_VERSION,
  getSeenVersion,
  markAsSeen,
  hasUnseenRelease,
} from "@/lib/whats-new";

interface WhatsNewModalProps {
  /** If true, the modal opens immediately (e.g. triggered by clicking the badge). */
  open?: boolean;
  onClose?: () => void;
}

export function WhatsNewModal({ open: controlledOpen, onClose }: WhatsNewModalProps) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "no";

  const [open, setOpen] = useState(false);

  // Auto-open once per release for users who haven't seen it yet
  useEffect(() => {
    if (controlledOpen !== undefined) return; // externally controlled
    if (hasUnseenRelease()) {
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);

  // Sync externally controlled open prop
  useEffect(() => {
    if (controlledOpen !== undefined) setOpen(controlledOpen);
  }, [controlledOpen]);

  function handleClose() {
    markAsSeen(LATEST_VERSION);
    setOpen(false);
    onClose?.();
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="bg-emerald-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-emerald-200" />
            <h2 className="text-white font-bold text-base">
              {lang === "no" ? "Hva er nytt i Glidr?" : "What's new in Glidr?"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-emerald-200 hover:text-white transition-colors"
            aria-label="Lukk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Releases */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {RELEASES.map((release, idx) => (
            <div key={release.version} className="px-6 py-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  {release.date[lang]}
                </span>
                {idx === 0 && (
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
                    {lang === "no" ? "Siste" : "Latest"}
                  </span>
                )}
              </div>
              <p className="font-semibold text-sm text-foreground mb-3">
                {release.title[lang]}
              </p>
              <ul className="space-y-2">
                {release.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed">
                    <span className="mt-0.5 text-base leading-none flex-shrink-0">{item.emoji}</span>
                    <span>{item[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted/30">
          <span className="text-xs text-muted-foreground">
            {lang === "no" ? "Oppdateres løpende" : "Updated continuously"}
          </span>
          <Button size="sm" onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {lang === "no" ? "Forstått" : "Got it"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Badge dot shown on top of the notification bell / trigger button. */
export function WhatsNewDot() {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    setUnseen(hasUnseenRelease());
    // Re-check when localStorage changes (other tabs)
    const handle = () => setUnseen(hasUnseenRelease());
    window.addEventListener("storage", handle);
    return () => window.removeEventListener("storage", handle);
  }, []);

  if (!unseen) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-background" />
  );
}
