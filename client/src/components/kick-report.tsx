// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Kick analysis — lives on the Kick page (Kick has its own analysis, so it is
// no longer a tab under the product Analytics page).
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Cloud, FileText, MapPin, Sparkles, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtT } from "@/lib/temperature";

type KickRptSki = { id: number; name: string | null; brand: string | null; color: string | null };
type KickRptEntry = { id?: number; kickSkiId: number; binder: string | null; kickSolution: string | null; feelingRank: number | null; feelingNotes: string | null };
type KickRptTest = { id: number; date: string; location: string | null; weatherId: number | null; testPersons: string | null; notes: string | null; report: string | null; entries: KickRptEntry[] };
type KickRptWeather = { id: number; location: string; airTemperatureC: number | null; snowType: string | null; snowHumidityType: string | null };
type KickUse = { solution: string; binder: string | null; date: string; location: string | null; airTemp: number | null; snowType: string | null; feelingRank: number | null; feelingNotes: string | null; skiId: number };

export function KickReportView() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data: tests = [], isLoading } = useQuery<KickRptTest[]>({ queryKey: ["/api/kick-tests"] });
  const { data: skis = [] } = useQuery<KickRptSki[]>({ queryKey: ["/api/kick-skis"] });
  const { data: weather = [] } = useQuery<KickRptWeather[]>({ queryKey: ["/api/weather/for-filtering"] });
  const skiById = useMemo(() => new Map(skis.map((s) => [s.id, s])), [skis]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);
  const skiName = (id: number) => { const s = skiById.get(id); return s ? ([s.name, s.brand].filter(Boolean).join(" — ") || `Ski #${s.id}`) : "—"; };
  const [openSolution, setOpenSolution] = useState<string | null>(null);

  // Aggregate every kick entry by its kick solution, attaching test conditions.
  const solutions = useMemo(() => {
    const map = new Map<string, KickUse[]>();
    for (const test of tests) {
      const w = test.weatherId ? weatherById.get(test.weatherId) : null;
      for (const e of test.entries) {
        const sol = (e.kickSolution || "").trim();
        if (!sol) continue;
        const key = sol.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({
          solution: sol, binder: e.binder, date: test.date, location: test.location,
          airTemp: w?.airTemperatureC ?? null, snowType: w?.snowType ?? w?.snowHumidityType ?? null,
          feelingRank: e.feelingRank, feelingNotes: e.feelingNotes, skiId: e.kickSkiId,
        });
      }
    }
    return [...map.entries()].map(([key, uses]) => {
      const ranks = uses.map((u) => u.feelingRank).filter((r): r is number => typeof r === "number");
      return { key, solution: uses[0].solution, uses, count: uses.length, avgFeeling: ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null };
    }).sort((a, b) => (a.avgFeeling ?? 99) - (b.avgFeeling ?? 99));
  }, [tests, weatherById]);

  if (isLoading) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>;
  if (tests.length === 0) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Ingen kick-tester ennå. Legg dem inn under Kick.", "No kick tests yet. Add them under Kick.")}</Card>;

  const num = (n: number | null) => (n == null ? "—" : n.toFixed(1));

  return (
    <div className="space-y-6" data-testid="kick-report">
      {/* ── Per-solution analysis (tied to weather/snow) ── */}
      {solutions.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold">{L("Løsninger", "Solutions")}</h3>
            <p className="text-sm text-muted-foreground">
              {L("Hver kick-løsning på tvers av tester, koblet mot vær og snø/føre. Klikk for en skriftlig oppsummering.",
                 "Every kick solution across tests, tied to weather and snow/conditions. Click for a written summary.")}
            </p>
          </div>
          <div className="space-y-2">
            {solutions.map((s) => {
              const isOpen = openSolution === s.key;
              return (
                <Card key={s.key} className="fs-card rounded-2xl overflow-hidden">
                  <button type="button" onClick={() => setOpenSolution(isOpen ? null : s.key)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{s.solution}</div>
                      <div className="text-xs text-muted-foreground">{s.count} {L("bruk", "uses")}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-xs">
                      {s.avgFeeling != null && <span className="text-muted-foreground">{L("Feeling", "Feeling")} <span className="font-semibold text-foreground">{num(s.avgFeeling)}</span></span>}
                      {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 px-4 py-3 space-y-3">
                      <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 px-3 py-2 text-sm">
                        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1">
                          <Sparkles className="h-3.5 w-3.5" />{L("Oppsummering", "Summary")}
                        </div>
                        {buildKickSolutionSummary(s.uses, language)}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-3 font-medium">{L("Dato", "Date")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Ski", "Ski")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Binder", "Binder")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Føre", "Conditions")}</th>
                              <th className="py-1 pr-3 font-medium">{L("Feeling", "Feeling")}</th>
                              <th className="py-1 font-medium">{L("Notater", "Notes")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.uses.map((u, i) => (
                              <tr key={i} className="border-t">
                                <td className="py-1.5 pr-3 whitespace-nowrap">{u.date}</td>
                                <td className="py-1.5 pr-3">{skiName(u.skiId)}</td>
                                <td className="py-1.5 pr-3">{u.binder || "—"}</td>
                                <td className="py-1.5 pr-3 whitespace-nowrap">{u.airTemp != null ? `${fmtT(u.airTemp)}` : "—"}{u.snowType ? ` · ${u.snowType}` : ""}</td>
                                <td className="py-1.5 pr-3">{u.feelingRank ?? "—"}</td>
                                <td className="py-1.5 text-muted-foreground">{u.feelingNotes || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Per-test reports ── */}
      <div className="space-y-3">
      <h3 className="text-base font-semibold">{L("Tester", "Tests")}</h3>
      <p className="text-sm text-muted-foreground">
        {L("Tolket rapport fra hver kick-test, knyttet til vær/føre — grunnlaget for å forstå hva som gjøres når og gjenskape tidligere oppskrifter.",
           "Interpreted report from each kick test, tied to weather/conditions — the basis for understanding what works when and recreating past recipes.")}
      </p>
      {tests.map((test) => {
        const w = test.weatherId ? weatherById.get(test.weatherId) : null;
        return (
          <Card key={test.id} className="fs-card rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">{test.date}</span>
              {test.location && <span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{test.location}</span>}
              {w && <span className="inline-flex items-center gap-1 text-muted-foreground"><Cloud className="h-3.5 w-3.5" />{w.airTemperatureC != null ? `${fmtT(w.airTemperatureC)}` : w.location}</span>}
              {test.testPersons && <span className="inline-flex items-center gap-1 text-muted-foreground"><Users className="h-3.5 w-3.5" />{test.testPersons}</span>}
            </div>
            {test.report && (
              <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/15 px-3 py-2 text-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">
                  <FileText className="h-3.5 w-3.5" />{L("Rapport", "Report")}
                </div>
                {test.report}
              </div>
            )}
            {test.entries.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">{L("Ski", "Ski")}</th>
                      <th className="py-1 pr-3 font-medium">{L("Binder", "Binder")}</th>
                      <th className="py-1 pr-3 font-medium">{L("Kick-løsning", "Kick solution")}</th>
                      <th className="py-1 pr-3 font-medium">{L("Rank", "Rank")}</th>
                      <th className="py-1 font-medium">{L("Notater", "Notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {test.entries.map((e, i) => (
                      <tr key={e.id ?? i} className="border-t">
                        <td className="py-1.5 pr-3 font-medium">{skiName(e.kickSkiId)}</td>
                        <td className="py-1.5 pr-3">{e.binder || "—"}</td>
                        <td className="py-1.5 pr-3">{e.kickSolution || "—"}</td>
                        <td className="py-1.5 pr-3">{e.feelingRank ?? "—"}</td>
                        <td className="py-1.5 text-muted-foreground">{e.feelingNotes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {test.notes && <p className="mt-3 text-sm text-muted-foreground italic">{test.notes}</p>}
          </Card>
        );
      })}
      </div>
    </div>
  );
}

