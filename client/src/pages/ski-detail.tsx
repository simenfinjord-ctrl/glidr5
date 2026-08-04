// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// One ski pair's page: header stats plus every test the pair took part in,
// with the pair's own row highlighted — same idea as the product detail page.
// Reached from "Show tests" on a pair (Athlete Skis / Race fleets) and from
// the fleet Analytics tab.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowLeft, Trophy, TrendingUp, FlaskConical, Flag, Thermometer, Snowflake } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";
import { cn, fmtDate } from "@/lib/utils";
import { fmtT } from "@/lib/temperature";

type SkiTestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  raceSkiId: number | null;
  productId: number | null;
  freeTextProduct: string | null;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  results: string | null;
  feelingRank: number | null;
  skiLabel: string | null;
  fleetGroup: string | null;
  productBrand: string | null;
  productName: string | null;
};

type SkiTest = {
  id: number;
  date: string;
  location: string;
  testType: string;
  notes: string | null;
  weatherId: number | null;
  resultUnit: string | null;
  athleteId: number | null;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  airHumidityPct: number | null;
  snowHumidityPct: number | null;
  snowType: string | null;
  artificialSnow: number | null;
  naturalSnow: number | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  wind: string | null;
  clouds: number | null;
  precipitation: string | null;
};

type SkiTestsResponse = {
  ski: {
    id: number; skiId: string; serialNumber: string | null; brand: string | null;
    discipline: string; grind: string | null; athleteId: number;
    fleetGroup?: string | null; isTrainingSki?: number; isSitski?: number;
  };
  tests: SkiTest[];
  entriesByTestId: Record<number, SkiTestEntry[]>;
  racedCount: number;
};

function avgResult(e: SkiTestEntry): number | null {
  try {
    if (e.results) {
      const arr = JSON.parse(e.results);
      if (Array.isArray(arr)) {
        const vals = arr
          .map((r: any) => (r && r.result != null ? Number(r.result) : NaN))
          .filter((v: number) => !Number.isNaN(v));
        if (vals.length > 0) return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      }
    }
  } catch {}
  return e.result0kmCmBehind ?? null;
}

function denseRanks(entries: SkiTestEntry[]): Map<number, number> {
  const scored = entries
    .map((e) => ({ id: e.id, v: avgResult(e) }))
    .filter((x): x is { id: number; v: number } => x.v != null)
    .sort((a, b) => a.v - b.v);
  const map = new Map<number, number>();
  let prev: number | null = null;
  let rank = 0;
  scored.forEach((sc, i) => {
    if (prev === null || sc.v !== prev) rank = i + 1;
    map.set(sc.id, rank);
    prev = sc.v;
  });
  return map;
}

const fmtAvg = (v: number | null) => (v == null ? "—" : String(Math.round(v * 1000) / 1000));

// Every weather value the page can show, with a presence check per test —
// drives both the per-test chips and the on/off toggles at the top.
const WEATHER_FIELDS: { key: string; no: string; en: string; has: (t: SkiTest) => boolean }[] = [
  { key: "air", no: "Lufttemp", en: "Air temp", has: (t) => t.airTemperatureC != null },
  { key: "snow", no: "Snøtemp", en: "Snow temp", has: (t) => t.snowTemperatureC != null },
  { key: "airhum", no: "Luftfukt", en: "Air humidity", has: (t) => t.airHumidityPct != null },
  { key: "snowhum", no: "Snøfukt", en: "Snow humidity", has: (t) => t.snowHumidityPct != null },
  { key: "snowtype", no: "Snøtype", en: "Snow type", has: (t) => !!t.snowType },
  { key: "grain", no: "Kornstørrelse", en: "Grain size", has: (t) => !!t.grainSize },
  { key: "shtype", no: "Snøfukt-type", en: "Snow humidity type", has: (t) => !!t.snowHumidityType },
  { key: "track", no: "Sporhardhet", en: "Track hardness", has: (t) => !!t.trackHardness },
  { key: "snowkind", no: "Kunst/natursnø", en: "Artificial/natural", has: (t) => t.artificialSnow === 1 || t.naturalSnow === 1 },
  { key: "precip", no: "Nedbør", en: "Precipitation", has: (t) => !!t.precipitation },
  { key: "wind", no: "Vind", en: "Wind", has: (t) => !!t.wind },
  { key: "clouds", no: "Skydekke", en: "Cloud cover", has: (t) => t.clouds != null },
];

