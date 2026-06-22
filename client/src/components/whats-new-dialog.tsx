// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// #39: a center-screen "What's new" popup shown once per release. Users can
// opt out of future popups. Bump WHATS_NEW_VERSION and edit the items when you
// ship notable updates.
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/lib/language";

export const WHATS_NEW_VERSION = "2026-06-21";

const ITEMS: { no: string; en: string }[] = [
  { no: "Fritekst-ski og -produkt i tester (lånt utstyr) som ikke påvirker analysen.", en: "Free-text ski/product in tests (borrowed gear) excluded from analytics." },
  { no: "Sorterbare resultatkolonner i race-ski-tester — huskes per smører.", en: "Sortable result columns in race-ski tests — remembered per waxer." },
  { no: "Kick-solution per skipar på klassisk-tester, og «Rangér på diff/feeling».", en: "Kick solution per ski pair on classic tests, and Rank by diff/feel." },
  { no: "Testfleets: slipehistorikk og Action-status (Need regrind / In use …).", en: "Testfleets: regrind history and Action status (Need regrind / In use …)." },
  { no: "Garage: farge-sortering, US-Grind-filter, og «Antall renn» per skipar.", en: "Garage: colour sort, US-Grind filter, and times-raced per ski pair." },
  { no: "«Ikke legg til vær», valgfri dato på løpsbruk, og Feedback-knapp.", en: "“Do not add weather”, optional race-use date, and a Feedback button." },
];

const KEY = "glidr-whatsnew-seen";
const MUTE_KEY = "glidr-whatsnew-mute";

export function WhatsNewDialog() {
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "en" ? en : no);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(MUTE_KEY) === "1") return;
      if (localStorage.getItem(KEY) !== WHATS_NEW_VERSION) {
        const t = setTimeout(() => setOpen(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, WHATS_NEW_VERSION);
      if (dontShow) localStorage.setItem(MUTE_KEY, "1");
    } catch {}
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md" data-testid="whats-new-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {L("Nytt i Glidr", "What's new in Glidr")}
          </DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {ITEMS.map((it, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{L(it.no, it.en)}</span>
            </li>
          ))}
        </ul>
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
