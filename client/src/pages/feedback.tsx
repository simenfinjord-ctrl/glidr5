import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { GlidrLogo } from "@/components/glidr-logo";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language";
import { fmtDate, cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Check } from "lucide-react";

type Item = {
  kind: "usage" | "prep"; id: number; date: string; location: string | null;
  discipline: string | null; distance: string | null; label: string; athleteRating: string | null; athleteComment: string | null;
};

const RATINGS = ["Competitive+", "Competitive", "Competitive-"];
const RATING_STYLE: Record<string, string> = {
  "Competitive+": "bg-emerald-500 text-white border-emerald-500",
  "Competitive": "bg-amber-400 text-amber-950 border-amber-400",
  "Competitive-": "bg-rose-500 text-white border-rose-500",
};
const keyOf = (it: Item) => `${it.kind}-${it.id}`;

export default function AthleteFeedback() {
  const params = useParams();
  const token = params.token;
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "en" ? en : no);

  const { data, isLoading, isError } = useQuery<{ athleteName: string; items: Item[] }>({
    queryKey: [`/api/feedback/${token}`],
    queryFn: async () => {
      const r = await fetch(`/api/feedback/${token}`);
      if (!r.ok) throw new Error("invalid");
      return r.json();
    },
    retry: false,
  });

  const [drafts, setDrafts] = useState<Record<string, { rating: string; comment: string }>>({});
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!data?.items) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const it of data.items) {
        const k = keyOf(it);
        if (!next[k]) next[k] = { rating: it.athleteRating ?? "", comment: it.athleteComment ?? "" };
      }
      return next;
    });
  }, [data]);

  const submit = useMutation({
    mutationFn: async (vars: { kind: string; id: number; rating: string; comment: string; key: string }) => {
      await apiRequest("POST", `/api/feedback/${token}`, { kind: vars.kind, id: vars.id, rating: vars.rating, comment: vars.comment });
      return vars;
    },
    onSuccess: (vars) => setSavedKeys((s) => new Set(s).add(vars.key)),
  });

  const byDate: Record<string, Item[]> = {};
  (data?.items ?? []).forEach((it) => { (byDate[it.date] ||= []).push(it); });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner /></div>;
  if (isError || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <GlidrLogo className="h-7" />
        <p className="text-muted-foreground">{L("Denne lenken er ikke lenger gyldig.", "This link is no longer valid.")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <GlidrLogo className="h-6" />
          <span className="text-sm text-muted-foreground">{L("Tilbakemelding", "Feedback")}</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">{data.athleteName}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {L("Ranger skiene etter hvordan de føltes, og legg gjerne til en kommentar. Smøreren din ser svaret.",
             "Rate how the skis felt and add a comment if you like. Your waxer sees the response.")}
        </p>

        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{L("Ingen renn å gi tilbakemelding på ennå.", "No races to give feedback on yet.")}</p>
        ) : (
          <div className="space-y-6">
            {dates.map((date, dateIdx) => {
              const isLatest = dateIdx === 0; // newest race — highlighted in yellow, shown on top
              return (
              <div key={date} className={cn(isLatest && "rounded-2xl bg-amber-50 dark:bg-amber-950/20 ring-1 ring-amber-300 dark:ring-amber-800 p-3 -mx-1")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn("text-xs font-semibold uppercase tracking-wider", isLatest ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                    {fmtDate(date)}{byDate[date][0].location ? ` · ${byDate[date][0].location}` : ""}
                  </div>
                  {isLatest && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">{L("Siste renn", "Latest race")}</span>}
                </div>
                <div className="space-y-3">
                  {byDate[date].map((it) => {
                    const k = keyOf(it);
                    const d = drafts[k] ?? { rating: "", comment: "" };
                    const saved = savedKeys.has(k);
                    return (
                      <div key={k} className="rounded-xl border border-border bg-card p-3" data-testid={`feedback-item-${k}`}>
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0">
                            <span className="font-semibold text-sm">
                              {it.label}
                              {it.kind === "prep" && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground align-middle">{L("Raceprep", "Race prep")}</span>}
                            </span>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="rounded-full bg-muted px-1.5 py-0.5">
                                {L("Distanse", "Distance")}: {it.distance || "—"}
                              </span>
                              <span className="rounded-full bg-muted px-1.5 py-0.5">
                                {L("Stilart", "Discipline")}: {it.discipline || "—"}
                              </span>
                            </div>
                          </div>
                          {saved && <span className="flex items-center gap-1 text-xs text-emerald-600 flex-shrink-0"><Check className="h-3.5 w-3.5" />{L("Lagret", "Saved")}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {RATINGS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setDrafts((p) => ({ ...p, [k]: { ...d, rating: r } }))}
                              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", d.rating === r ? RATING_STYLE[r] : "border-border text-muted-foreground hover:bg-muted")}
                              data-testid={`rating-${k}-${r}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={d.comment}
                          onChange={(e) => setDrafts((p) => ({ ...p, [k]: { ...d, comment: e.target.value } }))}
                          placeholder={L("Kommentar (valgfritt)…", "Comment (optional)…")}
                          className="h-9 text-sm mb-2"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            disabled={submit.isPending || !d.rating}
                            onClick={() => submit.mutate({ kind: it.kind, id: it.id, rating: d.rating, comment: d.comment, key: k })}
                            data-testid={`submit-feedback-${k}`}
                          >
                            {L("Send tilbakemelding", "Send feedback")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
        <p className="mt-8 text-center text-[11px] text-muted-foreground">{L("Drevet av Glidr", "Powered by Glidr")}</p>
      </div>
    </div>
  );
}