export default function SkiDetail() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, params] = useRoute("/ski/:id");
  const skiId = params?.id ? parseInt(params.id) : null;

  const { data, isLoading, error } = useQuery<SkiTestsResponse>({
    queryKey: [`/api/race-skis/${skiId}/tests`],
    enabled: skiId != null,
  });

  // Is this a fleet pair? Then nav + back-link belong to Race fleets.
  const { data: fleetInfo } = useQuery<{ athleteId: number }>({
    queryKey: ["/api/race-fleet/athlete"],
    retry: false,
  });
  const isFleetSki = data != null && fleetInfo != null && data.ski.athleteId === fleetInfo.athleteId;

  const stats = useMemo(() => {
    if (!data) return null;
    let totalTests = 0;
    let wins = 0;
    const ranks: number[] = [];
    for (const test of data.tests) {
      const entries = data.entriesByTestId[test.id] ?? [];
      const rankMap = denseRanks(entries.filter((e) => e.raceSkiId));
      const mine = entries.filter((e) => e.raceSkiId === data.ski.id);
      if (mine.length === 0) continue;
      totalTests++;
      for (const e of mine) {
        const r = rankMap.get(e.id);
        if (r != null) {
          ranks.push(r);
          if (r === 1) wins++;
        }
      }
    }
    const avgRank = ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
    return { totalTests, wins, avgRank };
  }, [data]);

  const backHref = isFleetSki ? "/race-fleet" : data ? `/raceskis/${data.ski.athleteId}` : "/raceskis";

  // Weather display toggles: all on by default; only fields this pair's tests
  // actually carry are offered.
  const [hiddenWeather, setHiddenWeather] = useState<Set<string>>(new Set());
  const usedWeatherFields = useMemo(() => {
    if (!data) return [];
    return WEATHER_FIELDS.filter((f) => data.tests.some((t) => f.has(t)));
  }, [data]);
  function toggleWeatherField(key: string) {
    setHiddenWeather((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <AppShell activeNav={isFleetSki ? "/race-fleet" : "/raceskis"}>
      <div className="flex flex-col gap-5">
        <div>
          <AppLink href={backHref} testId="link-back-garage">
            <Button variant="ghost" size="sm" data-testid="button-back-garage">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isFleetSki ? L("Tilbake til Race fleets", "Back to Race fleets") : L("Tilbake til garasjen", "Back to garage")}
            </Button>
          </AppLink>
          {isLoading ? (
            <Card className="fs-card mt-3 flex items-center gap-3 rounded-2xl p-6 text-sm text-muted-foreground"><Spinner />{L("Laster…", "Loading…")}</Card>
          ) : error || !data ? (
            <Card className="fs-card mt-3 rounded-2xl p-6 text-sm text-muted-foreground">{L("Fant ikke skiparet.", "Ski pair not found.")}</Card>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl" data-testid="text-ski-title">{data.ski.skiId}</h1>
                {data.ski.fleetGroup && (
                  <span className="rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">{data.ski.fleetGroup}</span>
                )}
                {data.ski.isSitski === 1 && (
                  <span className="rounded-full bg-fuchsia-100 dark:bg-fuchsia-900/30 px-2 py-0.5 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300">{L("Sitski", "Sit-ski")}</span>
                )}
                {data.ski.isTrainingSki === 1 && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">{L("Treningsski", "Training ski")}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[data.ski.brand, data.ski.discipline, data.ski.grind, data.ski.serialNumber ? `#${data.ski.serialNumber}` : null].filter(Boolean).join(" · ")}
              </p>

              {/* Stat cards */}
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { icon: FlaskConical, label: L("Totalt tester", "Total tests"), value: String(stats?.totalTests ?? 0), sub: null },
                  { icon: Trophy, label: L("Førsteplasser", "#1 finishes"), value: String(stats?.wins ?? 0), sub: L("basert på snitt av alle runder", "based on average of all runs") },
                  { icon: TrendingUp, label: L("Snittrangering", "Avg rank"), value: stats?.avgRank != null ? stats.avgRank.toFixed(1) : "—", sub: null },
                  { icon: Flag, label: L("Ganger i renn", "Times raced"), value: String(data.racedCount), sub: L("løpsbruk + Race Prep", "race use + Race Prep") },
                ].map((c) => (
                  <Card key={c.label} className="fs-card rounded-2xl p-4" data-testid={`stat-${c.label}`}>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><c.icon className="h-3.5 w-3.5" />{c.label}</div>
                    <div className="mt-1 text-2xl font-bold">{c.value}</div>
                    {c.sub && <div className="text-[10px] text-muted-foreground">{c.sub}</div>}
                  </Card>
                ))}
              </div>

              {usedWeatherFields.length > 0 && (
                <div className="mt-4" data-testid="weather-field-toggles">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Værdata som vises", "Weather data shown")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {usedWeatherFields.map((f) => {
                      const on = !hiddenWeather.has(f.key);
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => toggleWeatherField(f.key)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
                            on ? "bg-primary/10 text-primary ring-primary/40" : "bg-muted/40 text-muted-foreground/60 ring-border line-through"
                          )}
                          data-testid={`toggle-weather-${f.key}`}
                        >
                          {L(f.no, f.en)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Test history */}
              <h2 className="mt-6 mb-1 flex items-center gap-2 text-lg font-semibold">
                <FlaskConical className="h-5 w-5 text-primary" />{L("Testhistorikk", "Test History")}
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {data.tests.length === 1 ? L("1 test funnet", "1 test found") : L(`${data.tests.length} tester funnet`, `${data.tests.length} tests found`)}
              </p>
              {data.tests.length === 0 ? (
                <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Dette skiparet har ikke vært med i noen tester ennå.", "This pair has not taken part in any tests yet.")}</Card>
              ) : (
                <div className="space-y-3">
                  {data.tests.map((test) => {
                    const entries = (data.entriesByTestId[test.id] ?? []).filter((e) => e.raceSkiId || avgResult(e) != null);
                    const rankMap = denseRanks(entries);
                    const isTime = test.resultUnit === "time";
                    return (
                      <Card key={test.id} className="fs-card rounded-2xl p-4" data-testid={`ski-test-${test.id}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{test.location}</span>
                            <span className="text-sm text-muted-foreground">{fmtDate(test.date)}</span>
                            <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-800">{test.testType}</span>
                          </div>
                          <AppLink href={`/tests/${test.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" data-testid={`button-open-test-${test.id}`}>{L("Åpne", "Open")}</Button>
                          </AppLink>
                        </div>
                        {(() => {
                          // Every recorded weather value for the day, as chips.
                          const chips: { key: string; label: string; icon?: any; cls?: string }[] = [];
                          if (!hiddenWeather.has("air") && test.airTemperatureC != null) chips.push({ key: "air", label: `${L("Luft", "Air")} ${fmtT(test.airTemperatureC)}`, icon: Thermometer, cls: "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-800" });
                          if (!hiddenWeather.has("snow") && test.snowTemperatureC != null) chips.push({ key: "snow", label: `${L("Snø", "Snow")} ${fmtT(test.snowTemperatureC)}`, icon: Snowflake, cls: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800" });
                          if (!hiddenWeather.has("airhum") && test.airHumidityPct != null) chips.push({ key: "airhum", label: `${L("Luftfukt", "Air hum")} ${test.airHumidityPct}%` });
                          if (!hiddenWeather.has("snowhum") && test.snowHumidityPct != null) chips.push({ key: "snowhum", label: `${L("Snøfukt", "Snow hum")} ${test.snowHumidityPct}%` });
                          if (!hiddenWeather.has("snowtype") && test.snowType) chips.push({ key: "snowtype", label: test.snowType });
                          if (!hiddenWeather.has("grain") && test.grainSize) chips.push({ key: "grain", label: `${L("Korn", "Grain")} ${test.grainSize}` });
                          if (!hiddenWeather.has("shtype") && test.snowHumidityType) chips.push({ key: "shtype", label: test.snowHumidityType });
                          if (!hiddenWeather.has("track") && test.trackHardness) chips.push({ key: "track", label: `${L("Spor", "Track")} ${test.trackHardness}` });
                          if (!hiddenWeather.has("snowkind") && test.artificialSnow === 1 && test.naturalSnow === 1) chips.push({ key: "mixsnow", label: L("Kunst + natur", "Artificial + natural") });
                          else if (!hiddenWeather.has("snowkind") && test.artificialSnow === 1) chips.push({ key: "artsnow", label: L("Kunstsnø", "Artificial snow") });
                          else if (!hiddenWeather.has("snowkind") && test.naturalSnow === 1) chips.push({ key: "natsnow", label: L("Natursnø", "Natural snow") });
                          if (!hiddenWeather.has("precip") && test.precipitation) chips.push({ key: "precip", label: test.precipitation });
                          if (!hiddenWeather.has("wind") && test.wind) chips.push({ key: "wind", label: `${L("Vind", "Wind")} ${test.wind}` });
                          if (!hiddenWeather.has("clouds") && test.clouds != null) chips.push({ key: "clouds", label: `${L("Skyer", "Clouds")} ${test.clouds}/8` });
                          if (chips.length === 0) return null;
                          return (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {chips.map((c) => {
                                const Icon = c.icon;
                                return (
                                  <span key={c.key} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1", c.cls ?? "bg-muted text-muted-foreground ring-border")}>
                                    {Icon && <Icon className="h-2.5 w-2.5" />}{c.label}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full border-separate border-spacing-0 text-xs">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                                <th className="px-3 py-1.5">{L("Ski", "Ski")}</th>
                                <th className="px-3 py-1.5 text-right">{isTime ? L("Snitt (s)", "Avg (s)") : L("Snitt (cm)", "Avg (cm)")}</th>
                                <th className="px-3 py-1.5">{L("Rang", "Rank")}</th>
                                <th className="px-3 py-1.5">{L("Følelse", "Feel")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entries.map((e) => {
                                const mine = e.raceSkiId === data.ski.id;
                                const r = rankMap.get(e.id) ?? null;
                                return (
                                  <tr key={e.id} className={cn("border-t border-border/30", mine && "bg-amber-50/70 dark:bg-amber-950/20 font-semibold")} data-testid={`ski-test-entry-${e.id}`}>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                      {e.skiLabel ?? `#${e.skiNumber}`}
                                      {e.fleetGroup && <span className="ml-1.5 rounded-full bg-sky-100 dark:bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-300">{e.fleetGroup}</span>}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap text-right tabular-nums">{fmtAvg(avgResult(e))}</td>
                                    <td className="px-3 py-1.5">
                                      {r != null ? (
                                        <span className={cn(
                                          "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                          r === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                                            : r === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300"
                                            : r === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600"
                                            : "bg-muted/70 text-foreground"
                                        )}>{r}</span>
                                      ) : "—"}
                                    </td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{e.feelingRank ?? "—"}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {test.notes && <p className="mt-2 text-xs italic text-muted-foreground">{test.notes}</p>}
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
