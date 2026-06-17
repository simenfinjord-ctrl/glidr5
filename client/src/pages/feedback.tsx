import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { GlidrLogo } from "@/components/glidr-logo";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/language";
import { fmtDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Check } from "lucide-react";

type Usage = {
  id: number; date: string; location: string | null; discipline: string | null;
  skiId: string; brand: string | null; athleteRating: string | null; athleteComment: string | null;
};

const RATINGS = ["Competitive+", "Competitive", "Competitive-"];
const RATING_STYLE: Record<string, string> = {
  "Competitive+": "bg-emerald-500 text-white border-emerald-500",
  "Competitive": "bg-amber-400 text-amber-950 border-amber-400",
  "Competitive-": "bg-rose-500 text-white border-rose-500",
};

export default function AthleteFeedback() {
  const params = useParams();
  const token = params.token;
  const { lang } = useLanguage();
  const L = (no: string, en: string) => (lang === "en" ? en : no);

  const { data, isLoading, isError } = useQuery<{ athleteName: string; usages: Usage[] }>({
    queryKey: [`/api/feedback/${token}`],
    queryFn: async () => {
      const r = await fetch(`/api/feedback/${token}`);
      if (!r.ok) throw new Error("invalid");
      return r.json();
    },
    retry: false,
  });

  const [drafts, setDrafts] = useState<Record<number, { rating: string; comment: string }>>({});
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  // Seed drafts from any feedback already submitted.
  useEffect(() => {
    if (!data?.usages) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const u of data.usages) {
        if (!next[u.id]) next[u.id] = { rating: u.athleteRating ?? "", comment: u.athleteComment ?? "" };
      }
      return next;
    });
  }, [data]);

  const submit = useMutation({
    mutationFn: async (vars: { usageId: number; rating: string; comment: string }) => {
      await apiRequest("POST", `/api/feedback/${token}`, vars);
      return vars;
    },
    onSuccess: (vars) => setSavedIds((s) => new Set(s).add(vars.usageId)),
  });

  // Group by date (acts as the "calendar")
  const byDate: Record<string, Usage[]> = {};
  (data?.usages ?? []).forEach((u) => { (byDate[u.date] ||= []).push(u); });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner /></div>;
  }
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
            {dates.map((date) => (
              <div key={date}>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {fmtDate(date)}{byDate[date][0].location ? ` · ${byDate[date][0].location}` : ""}
                </div>
                <div className="space-y-3">
                  {byDate[date].map((u) => {
                    const d = drafts[u.id] ?? { rating: "", comment: "" };
                    const saved = savedIds.has(u.id);
                    return (
                      <div key={u.id} className="rounded-xl border border-border bg-card p-3" data-testid={`feedback-usage-${u.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm">{u.brand ? `${u.brand} ` : ""}{u.skiId}{u.discipline ? ` · ${u.discipline}` : ""}</span>
                          {saved && <span className="flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" />{L("Lagret", "Saved")}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {RATINGS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setDrafts((p) => ({ ...p, [u.id]: { ...d, rating: r } }))}
                              className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", d.rating === r ? RATING_STYLE[r] : "border-border text-muted-foreground hover:bg-muted")}
                              data-testid={`rating-${u.id}-${r}`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                        <Input
                          value={d.comment}
                          onChange={(e) => setDrafts((p) => ({ ...p, [u.id]: { ...d, comment: e.target.value } }))}
                          placeholder={L("Kommentar (valgfritt)…", "Comment (optional)…")}
                          className="h-9 text-sm mb-2"
                        />
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            disabled={submit.isPending || !d.rating}
                            onClick={() => submit.mutate({ usageId: u.id, rating: d.rating, comment: d.comment })}
                            data-testid={`submit-feedback-${u.id}`}
                          >
                            {L("Send tilbakemelding", "Send feedback")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-8 text-center text-[11px] text-muted-foreground">{L("Drevet av Glidr", "Powered by Glidr")}</p>
      </div>
    </div>
  );
}
