import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Thermometer, Award, Filter, Search, Trophy, Percent, Hash, FlaskConical, X, Snowflake, Droplets, Wind, MapPin, Activity, CalendarDays, Target, Layers, AlignLeft, FileDown, ChevronDown } from "lucide-react";
import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn, fmtDate } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { pdfDocument, pdfSection, pdfCards, pdfTable, openPdfWindow } from "@/lib/pdf-layout";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";

type Test = {
  id: number;
  date: string;
  location: string;
  testType: string;
  seriesId: number;
  weatherId: number | null;
  groupScope: string;
  createdAt: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  rank0km: number | null;
  result0kmCmBehind: number | null;
  results: string | null;
  feelingRank: number | null;
  methodology: string | null;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  location: string;
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number | null;
  airHumidityPct: number | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
  wind: string | null;
  clouds: number | null;
  precipitation: string | null;
  grainSize: string | null;
};

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

function getRank(entry: TestEntry): number | null {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]?.rank ?? null;
    } catch {}
  }
  return entry.rank0km;
}

const TEMP_BRACKETS = [
  { label: "< −10°C",   min: -Infinity, max: -10 },
  { label: "−10 to −5°C", min: -10,   max: -5  },
  { label: "−5 to 0°C",   min: -5,    max: 0   },
  { label: "0°C +",        min: 0,    max: Infinity },
];

function tempBracket(temp: number) {
  return TEMP_BRACKETS.find((b) => temp >= b.min && temp < b.max)?.label ?? "Unknown";
}

const AIR_TEMP_BRACKETS = [
  { label: "< −15°C", min: -Infinity, max: -15 },
  { label: "−15 to −10°C", min: -15, max: -10 },
  { label: "−10 to −5°C", min: -10, max: -5 },
  { label: "−5 to 0°C", min: -5, max: 0 },
  { label: "0 to +5°C", min: 0, max: 5 },
  { label: "> +5°C", min: 5, max: Infinity },
];
function airTempBracket(temp: number) {
  return AIR_TEMP_BRACKETS.find((b) => temp >= b.min && temp < b.max)?.label ?? "Unknown";
}

const HUMIDITY_BRACKETS = [
  { label: "< 40%", min: 0, max: 40 },
  { label: "40–60%", min: 40, max: 60 },
  { label: "60–80%", min: 60, max: 80 },
  { label: "> 80%", min: 80, max: Infinity },
];
function humidityBracket(pct: number) {
  return HUMIDITY_BRACKETS.find((b) => pct >= b.min && pct < b.max)?.label ?? "Unknown";
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? parseFloat(((s[mid - 1] + s[mid]) / 2).toFixed(2)) : s[mid];
}

function stdDev(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / arr.length;
  return parseFloat(Math.sqrt(variance).toFixed(2));
}

function getSkiSeason(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed; May=4 starts new season (May 1 – Apr 30)
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}/${String(startYear + 1).slice(2)}`;
}

// Generic bucket-based performance breakdown table
function BucketBreakdown({
  title,
  icon,
  entries,
  getBucket,
  testsById,
  weatherById,
}: {
  title: string;
  icon: React.ReactNode;
  entries: TestEntry[];
  getBucket: (entry: TestEntry, test: Test, weather: Weather | null) => string | null;
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
}) {
  const rows = useMemo(() => {
    const stats = new Map<string, { ranks: number[]; wins: number }>();
    for (const entry of entries) {
      const test = testsById.get(entry.testId);
      if (!test) continue;
      const w = test.weatherId ? (weatherById.get(test.weatherId) ?? null) : null;
      const bucket = getBucket(entry, test, w);
      if (!bucket) continue;
      if (!stats.has(bucket)) stats.set(bucket, { ranks: [], wins: 0 });
      const s = stats.get(bucket)!;
      const rank = getRank(entry);
      if (rank !== null) { s.ranks.push(rank); if (rank === 1) s.wins++; }
    }
    return Array.from(stats.entries())
      .map(([label, s]) => ({
        label,
        tests: s.ranks.length,
        avgRank: s.ranks.length > 0 ? parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)) : null,
        wins: s.wins,
      }))
      .filter((r) => r.tests > 0)
      .sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99));
  }, [entries, getBucket, testsById, weatherById]);

  if (rows.length === 0) return null;
  const best = rows[0];

  return (
    <div>
      <div className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
        {icon}
        {title}
      </div>
      {best && (
        <div className="mb-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Best: <span className="font-bold">{best.label}</span> — avg rank {best.avgRank} ({best.wins} win{best.wins !== 1 ? "s" : ""} in {best.tests} test{best.tests !== 1 ? "s" : ""})
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-3 py-2 font-medium">{title}</th>
              <th className="text-center px-3 py-2 font-medium">Tests</th>
              <th className="text-center px-3 py-2 font-medium">Avg rank</th>
              <th className="text-center px-3 py-2 font-medium">Wins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={cn("border-t", row.label === best.label && "bg-emerald-50/50 dark:bg-emerald-900/10")}>
                <td className="px-3 py-1.5 font-medium">{row.label}</td>
                <td className="px-3 py-1.5 text-center text-muted-foreground">{row.tests}</td>
                <td className="px-3 py-1.5 text-center font-semibold">{row.avgRank ?? "—"}</td>
                <td className="px-3 py-1.5 text-center">{row.wins > 0 ? <span className="text-amber-600 font-bold">{row.wins}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Activity Heatmap ───────────────────────────────────────────────────────────

function ActivityHeatmap({ tests }: { tests: Test[] }) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  // Normalize to Monday of that week
  const dayOfWeek = (startDate.getDay() + 6) % 7; // Mon=0
  startDate.setDate(startDate.getDate() - dayOfWeek);

  // Count tests per date
  const countByDate = new Map<string, number>();
  for (const t of tests) {
    countByDate.set(t.date, (countByDate.get(t.date) || 0) + 1);
  }

  // Build weeks array
  const weeks: Date[][] = [];
  const cur = new Date(startDate);
  while (cur <= today) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  function colorClass(count: number) {
    if (count === 0) return "bg-muted/40 dark:bg-muted/20";
    if (count === 1) return "bg-green-200 dark:bg-green-800";
    if (count <= 3) return "bg-green-400 dark:bg-green-600";
    return "bg-green-600 dark:bg-green-400";
  }

  // Month labels
  const monthLabels: { label: string; colStart: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, wi) => {
    const month = week[0].getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ label: week[0].toLocaleString("default", { month: "short" }), colStart: wi });
      lastMonth = month;
    }
  });

  const totalTests = tests.length;
  const activeDays = countByDate.size;

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
        </div>
        <h2 className="text-base font-semibold">Test activity</h2>
        <span className="text-xs text-muted-foreground">{totalTests} tests across {activeDays} days</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex mb-1" style={{ gap: "3px" }}>
            {weeks.map((_, wi) => {
              const lbl = monthLabels.find(m => m.colStart === wi);
              return (
                <div key={wi} className="w-3 shrink-0 text-[9px] text-muted-foreground" style={{ minWidth: 12 }}>
                  {lbl?.label ?? ""}
                </div>
              );
            })}
          </div>
          {/* Grid: 7 rows (days) x N cols (weeks) */}
          <div className="flex" style={{ gap: "3px" }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: "3px" }}>
                {week.map((day) => {
                  const ds = day.toISOString().slice(0, 10);
                  const count = countByDate.get(ds) || 0;
                  const isFuture = day > today;
                  return (
                    <div
                      key={ds}
                      title={count > 0 ? `${ds}: ${count} test${count > 1 ? "s" : ""}` : ds}
                      className={`h-3 w-3 rounded-sm transition-colors ${isFuture ? "opacity-0" : colorClass(count)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-muted-foreground">Less</span>
            {["bg-muted/40", "bg-green-200", "bg-green-400", "bg-green-600"].map((c, i) => (
              <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Overview Stats ─────────────────────────────────────────────────────────────

function OverviewStats({
  tests, allEntries, products, productsById, testsById, weatherById,
}: {
  tests: Test[];
  allEntries: TestEntry[];
  products: Product[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
}) {
  const { t } = useI18n();
  const stats = useMemo(() => {
    const weatherLinked = tests.filter((t) => t.weatherId != null).length;
    const weatherPct = tests.length > 0 ? Math.round((weatherLinked / tests.length) * 100) : 0;

    // Per-product appearances + ranks
    const pStats = new Map<number, { appearances: number; ranks: number[]; wins: number }>();
    for (const e of allEntries) {
      const ids: number[] = [];
      if (e.productId != null) ids.push(e.productId);
      if (e.additionalProductIds) {
        for (const s of e.additionalProductIds.split(",")) { const n = parseInt(s, 10); if (!isNaN(n)) ids.push(n); }
      }
      const rank = getRank(e);
      for (const pid of ids) {
        if (!pStats.has(pid)) pStats.set(pid, { appearances: 0, ranks: [], wins: 0 });
        const ps = pStats.get(pid)!;
        ps.appearances++;
        if (rank !== null) { ps.ranks.push(rank); if (rank === 1) ps.wins++; }
      }
    }

    // Top products by win rate (min 3 appearances)
    const topByWinRate = Array.from(pStats.entries())
      .filter(([, s]) => s.appearances >= 3 && s.ranks.length > 0)
      .map(([pid, s]) => {
        const p = productsById.get(pid);
        return {
          name: p ? `${p.brand} ${p.name}` : `#${pid}`,
          appearances: s.appearances,
          avgRank: parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)),
          winRate: parseFloat(((s.wins / s.ranks.length) * 100).toFixed(1)),
          wins: s.wins,
        };
      })
      .sort((a, b) => b.winRate - a.winRate || a.avgRank - b.avgRank)
      .slice(0, 10);

    // Most used products
    const mostUsed = Array.from(pStats.entries())
      .map(([pid, s]) => {
        const p = productsById.get(pid);
        return { name: p ? `${p.brand} ${p.name}` : `#${pid}`, appearances: s.appearances };
      })
      .sort((a, b) => b.appearances - a.appearances)
      .slice(0, 8);

    // Top locations
    const locMap = new Map<string, { tests: number; weatherTests: number; wins: Map<number, number> }>();
    for (const t of tests) {
      if (!locMap.has(t.location)) locMap.set(t.location, { tests: 0, weatherTests: 0, wins: new Map() });
      const lm = locMap.get(t.location)!;
      lm.tests++;
      if (t.weatherId) lm.weatherTests++;
    }
    const topLocations = Array.from(locMap.entries())
      .map(([loc, s]) => ({ location: loc, tests: s.tests, weatherPct: Math.round((s.weatherTests / s.tests) * 100) }))
      .sort((a, b) => b.tests - a.tests)
      .slice(0, 8);

    // Tests by type
    const byType = new Map<string, number>();
    for (const t of tests) byType.set(t.testType, (byType.get(t.testType) || 0) + 1);

    // Weather condition distribution (of weather-linked tests)
    const snowTempDist = new Map<string, number>();
    const airTempDist = new Map<string, number>();
    const humidityTypeDist = new Map<string, number>();
    const trackHardnessDist = new Map<string, number>();
    for (const t of tests) {
      if (!t.weatherId) continue;
      const w = weatherById.get(t.weatherId);
      if (!w) continue;
      const st = tempBracket(w.snowTemperatureC); snowTempDist.set(st, (snowTempDist.get(st) || 0) + 1);
      const at = airTempBracket(w.airTemperatureC); airTempDist.set(at, (airTempDist.get(at) || 0) + 1);
      if (w.snowHumidityType) humidityTypeDist.set(w.snowHumidityType, (humidityTypeDist.get(w.snowHumidityType) || 0) + 1);
      if (w.trackHardness) trackHardnessDist.set(w.trackHardness, (trackHardnessDist.get(w.trackHardness) || 0) + 1);
    }

    return { weatherLinked, weatherPct, topByWinRate, mostUsed, topLocations, byType, snowTempDist, airTempDist, humidityTypeDist, trackHardnessDist };
  }, [tests, allEntries, productsById, weatherById]);

  const totalEntries = allEntries.length;
  const uniqueProductsUsed = new Set(allEntries.map((e) => e.productId).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Hash className="h-4 w-4 text-blue-500" />, value: tests.length, label: t("analytics.totalTests") },
          { icon: <Layers className="h-4 w-4 text-violet-500" />, value: totalEntries, label: t("analytics.skiAppearances") },
          { icon: <Activity className="h-4 w-4 text-emerald-500" />, value: uniqueProductsUsed, label: t("analytics.productsTested") },
          { icon: <Snowflake className="h-4 w-4 text-sky-500" />, value: `${stats.weatherPct}%`, label: t("analytics.testsWithWeather") },
        ].map((c) => (
          <Card key={c.label} className="fs-card rounded-xl p-3 text-center">
            <div className="flex justify-center mb-1">{c.icon}</div>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top products by win rate */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold">{t("analytics.topProductsByWinRate")}</h3>
            <span className="text-xs text-muted-foreground">({t("analytics.minTests", { n: 3 })})</span>
          </div>
          {stats.topByWinRate.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not enough data yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.topByWinRate} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "Win rate (%)", position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(v: any) => [`${v}%`, "Win rate"]}
                  />
                  <Bar dataKey="winRate" radius={[0, 6, 6, 0]}>
                    {stats.topByWinRate.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            <div className="overflow-x-auto rounded-lg border mt-3">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">#</th>
                    <th className="text-left px-3 py-2 font-medium">{t("analytics.product")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.testCount")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.avgRank")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.winRate")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.wins")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topByWinRate.map((p, i) => (
                    <tr key={p.name} className={cn("border-t hover:bg-muted/30", i === 0 && "bg-amber-50/50 dark:bg-amber-900/10")}>
                      <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium truncate max-w-[160px]">{i === 0 && "🏆 "}{p.name}</td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">{p.appearances}</td>
                      <td className="px-3 py-1.5 text-center font-semibold">{p.avgRank}</td>
                      <td className="px-3 py-1.5 text-center"><span className={cn("font-bold", i === 0 && "text-amber-600")}>{p.winRate}%</span></td>
                      <td className="px-3 py-1.5 text-center text-amber-600 font-bold">{p.wins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </Card>

        {/* Most tested products */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlignLeft className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold">{t("analytics.mostTestedProducts")}</h3>
          </div>
          {stats.mostUsed.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("analytics.noData")}</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.mostUsed} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={130} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(v: any) => [v, "Tests"]}
                  />
                  <Bar dataKey="appearances" radius={[0, 6, 6, 0]}>
                    {stats.mostUsed.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-3">
              {stats.mostUsed.map((p, i) => {
                const maxCount = stats.mostUsed[0].appearances;
                const pct = Math.round((p.appearances / maxCount) * 100);
                return (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{p.appearances}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top locations */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-rose-500" />
            <h3 className="text-sm font-semibold">{t("analytics.testLocations")}</h3>
          </div>
          {stats.topLocations.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("analytics.noData")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">{t("common.location")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.testCount")}</th>
                    <th className="text-center px-3 py-2 font-medium">{t("analytics.weatherCoverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topLocations.map((loc) => (
                    <tr key={loc.location} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-medium truncate max-w-[160px]">{loc.location}</td>
                      <td className="px-3 py-1.5 text-center">{loc.tests}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={cn("font-medium", loc.weatherPct === 100 && "text-emerald-600", loc.weatherPct === 0 && "text-muted-foreground")}>{loc.weatherPct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Weather distribution */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Snowflake className="h-4 w-4 text-sky-500" />
            <h3 className="text-sm font-semibold">{t("analytics.testedConditionsOverview")}</h3>
          </div>
          {stats.weatherLinked === 0 ? (
            <p className="text-xs text-muted-foreground">No weather-linked tests yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                { label: t("analytics.snowTemp"), dist: stats.snowTempDist },
                { label: t("analytics.airTemp"), dist: stats.airTempDist },
              ].map(({ label, dist }) => {
                const total = Array.from(dist.values()).reduce((a, b) => a + b, 0);
                return total > 0 ? (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(dist.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                        <span key={k} className="rounded-full bg-sky-50 dark:bg-sky-900/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300 ring-1 ring-sky-200">
                          {k}: {v} ({Math.round((v / total) * 100)}%)
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
              {stats.humidityTypeDist.size > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Snow humidity</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(stats.humidityTypeDist.entries()).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              )}
              {stats.trackHardnessDist.size > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Track hardness</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(stats.trackHardnessDist.entries()).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 ring-1 ring-orange-200">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              )}
              {stats.byType.size > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t("analytics.testTypes")}</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(stats.byType.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Form Tracker ───────────────────────────────────────────────────────────────

function FormTracker({ allEntries, productsById, testsById }: {
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
}) {
  const rows = useMemo(() => {
    const pData = new Map<number, { name: string; rankedEntries: { date: string; rank: number }[] }>();
    for (const e of allEntries) {
      if (!e.productId) continue;
      const rank = getRank(e);
      if (rank === null) continue;
      const test = testsById.get(e.testId);
      if (!test) continue;
      if (!pData.has(e.productId)) {
        const p = productsById.get(e.productId);
        pData.set(e.productId, { name: p ? `${p.brand} ${p.name}` : `#${e.productId}`, rankedEntries: [] });
      }
      pData.get(e.productId)!.rankedEntries.push({ date: test.date, rank });
    }
    return Array.from(pData.values())
      .filter(p => p.rankedEntries.length >= 5)
      .map(p => {
        const sorted = [...p.rankedEntries].sort((a, b) => b.date.localeCompare(a.date));
        const allAvg = sorted.reduce((s, e) => s + e.rank, 0) / sorted.length;
        const recentAvg = sorted.slice(0, 5).reduce((s, e) => s + e.rank, 0) / 5;
        const delta = allAvg - recentAvg; // positive = improving (lower rank = better)
        return { name: p.name, allAvg: parseFloat(allAvg.toFixed(2)), recentAvg: parseFloat(recentAvg.toFixed(2)), delta, total: sorted.length };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [allEntries, productsById, testsById]);

  if (rows.length === 0) return null;

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50">
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </div>
        <h2 className="text-base font-semibold">Form tracker</h2>
        <span className="text-xs text-muted-foreground">Recent 5 tests vs all-time</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => {
          const isHot = r.delta > 0.3;
          const isCold = r.delta < -0.3;
          return (
            <div key={r.name} className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{r.name}</div>
                <div className="text-[11px] text-muted-foreground">All-time avg: {r.allAvg} · Recent avg: {r.recentAvg} · {r.total} tests</div>
              </div>
              <div className={cn(
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0",
                isHot ? "bg-green-100 text-green-700" : isCold ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"
              )}>
                {isHot ? "▲" : isCold ? "▼" : "—"}
                {isHot ? " Hot" : isCold ? " Cold" : " Stable"}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Show which snow-temp brackets a product performs best in */
function ConditionsBestBreakdown({
  productId,
  allEntries,
  testsById,
  weatherById,
}: {
  productId: number;
  allEntries: TestEntry[];
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
}) {
  const data = useMemo(() => {
    const bracketStats = new Map<string, { ranks: number[]; wins: number }>();
    const entries = allEntries.filter((e) => e.productId === productId);
    for (const entry of entries) {
      const test = testsById.get(entry.testId);
      if (!test || !test.weatherId) continue;
      const w = weatherById.get(test.weatherId);
      if (!w) continue;
      const bracket = tempBracket(w.snowTemperatureC);
      const rank = getRank(entry);
      if (!bracketStats.has(bracket)) bracketStats.set(bracket, { ranks: [], wins: 0 });
      const s = bracketStats.get(bracket)!;
      if (rank !== null) {
        s.ranks.push(rank);
        if (rank === 1) s.wins++;
      }
    }
    return TEMP_BRACKETS.map((b) => {
      const s = bracketStats.get(b.label);
      if (!s || s.ranks.length === 0) return { label: b.label, avgRank: null, wins: 0, tests: 0 };
      const avgRank = parseFloat((s.ranks.reduce((a, c) => a + c, 0) / s.ranks.length).toFixed(2));
      return { label: b.label, avgRank, wins: s.wins, tests: s.ranks.length };
    }).filter((d) => d.tests > 0);
  }, [productId, allEntries, testsById, weatherById]);

  if (data.length === 0) return <p className="text-xs text-muted-foreground">No weather-linked tests for this product.</p>;

  const best = [...data].sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99))[0];

  return (
    <div className="space-y-2">
      {best && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Best in: <span className="font-bold">{best.label}</span> — avg rank {best.avgRank} ({best.wins} win{best.wins !== 1 ? "s" : ""} in {best.tests} test{best.tests !== 1 ? "s" : ""})
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium">Snow temp range</th>
              <th className="text-center px-3 py-2 text-xs font-medium">Tests</th>
              <th className="text-center px-3 py-2 text-xs font-medium">Avg rank</th>
              <th className="text-center px-3 py-2 text-xs font-medium">Wins</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.label} className={cn("border-t", row.label === best?.label && "bg-emerald-50/50 dark:bg-emerald-900/10")}>
                <td className="px-3 py-1.5 font-medium">{row.label}</td>
                <td className="px-3 py-1.5 text-center text-muted-foreground">{row.tests}</td>
                <td className="px-3 py-1.5 text-center font-semibold">{row.avgRank ?? "—"}</td>
                <td className="px-3 py-1.5 text-center">{row.wins > 0 ? <span className="text-amber-600 font-bold">{row.wins}</span> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Show best products for a given snow temperature bracket */
function BestProductsByConditions({
  products,
  tests,
  allEntries,
  productsById,
  testsById,
  weatherById,
}: {
  products: Product[];
  tests: Test[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
}) {
  const [selectedBracket, setSelectedBracket] = useState(TEMP_BRACKETS[1].label);

  const data = useMemo(() => {
    const bracket = TEMP_BRACKETS.find((b) => b.label === selectedBracket);
    if (!bracket) return [];

    const matchingTestIds = new Set<number>();
    for (const t of tests) {
      if (!t.weatherId) continue;
      const w = weatherById.get(t.weatherId);
      if (!w) continue;
      if (w.snowTemperatureC >= bracket.min && w.snowTemperatureC < bracket.max) {
        matchingTestIds.add(t.id);
      }
    }

    const pStats = new Map<number, { totalRank: number; count: number; wins: number }>();
    for (const e of allEntries) {
      if (!matchingTestIds.has(e.testId) || !e.productId) continue;
      const rank = getRank(e);
      if (rank === null) continue;
      const s = pStats.get(e.productId) || { totalRank: 0, count: 0, wins: 0 };
      s.totalRank += rank;
      s.count++;
      if (rank === 1) s.wins++;
      pStats.set(e.productId, s);
    }

    return Array.from(pStats.entries())
      .filter(([_, s]) => s.count >= 2)
      .map(([pid, s]) => {
        const p = productsById.get(pid);
        return {
          name: p ? `${p.brand} ${p.name}` : `#${pid}`,
          avgRank: parseFloat((s.totalRank / s.count).toFixed(2)),
          wins: s.wins,
          tests: s.count,
          winRate: parseFloat(((s.wins / s.count) * 100).toFixed(0)),
        };
      })
      .sort((a, b) => a.avgRank - b.avgRank);
  }, [selectedBracket, tests, allEntries, productsById, weatherById]);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-best-by-conditions">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30">
          <Snowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        </div>
        <h2 className="text-base font-semibold">Best products by conditions</h2>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TEMP_BRACKETS.map((b) => (
          <Button
            key={b.label}
            variant={selectedBracket === b.label ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBracket(b.label)}
          >
            {b.label}
          </Button>
        ))}
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products with 2+ tests in this temperature range.</p>
      ) : (
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} label={{ value: "Avg rank (lower = better)", position: "insideBottom", offset: -2, style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                formatter={(v: any, name: string) => [v, name === "avgRank" ? "Avg rank" : name]}
              />
              <Bar dataKey="avgRank" radius={[0, 6, 6, 0]}>
                {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium">#</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Product</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">Tests</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">Avg rank</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.name} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium truncate max-w-[180px]">{row.name}</td>
                    <td className="px-3 py-1.5 text-center text-muted-foreground">{row.tests}</td>
                    <td className="px-3 py-1.5 text-center font-semibold">{row.avgRank}</td>
                    <td className="px-3 py-1.5 text-center">{row.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function ProductSearchStats({
  products,
  tests,
  allEntries,
  productsById,
  testsById,
  weatherById = new Map(),
}: {
  products: Product[];
  tests: Test[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  weatherById?: Map<number, Weather>;
}) {
  const { t } = useI18n();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const selectedProduct = selectedProductId ? productsById.get(selectedProductId) : null;

  const stats = useMemo(() => {
    if (!selectedProductId) return null;

    const productEntries = allEntries.filter((e) => {
      if (e.productId === selectedProductId) return true;
      if (e.additionalProductIds) {
        const ids = e.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n));
        if (ids.includes(selectedProductId)) return true;
      }
      return false;
    });

    if (productEntries.length === 0) return null;

    const testIdsUsed = new Set(productEntries.map((e) => e.testId));
    const testsUsed = Array.from(testIdsUsed)
      .map((tid) => testsById.get(tid))
      .filter(Boolean) as Test[];

    let totalWins = 0;
    const ranks: number[] = [];
    const methodologyCount = new Map<string, number>();
    const performanceByMonth = new Map<string, { ranks: number[]; wins: number; count: number }>();

    const testResults: { test: Test; rank: number | null; entry: TestEntry }[] = [];

    for (const entry of productEntries) {
      const test = testsById.get(entry.testId);
      if (!test) continue;

      const rank = getRank(entry);
      testResults.push({ test, rank, entry });

      if (rank !== null) {
        ranks.push(rank);
        if (rank === 1) totalWins++;
      }

      const method = test.testType;
      methodologyCount.set(method, (methodologyCount.get(method) || 0) + 1);

      const month = test.date.slice(0, 7);
      if (!performanceByMonth.has(month)) {
        performanceByMonth.set(month, { ranks: [], wins: 0, count: 0 });
      }
      const pm = performanceByMonth.get(month)!;
      pm.count++;
      if (rank !== null) {
        pm.ranks.push(rank);
        if (rank === 1) pm.wins++;
      }
    }

    const avgRank = ranks.length > 0
      ? parseFloat((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(2))
      : null;

    const winRate = ranks.length > 0
      ? parseFloat(((totalWins / ranks.length) * 100).toFixed(1))
      : 0;

    const performanceOverTime = Array.from(performanceByMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgRank: data.ranks.length > 0
          ? parseFloat((data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length).toFixed(2))
          : null,
        wins: data.wins,
        tests: data.count,
      }));

    const methodologyBreakdown = Array.from(methodologyCount.entries()).map(([method, count]) => ({
      method,
      count,
      percentage: parseFloat(((count / productEntries.length) * 100).toFixed(1)),
    }));

    testResults.sort((a, b) => b.test.date.localeCompare(a.test.date));

    // Best combinations: other products that appear on the same ski in the same entry
    const comboMap = new Map<number, { count: number; wins: number; totalRank: number }>();
    for (const entry of productEntries) {
      const partners: number[] = [];
      if (entry.productId !== null && entry.productId !== selectedProductId) partners.push(entry.productId);
      if (entry.additionalProductIds) {
        for (const idStr of entry.additionalProductIds.split(",")) {
          const n = parseInt(idStr.trim(), 10);
          if (!isNaN(n) && n !== selectedProductId) partners.push(n);
        }
      }
      const rank = getRank(entry);
      for (const pid of partners) {
        if (!comboMap.has(pid)) comboMap.set(pid, { count: 0, wins: 0, totalRank: 0 });
        const c = comboMap.get(pid)!;
        c.count++;
        if (rank !== null) { c.totalRank += rank; if (rank === 1) c.wins++; }
      }
    }
    const bestCombinations = Array.from(comboMap.entries())
      .map(([partnerId, s]) => ({
        partnerId,
        count: s.count,
        avgRank: s.count > 0 ? parseFloat((s.totalRank / s.count).toFixed(2)) : null,
        wins: s.wins,
      }))
      .sort((a, b) => b.count - a.count || (a.avgRank ?? 99) - (b.avgRank ?? 99))
      .slice(0, 6);

    const medianRank = median(ranks);
    const rankStdDev = stdDev(ranks);

    const podiumCount = ranks.filter(r => r <= 3).length;
    const podiumRate = ranks.length > 0 ? parseFloat(((podiumCount / ranks.length) * 100).toFixed(1)) : 0;

    return {
      totalTests: testsUsed.length,
      totalWins,
      avgRank,
      winRate,
      medianRank,
      rankStdDev,
      podiumRate,
      methodologyBreakdown,
      performanceOverTime,
      testResults,
      bestCombinations,
      productEntries,
    };
  }, [selectedProductId, allEntries, testsById]);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-product-search">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50">
          <Search className="h-4 w-4 text-cyan-600" />
        </div>
        <h2 className="text-base font-semibold">Product performance lookup</h2>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full max-w-sm justify-between bg-background/70"
              data-testid="button-product-search"
            >
              <span className={cn("truncate", !selectedProduct && "text-muted-foreground")}>
                {selectedProduct ? `${selectedProduct.brand} ${selectedProduct.name}` : "Search for a product..."}
              </span>
              <ChevronsUpDown className="h-4 w-4 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput data-testid="input-product-search" placeholder={t("analytics.searchProducts")} />
              <CommandList>
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandGroup heading="Products">
                  {products.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.brand} ${p.name}`}
                      onSelect={() => {
                        setSelectedProductId(p.id);
                        setOpen(false);
                      }}
                      data-testid={`option-analytics-product-${p.id}`}
                    >
                      <span className="truncate">{p.brand} {p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{p.category}</span>
                      <Check className={cn("ml-2 h-4 w-4", selectedProductId === p.id ? "opacity-100" : "opacity-0")} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedProduct && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedProductId(null)}
            data-testid="button-clear-product"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectedProduct && stats && (
        <div className="flex flex-col gap-5" data-testid="card-product-stats">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="rounded-xl border p-3 text-center">
              <Hash className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-total-tests">{stats.totalTests}</div>
              <div className="text-xs text-muted-foreground">Total tests</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-total-wins">{stats.totalWins}</div>
              <div className="text-xs text-muted-foreground">Wins (#1)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-avg-rank">{stats.avgRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Avg rank</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-win-rate">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">Win rate</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Target className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold">{stats.medianRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Median rank</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Activity className="h-4 w-4 mx-auto text-orange-500 mb-1" />
              <div className="text-2xl font-bold">{stats.rankStdDev ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Consistency (σ)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold">{stats.podiumRate}%</div>
              <div className="text-xs text-muted-foreground">Podium rate</div>
            </div>
          </div>

          {stats.methodologyBreakdown.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Methodology breakdown</span>
              </div>
              <div className="flex flex-wrap gap-2" data-testid="list-methodology-breakdown">
                {stats.methodologyBreakdown.map((m) => (
                  <Badge key={m.method} variant="secondary" className="text-xs" data-testid={`badge-methodology-${m.method.toLowerCase()}`}>
                    {m.method}: {m.count} ({m.percentage}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Ranking distribution */}
          {stats.testResults.length > 0 && (() => {
            const rankCounts: Record<string, number> = { "1st": 0, "2nd": 0, "3rd": 0, "4th": 0, "5th+": 0 };
            for (const { rank } of stats.testResults) {
              if (rank === null) continue;
              if (rank === 1) rankCounts["1st"]++;
              else if (rank === 2) rankCounts["2nd"]++;
              else if (rank === 3) rankCounts["3rd"]++;
              else if (rank === 4) rankCounts["4th"]++;
              else rankCounts["5th+"]++;
            }
            const distData = Object.entries(rankCounts).map(([label, count]) => ({ label, count }));
            const podiumRate2 = stats.testResults.filter(r => r.rank !== null && r.rank <= 3).length;
            const ranked = stats.testResults.filter(r => r.rank !== null).length;
            const podiumPct = ranked > 0 ? Math.round((podiumRate2 / ranked) * 100) : 0;
            return (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Ranking distribution</span>
                  <span className="text-xs text-muted-foreground ml-auto">Podium rate: <span className="font-bold text-amber-600">{podiumPct}%</span></span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                    <Bar dataKey="count" name="Times" radius={[4, 4, 0, 0]}>
                      {distData.map((entry, i) => (
                        <Cell key={i} fill={i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#f97316" : CHART_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {stats.performanceOverTime.length > 1 && (
            <div>
              <div className="text-sm font-medium mb-2">Performance over time</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.performanceOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis
                    reversed
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    label={{ value: "Avg Rank", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === "avgRank") return [value, "Avg Rank"];
                      if (name === "wins") return [value, "Wins"];
                      return [value, name];
                    }}
                  />
                  <Line type="monotone" dataKey="avgRank" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <div className="text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Snowflake className="h-4 w-4 text-sky-500" />
              Performance by weather conditions
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BucketBreakdown
                title="Snow temperature"
                icon={<Snowflake className="h-3.5 w-3.5 text-sky-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.snowTemperatureC != null ? tempBracket(w.snowTemperatureC) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title="Air temperature"
                icon={<Thermometer className="h-3.5 w-3.5 text-orange-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.airTemperatureC != null ? airTempBracket(w.airTemperatureC) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title="Snow humidity type"
                icon={<Droplets className="h-3.5 w-3.5 text-blue-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.snowHumidityType ?? null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title="Track hardness"
                icon={<Target className="h-3.5 w-3.5 text-amber-600" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.trackHardness ?? null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title="Air humidity"
                icon={<Wind className="h-3.5 w-3.5 text-teal-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.airHumidityPct != null ? humidityBracket(w.airHumidityPct) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title="Test location"
                icon={<MapPin className="h-3.5 w-3.5 text-rose-500" />}
                entries={stats.productEntries}
                getBucket={(e, t) => t.location}
                testsById={testsById}
                weatherById={weatherById}
              />
            </div>
          </div>

          {stats.bestCombinations.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-violet-500" />
                Best combinations
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium">Combined with</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Times</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Avg rank</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bestCombinations.map((c, i) => {
                      const p = productsById.get(c.partnerId);
                      return (
                        <tr key={c.partnerId} className={cn("border-t", i === 0 && "bg-violet-50/40 dark:bg-violet-900/10")}>
                          <td className="px-3 py-1.5 font-medium">
                            {i === 0 && <span className="mr-1 text-violet-500">★</span>}
                            {p ? `${p.brand} ${p.name}` : `#${c.partnerId}`}
                          </td>
                          <td className="px-3 py-1.5 text-center text-muted-foreground">{c.count}</td>
                          <td className="px-3 py-1.5 text-center font-semibold">{c.avgRank ?? "—"}</td>
                          <td className="px-3 py-1.5 text-center">{c.wins > 0 ? <span className="text-amber-600 font-bold">{c.wins}</span> : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Location performance */}
          {(() => {
            const locMap = new Map<string, { ranks: number[]; wins: number }>();
            for (const { test, rank } of stats.testResults) {
              if (rank === null) continue;
              if (!locMap.has(test.location)) locMap.set(test.location, { ranks: [], wins: 0 });
              const s = locMap.get(test.location)!;
              s.ranks.push(rank);
              if (rank === 1) s.wins++;
            }
            const locRows = Array.from(locMap.entries())
              .map(([loc, s]) => ({
                loc,
                tests: s.ranks.length,
                avgRank: parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)),
                wins: s.wins,
              }))
              .sort((a, b) => a.avgRank - b.avgRank);
            if (locRows.length === 0) return null;
            const best = locRows[0];
            return (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-rose-500" />
                  Performance by location
                </div>
                {best && (
                  <div className="mb-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Best venue: <span className="font-bold">{best.loc}</span> — avg rank {best.avgRank} ({best.wins} win{best.wins !== 1 ? "s" : ""} in {best.tests} test{best.tests !== 1 ? "s" : ""})
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Location</th>
                        <th className="text-center px-3 py-2 font-medium">Tests</th>
                        <th className="text-center px-3 py-2 font-medium">Avg rank</th>
                        <th className="text-center px-3 py-2 font-medium">Wins</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locRows.map((row) => (
                        <tr key={row.loc} className={cn("border-t hover:bg-muted/30", row.loc === best.loc && "bg-emerald-50/50 dark:bg-emerald-900/10")}>
                          <td className="px-3 py-1.5 font-medium">{row.loc}</td>
                          <td className="px-3 py-1.5 text-center text-muted-foreground">{row.tests}</td>
                          <td className="px-3 py-1.5 text-center font-semibold">{row.avgRank}</td>
                          <td className="px-3 py-1.5 text-center">{row.wins > 0 ? <span className="text-amber-600 font-bold">{row.wins}</span> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          <div>
            <div className="text-sm font-medium mb-2">Test history ({stats.testResults.length})</div>
            <div className="max-h-80 overflow-y-auto rounded-lg border" data-testid="list-product-test-history">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Location</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-center px-3 py-2 font-medium">Snow °C</th>
                    <th className="text-center px-3 py-2 font-medium">Air °C</th>
                    <th className="text-center px-3 py-2 font-medium">Humidity</th>
                    <th className="text-center px-3 py-2 font-medium">Track</th>
                    <th className="text-center px-3 py-2 font-medium">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.testResults.map(({ test, rank }, i) => {
                    const w = test.weatherId ? weatherById.get(test.weatherId) ?? null : null;
                    return (
                      <tr key={`${test.id}-${i}`} className="border-t hover:bg-muted/30" data-testid={`row-product-test-${test.id}`}>
                        <td className="px-3 py-2">{fmtDate(test.date)}</td>
                        <td className="px-3 py-2 truncate max-w-[100px]">{test.location}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs">{test.testType}</Badge>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{w?.snowTemperatureC != null ? `${w.snowTemperatureC}°` : "—"}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">{w?.airTemperatureC != null ? `${w.airTemperatureC}°` : "—"}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground capitalize">{w?.snowHumidityType ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground capitalize">{w?.trackHardness ?? "—"}</td>
                        <td className="px-3 py-2 text-center">
                          {rank !== null ? (
                            <span className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              rank === 1 && "bg-amber-100 text-amber-700",
                              rank === 2 && "bg-muted text-foreground/80",
                              rank === 3 && "bg-orange-100 text-orange-700",
                              rank > 3 && "text-muted-foreground",
                            )}>
                              {rank}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && !stats && (
        <p className="text-sm text-muted-foreground" data-testid="text-product-no-data">
          No test data found for {selectedProduct.brand} {selectedProduct.name}.
        </p>
      )}
    </Card>
  );
}

// ── Combination Search ─────────────────────────────────────────────────────────

function CombinationSearch({
  products,
  allEntries,
  productsById,
  testsById,
  weatherById,
}: {
  products: Product[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
}) {
  const { t } = useI18n();
  const [p1Id, setP1Id] = useState<number | null>(null);
  const [p2Id, setP2Id] = useState<number | null>(null);
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);

  const stats = useMemo(() => {
    if (!p1Id || !p2Id || p1Id === p2Id) return null;

    // Find entries where BOTH products appear on the same ski (same entry)
    const combined: { entry: TestEntry; test: Test }[] = [];
    for (const entry of allEntries) {
      const ids: number[] = [];
      if (entry.productId != null) ids.push(entry.productId);
      if (entry.additionalProductIds) {
        for (const s of entry.additionalProductIds.split(",")) {
          const n = parseInt(s.trim(), 10);
          if (!isNaN(n)) ids.push(n);
        }
      }
      if (ids.includes(p1Id) && ids.includes(p2Id)) {
        const test = testsById.get(entry.testId);
        if (test) combined.push({ entry, test });
      }
    }
    if (combined.length === 0) return null;

    const ranks = combined.map(({ entry }) => getRank(entry)).filter((r): r is number => r !== null);
    const wins = ranks.filter((r) => r === 1).length;
    const avgRank = ranks.length > 0 ? parseFloat((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(2)) : null;
    const winRate = ranks.length > 0 ? parseFloat(((wins / ranks.length) * 100).toFixed(1)) : 0;

    // Weather (snow temp) breakdown
    const bracketMap = new Map<string, { ranks: number[]; wins: number }>();
    for (const { entry, test } of combined) {
      if (!test.weatherId) continue;
      const w = weatherById.get(test.weatherId);
      if (!w) continue;
      const label = tempBracket(w.snowTemperatureC);
      if (!bracketMap.has(label)) bracketMap.set(label, { ranks: [], wins: 0 });
      const b = bracketMap.get(label)!;
      const rank = getRank(entry);
      if (rank !== null) { b.ranks.push(rank); if (rank === 1) b.wins++; }
    }
    const conditionStats = TEMP_BRACKETS.map((b) => {
      const s = bracketMap.get(b.label);
      if (!s || s.ranks.length === 0) return null;
      return {
        label: b.label,
        avgRank: parseFloat((s.ranks.reduce((a, c) => a + c, 0) / s.ranks.length).toFixed(2)),
        wins: s.wins,
        tests: s.ranks.length,
      };
    }).filter(Boolean) as { label: string; avgRank: number; wins: number; tests: number }[];

    const best = conditionStats.length > 0 ? [...conditionStats].sort((a, b) => a.avgRank - b.avgRank)[0] : null;

    const recentTests = [...combined]
      .sort((a, b) => b.test.date.localeCompare(a.test.date))
      .slice(0, 8)
      .map(({ entry, test }) => ({ entry, test, rank: getRank(entry) }));

    return { count: combined.length, avgRank, wins, winRate, conditionStats, best, recentTests };
  }, [p1Id, p2Id, allEntries, testsById, weatherById]);

  const p1 = p1Id ? productsById.get(p1Id) : null;
  const p2 = p2Id ? productsById.get(p2Id) : null;

  function ProductPicker({
    value, onChange, open, onOpenChange, placeholder, exclude,
  }: { value: number | null; onChange: (id: number) => void; open: boolean; onOpenChange: (v: boolean) => void; placeholder: string; exclude?: number | null }) {
    const p = value ? productsById.get(value) : null;
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 flex-1 min-w-0 justify-between bg-background/70">
            <span className={cn("truncate text-sm", !p && "text-muted-foreground")}>{p ? `${p.brand} ${p.name}` : placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60 shrink-0 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("analytics.searchProducts")} />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup>
                {products.filter((p) => p.id !== exclude).map((p) => (
                  <CommandItem key={p.id} value={`${p.brand} ${p.name}`} onSelect={() => { onChange(p.id); onOpenChange(false); }}>
                    <span className="truncate">{p.brand} {p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p.category}</span>
                    <Check className={cn("ml-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
          <TrendingUp className="h-4 w-4 text-violet-600" />
        </div>
        <h2 className="text-base font-semibold">Combination search</h2>
        <span className="text-xs text-muted-foreground">— find tests where two products were used together on the same ski</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ProductPicker value={p1Id} onChange={setP1Id} open={open1} onOpenChange={setOpen1} placeholder="Product 1…" exclude={p2Id} />
        <span className="text-sm font-bold text-muted-foreground">+</span>
        <ProductPicker value={p2Id} onChange={setP2Id} open={open2} onOpenChange={setOpen2} placeholder="Product 2…" exclude={p1Id} />
        {(p1Id || p2Id) && (
          <Button variant="ghost" size="sm" onClick={() => { setP1Id(null); setP2Id(null); }}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {p1Id && p2Id && !stats && (
        <p className="text-sm text-muted-foreground">
          No tests found where <strong>{p1?.brand} {p1?.name}</strong> and <strong>{p2?.brand} {p2?.name}</strong> were used together on the same ski.
        </p>
      )}

      {stats && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border p-3 text-center">
              <Hash className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{stats.count}</div>
              <div className="text-xs text-muted-foreground">Ski appearances</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold">{stats.wins}</div>
              <div className="text-xs text-muted-foreground">Wins (#1)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold">{stats.avgRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Avg rank</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">Win rate</div>
            </div>
          </div>

          {stats.best && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Best conditions: <span className="font-bold">{stats.best.label}</span> — avg rank {stats.best.avgRank} ({stats.best.wins} win{stats.best.wins !== 1 ? "s" : ""} in {stats.best.tests} test{stats.best.tests !== 1 ? "s" : ""})
            </div>
          )}

          {stats.conditionStats.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Snowflake className="h-4 w-4 text-sky-500" />
                Performance by snow temperature
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium">Snow temp range</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Tests</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Avg rank</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">Wins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.conditionStats.map((row) => (
                      <tr key={row.label} className={cn("border-t", row.label === stats.best?.label && "bg-emerald-50/50 dark:bg-emerald-900/10")}>
                        <td className="px-3 py-1.5 font-medium">{row.label}</td>
                        <td className="px-3 py-1.5 text-center text-muted-foreground">{row.tests}</td>
                        <td className="px-3 py-1.5 text-center font-semibold">{row.avgRank}</td>
                        <td className="px-3 py-1.5 text-center">{row.wins > 0 ? <span className="text-amber-600 font-bold">{row.wins}</span> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <div className="text-sm font-medium mb-2">Recent tests ({stats.recentTests.length})</div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium">Date</th>
                    <th className="text-left px-3 py-2 text-xs font-medium">Location</th>
                    <th className="text-center px-3 py-2 text-xs font-medium">Ski #</th>
                    <th className="text-center px-3 py-2 text-xs font-medium">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTests.map(({ entry, test, rank }, i) => (
                    <tr key={`${test.id}-${entry.id}-${i}`} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">{fmtDate(test.date)}</td>
                      <td className="px-3 py-2 truncate max-w-[120px]">{test.location}</td>
                      <td className="px-3 py-2 text-center font-mono">{entry.skiNumber}</td>
                      <td className="px-3 py-2 text-center">
                        {rank !== null ? (
                          <span className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                            rank === 1 && "bg-amber-100 text-amber-700",
                            rank === 2 && "bg-muted text-foreground/80",
                            rank === 3 && "bg-orange-100 text-orange-700",
                            rank > 3 && "text-muted-foreground",
                          )}>{rank}</span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Head-to-Head Matrix ────────────────────────────────────────────────────────

function HeadToHeadMatrix({ allEntries, productsById, testsById }: {
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
}) {
  const { topProducts, matrix } = useMemo(() => {
    // Get top products by appearances
    const appearances = new Map<number, number>();
    for (const e of allEntries) {
      if (e.productId) appearances.set(e.productId, (appearances.get(e.productId) || 0) + 1);
    }
    const topProducts = Array.from(appearances.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([pid]) => productsById.get(pid))
      .filter(Boolean) as Product[];

    // Build test→ranks map
    const testRanks = new Map<number, Map<number, number>>(); // testId → productId → rank
    for (const e of allEntries) {
      if (!e.productId) continue;
      const rank = getRank(e);
      if (rank === null) continue;
      if (!testRanks.has(e.testId)) testRanks.set(e.testId, new Map());
      testRanks.get(e.testId)!.set(e.productId, rank);
    }

    // Build matrix
    const matrix: Record<string, Record<string, { wins: number; total: number }>> = {};
    for (const p1 of topProducts) {
      matrix[p1.id] = {};
      for (const p2 of topProducts) {
        if (p1.id === p2.id) continue;
        let wins = 0, total = 0;
        for (const [, rankMap] of testRanks) {
          const r1 = rankMap.get(p1.id);
          const r2 = rankMap.get(p2.id);
          if (r1 !== undefined && r2 !== undefined) {
            total++;
            if (r1 < r2) wins++;
          }
        }
        matrix[p1.id][p2.id] = { wins, total };
      }
    }
    return { topProducts, matrix };
  }, [allEntries, productsById, testsById]);

  if (topProducts.length < 2) return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <p className="text-sm text-muted-foreground">Need at least 2 products with test data for head-to-head matrix.</p>
    </Card>
  );

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50">
          <Target className="h-4 w-4 text-indigo-600" />
        </div>
        <h2 className="text-base font-semibold">Head-to-head matrix</h2>
        <span className="text-xs text-muted-foreground">Win % when both products tested together</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[100px]">vs →</th>
              {topProducts.map(p => (
                <th key={p.id} className="px-2 py-1.5 text-center font-medium max-w-[80px]">
                  <div className="truncate max-w-[70px]" title={`${p.brand} ${p.name}`}>{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topProducts.map(p1 => (
              <tr key={p1.id} className="border-t border-border">
                <td className="px-2 py-1.5 font-semibold truncate max-w-[100px]" title={`${p1.brand} ${p1.name}`}>{p1.name}</td>
                {topProducts.map(p2 => {
                  if (p1.id === p2.id) return <td key={p2.id} className="px-2 py-1.5 text-center bg-muted/30 text-muted-foreground">—</td>;
                  const cell = matrix[p1.id]?.[p2.id];
                  if (!cell || cell.total === 0) return <td key={p2.id} className="px-2 py-1.5 text-center text-muted-foreground">n/a</td>;
                  const pct = Math.round((cell.wins / cell.total) * 100);
                  const isGood = pct >= 60;
                  const isBad = pct <= 40;
                  return (
                    <td key={p2.id} className={cn("px-2 py-1.5 text-center font-semibold rounded",
                      isGood ? "text-green-700 bg-green-50 dark:bg-green-950/30" : isBad ? "text-red-700 bg-red-50 dark:bg-red-950/30" : ""
                    )}>
                      {pct}%
                      <div className="text-[9px] font-normal text-muted-foreground">{cell.wins}/{cell.total}</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

type ProductCompareStats = {
  product: Product;
  totalTests: number;
  totalWins: number;
  avgRank: number | null;
  winRate: number;
  performanceByMonth: Map<string, { ranks: number[]; count: number }>;
  testRanks: Map<number, number | null>;
};

function getProductStats(
  productId: number,
  product: Product,
  allEntries: TestEntry[],
  testsById: Map<number, Test>,
  filteredTestIds?: Set<number>,
): ProductCompareStats {
  const entries = allEntries.filter((e) => {
    if (filteredTestIds && !filteredTestIds.has(e.testId)) return false;
    if (e.productId === productId) return true;
    if (e.additionalProductIds) {
      const ids = e.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n));
      if (ids.includes(productId)) return true;
    }
    return false;
  });

  const bestRankPerTest = new Map<number, number | null>();
  for (const entry of entries) {
    const rank = getRank(entry);
    const prev = bestRankPerTest.get(entry.testId);
    if (prev === undefined) {
      bestRankPerTest.set(entry.testId, rank);
    } else if (rank !== null && (prev === null || rank < prev)) {
      bestRankPerTest.set(entry.testId, rank);
    }
  }

  let totalWins = 0;
  const ranks: number[] = [];
  const performanceByMonth = new Map<string, { ranks: number[]; count: number }>();
  const testRanks = new Map<number, number | null>();

  for (const [testId, rank] of bestRankPerTest) {
    const test = testsById.get(testId);
    if (!test) continue;
    testRanks.set(testId, rank);
    if (rank !== null) {
      ranks.push(rank);
      if (rank === 1) totalWins++;
    }
    const month = test.date.slice(0, 7);
    if (!performanceByMonth.has(month)) performanceByMonth.set(month, { ranks: [], count: 0 });
    const pm = performanceByMonth.get(month)!;
    pm.count++;
    if (rank !== null) pm.ranks.push(rank);
  }

  const avgRank = ranks.length > 0 ? parseFloat((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(2)) : null;
  const winRate = ranks.length > 0 ? parseFloat(((totalWins / ranks.length) * 100).toFixed(1)) : 0;

  return { product, totalTests: bestRankPerTest.size, totalWins, avgRank, winRate, performanceByMonth, testRanks };
}

function ProductCompare({
  products,
  allEntries,
  productsById,
  testsById,
  filteredTestIds,
}: {
  products: Product[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  filteredTestIds: Set<number>;
}) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const addProduct = (id: number) => {
    if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]);
    setOpen(false);
  };
  const removeProduct = (id: number) => setSelectedIds(selectedIds.filter((x) => x !== id));

  const compareStats = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const results = selectedIds.flatMap((id) => {
      const product = productsById.get(id);
      if (!product) return [];
      return [getProductStats(id, product, allEntries, testsById, filteredTestIds)];
    });
    return results.length >= 2 ? results : null;
  }, [selectedIds, allEntries, productsById, testsById, filteredTestIds]);

  const chartData = useMemo(() => {
    if (!compareStats) return [];
    const allMonths = new Set<string>();
    for (const s of compareStats) {
      for (const m of s.performanceByMonth.keys()) allMonths.add(m);
    }
    return Array.from(allMonths).sort().map((month) => {
      const row: any = { month };
      for (const s of compareStats) {
        const pm = s.performanceByMonth.get(month);
        row[`p_${s.product.id}`] = pm && pm.ranks.length > 0
          ? parseFloat((pm.ranks.reduce((a, b) => a + b, 0) / pm.ranks.length).toFixed(2))
          : null;
      }
      return row;
    });
  }, [compareStats]);

  const headToHead = useMemo(() => {
    if (!compareStats || compareStats.length < 2) return [];
    const sharedTestIds = new Set<number>();
    const first = compareStats[0];
    for (const testId of first.testRanks.keys()) {
      if (compareStats.every((s) => s.testRanks.has(testId))) {
        sharedTestIds.add(testId);
      }
    }
    return Array.from(sharedTestIds)
      .flatMap((testId) => {
        const test = testsById.get(testId);
        if (!test) return [];
        const ranks = compareStats.map((s) => ({ product: s.product, rank: s.testRanks.get(testId) ?? null }));
        return [{ test, ranks }];
      })
      .sort((a, b) => b.test.date.localeCompare(a.test.date));
  }, [compareStats, testsById]);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-product-compare">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50">
          <BarChart3 className="h-4 w-4 text-violet-600" />
        </div>
        <h2 className="text-base font-semibold">Compare products</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {selectedIds.map((id) => {
          const p = productsById.get(id);
          if (!p) return null;
          return (
            <Badge key={id} variant="secondary" className="gap-1 pr-1" data-testid={`badge-compare-product-${id}`}>
              {p.brand} {p.name}
              <button
                onClick={() => removeProduct(id)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                data-testid={`button-remove-compare-${id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1" data-testid="button-add-compare-product">
              <Search className="h-3.5 w-3.5" />
              Add product
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0" align="start">
            <Command>
              <CommandInput placeholder={t("analytics.searchProducts")} data-testid="input-compare-search" />
              <CommandList>
                <CommandEmpty>No matches.</CommandEmpty>
                <CommandGroup heading="Products">
                  {products.filter((p) => !selectedIds.includes(p.id)).map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.brand} ${p.name}`}
                      onSelect={() => addProduct(p.id)}
                      data-testid={`option-compare-product-${p.id}`}
                    >
                      <span className="truncate">{p.brand} {p.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{p.category}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedIds.length < 2 && (
        <p className="text-sm text-muted-foreground" data-testid="text-compare-hint">
          Select at least 2 products to compare.
        </p>
      )}

      {compareStats && (
        <div className="flex flex-col gap-4" data-testid="section-compare-results">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" data-testid="table-compare-summary">
              <thead className="bg-muted/80">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Product</th>
                  <th className="text-center px-3 py-2 font-medium">Tests</th>
                  <th className="text-center px-3 py-2 font-medium">Wins</th>
                  <th className="text-center px-3 py-2 font-medium">Avg rank</th>
                  <th className="text-center px-3 py-2 font-medium">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {compareStats.map((s, i) => {
                  const best = compareStats.every((o) => o === s || (s.avgRank !== null && (o.avgRank === null || s.avgRank <= o.avgRank)));
                  return (
                    <tr key={s.product.id} className={cn("border-t", best && "bg-amber-50/50")} data-testid={`row-compare-${s.product.id}`}>
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                          {s.product.brand} {s.product.name}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">{s.totalTests}</td>
                      <td className="text-center px-3 py-2">{s.totalWins}</td>
                      <td className="text-center px-3 py-2 font-semibold">{s.avgRank ?? "—"}</td>
                      <td className="text-center px-3 py-2">{s.winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {chartData.length > 1 && (
            <div>
              <div className="text-sm font-medium mb-2">Average rank over time</div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis
                    reversed
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    label={{ value: "Avg Rank", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  {compareStats.map((s, i) => (
                    <Line
                      key={s.product.id}
                      type="monotone"
                      dataKey={`p_${s.product.id}`}
                      name={`${s.product.brand} ${s.product.name}`}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {headToHead.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Head-to-head ({headToHead.length} shared tests)</div>
              <div className="max-h-64 overflow-y-auto rounded-lg border" data-testid="table-head-to-head">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Date</th>
                      <th className="text-left px-3 py-2 font-medium">Location</th>
                      {compareStats.map((s, i) => (
                        <th key={s.product.id} className="text-center px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="truncate max-w-[80px]">{s.product.name}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {headToHead.map(({ test, ranks }) => {
                      const bestRank = Math.min(...ranks.map((r) => r.rank ?? Infinity));
                      return (
                        <tr key={test.id} className="border-t hover:bg-muted/30" data-testid={`row-h2h-${test.id}`}>
                          <td className="px-3 py-2">{fmtDate(test.date)}</td>
                          <td className="px-3 py-2 truncate max-w-[100px]">{test.location}</td>
                          {ranks.map((r) => (
                            <td key={r.product.id} className="text-center px-3 py-2">
                              {r.rank !== null ? (
                                <span className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                  r.rank === bestRank && "bg-amber-100 text-amber-700",
                                  r.rank !== bestRank && "text-muted-foreground",
                                )}>
                                  {r.rank}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Raced Products tab ────────────────────────────────────────────────────────
type RacedProductStat = {
  product: Product;
  glideCount: number;
  structureCount: number;
  kickCount: number;
  total: number;
  usages: { prep: any; role: "glide" | "structure" | "kick"; weather: Weather | null }[];
};

function RacedProductsTab({
  racePreps,
  racedProductStats,
  lang,
  roleFilter,
}: {
  racePreps: any[];
  racedProductStats: RacedProductStat[];
  lang: string;
  roleFilter: string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const L = (no: string, en: string) => lang === "en" ? en : no;

  // Apply role filter from analytics header (All / Glide / Structure)
  const visibleStats = useMemo(() => {
    if (roleFilter === "Glide") return racedProductStats.filter(s => s.glideCount > 0).map(s => ({ ...s, usages: s.usages.filter(u => u.role === "glide") }));
    if (roleFilter === "Structure") return racedProductStats.filter(s => s.structureCount > 0).map(s => ({ ...s, usages: s.usages.filter(u => u.role === "structure") }));
    return racedProductStats;
  }, [racedProductStats, roleFilter]);

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function fmtD(d: string) {
    try { return new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "nb-NO", { dateStyle: "medium" }); } catch { return d; }
  }

  const ROLE_LABEL: Record<string, string> = {
    glide: L("Glid", "Glide"),
    structure: L("Struktur", "Structure"),
    kick: "Kick",
  };

  return (
    <div className="space-y-4 p-1">
      <p className="text-sm text-muted-foreground">
        {L(`${racePreps.length} rennprep-er · ${visibleStats.length} produkter`, `${racePreps.length} race preps · ${visibleStats.length} products`)}
      </p>
      {visibleStats.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {L("Ingen produkter registrert i rennprep ennå.", "No products recorded in race preps yet.")}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleStats.map(({ product, glideCount, structureCount, kickCount, total, usages }) => {
            const isOpen = expanded.has(product.id);
            return (
              <div key={product.id} className="rounded-xl border border-border overflow-hidden">
                {/* Summary row */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => toggle(product.id)}
                >
                  <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{product.brand} {product.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{product.category}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {glideCount > 0 && <span className="rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 px-2 py-0.5">{L("Glid", "Glide")} {glideCount}×</span>}
                    {structureCount > 0 && <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5">{L("Struktur", "Structure")} {structureCount}×</span>}
                    {kickCount > 0 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5">Kick {kickCount}×</span>}
                    <span className="font-bold text-foreground text-sm">{total}×</span>
                  </div>
                </button>

                {/* Expanded usage details */}
                {isOpen && (
                  <div className="border-t border-border divide-y divide-border/50">
                    {usages.map((u, i) => {
                      const p = u.prep;
                      const w = u.weather;
                      return (
                        <div key={i} className="px-4 py-3 bg-muted/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                          {/* Date + location + race type */}
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Dato / Sted", "Date / Location")}</p>
                            <p className="font-medium">{fmtD(p.date)} — {p.location}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Renntype", "Race type")}</p>
                            <p className="font-medium">{p.raceType} <span className="text-muted-foreground text-xs">({p.discipline})</span></p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Rolle", "Role")}</p>
                            <p className="font-medium">{ROLE_LABEL[u.role]}</p>
                          </div>
                          {/* Weather fields */}
                          {w && (
                            <>
                              {w.snowTemperatureC != null && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Snøtemp", "Snow temp")}</p>
                                  <p className="font-medium">{w.snowTemperatureC}°C</p>
                                </div>
                              )}
                              {w.airTemperatureC != null && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Lufttemp", "Air temp")}</p>
                                  <p className="font-medium">{w.airTemperatureC}°C</p>
                                </div>
                              )}
                              {w.snowHumidityPct != null && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Snøfukt", "Snow humidity")}</p>
                                  <p className="font-medium">{w.snowHumidityPct}%</p>
                                </div>
                              )}
                              {w.airHumidityPct != null && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Luftfukt", "Air humidity")}</p>
                                  <p className="font-medium">{w.airHumidityPct}%</p>
                                </div>
                              )}
                              {w.snowType && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Snøtype", "Snow type")}</p>
                                  <p className="font-medium">{w.snowType}</p>
                                </div>
                              )}
                              {w.trackHardness && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Sporhardhet", "Track hardness")}</p>
                                  <p className="font-medium">{w.trackHardness}</p>
                                </div>
                              )}
                              {w.wind && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Vind", "Wind")}</p>
                                  <p className="font-medium">{w.wind}</p>
                                </div>
                              )}
                              {w.artificialSnow && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Kunstig snø", "Artificial snow")}</p>
                                  <p className="font-medium">{w.artificialSnow}</p>
                                </div>
                              )}
                            </>
                          )}
                          {/* Notes / method */}
                          {p.notes && (
                            <div className="sm:col-span-2 md:col-span-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Notater", "Notes")}</p>
                              <p className="text-muted-foreground">{p.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Analytics() {
  const { t } = useI18n();
  const { can } = useAuth();
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "no";
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

  const allTestIds = tests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/all-analytics", allTestIds],
    queryFn: async () => {
      if (allTestIds.length === 0) return [];
      const results = await Promise.all(
        allTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.ok ? r.json() : [])
        )
      );
      return results.flat();
    },
    enabled: allTestIds.length > 0,
  });

  const [testTypeFilter, setTestTypeFilter] = useState<string>("All");
  const [seasonFilter, setSeasonFilter] = useState<string>("All");
  const [activeTab, setActiveTab] = useState<string>("overview");

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const testsById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const seasons = useMemo(() => {
    const s = new Set(tests.map(t => getSkiSeason(t.date)));
    return ["All", ...Array.from(s).sort().reverse()];
  }, [tests]);

  const filteredTests = useMemo(() => {
    let result = testTypeFilter === "All" ? tests : tests.filter(t => t.testType === testTypeFilter);
    if (seasonFilter !== "All") result = result.filter(t => getSkiSeason(t.date) === seasonFilter);
    return result;
  }, [tests, testTypeFilter, seasonFilter]);

  const filteredTestIds = useMemo(() => new Set(filteredTests.map((t) => t.id)), [filteredTests]);
  const filteredEntries = useMemo(() => allEntries.filter((e) => filteredTestIds.has(e.testId)), [allEntries, filteredTestIds]);

  const productWinTrend = useMemo(() => {
    const wins = new Map<number, Map<string, number>>();
    const allMonths = new Set<string>();

    for (const t of filteredTests) {
      const month = t.date.slice(0, 7);
      allMonths.add(month);
      const entries = filteredEntries.filter((e) => e.testId === t.id);
      const winner = entries.find((e) => getRank(e) === 1);
      if (winner?.productId) {
        if (!wins.has(winner.productId)) wins.set(winner.productId, new Map());
        const m = wins.get(winner.productId)!;
        m.set(month, (m.get(month) || 0) + 1);
      }
    }

    const topProductIds = Array.from(wins.entries())
      .map(([pid, monthMap]) => ({ pid, total: Array.from(monthMap.values()).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((x) => x.pid);

    const months = Array.from(allMonths).sort();
    return months.map((month) => {
      const point: any = { month };
      for (const pid of topProductIds) {
        const p = productsById.get(pid);
        const key = p ? `${p.brand} ${p.name}` : `Product ${pid}`;
        point[key] = wins.get(pid)?.get(month) || 0;
      }
      return point;
    });
  }, [filteredTests, filteredEntries, productsById]);

  const productWinTrendKeys = useMemo(() => {
    if (productWinTrend.length === 0) return [];
    const keys = Object.keys(productWinTrend[0]).filter((k) => k !== "month");
    return keys;
  }, [productWinTrend]);

  const avgRankByProduct = useMemo(() => {
    const ranks = new Map<number, number[]>();
    for (const e of filteredEntries) {
      const rank = getRank(e);
      if (e.productId && rank != null) {
        if (!ranks.has(e.productId)) ranks.set(e.productId, []);
        ranks.get(e.productId)!.push(rank);
      }
    }
    return Array.from(ranks.entries())
      .map(([pid, r]) => {
        const p = productsById.get(pid);
        return {
          name: p ? `${p.brand} ${p.name}` : `#${pid}`,
          avgRank: parseFloat((r.reduce((a, b) => a + b, 0) / r.length).toFixed(2)),
          tests: r.length,
        };
      })
      .filter((x) => x.tests >= 2)
      .sort((a, b) => a.avgRank - b.avgRank)
      .slice(0, 10);
  }, [filteredEntries, productsById]);

  const tempVsRank = useMemo(() => {
    const points: { snowTemp: number; avgRank: number; product: string; color: string }[] = [];
    const productRanks = new Map<number, { temps: number[]; ranks: number[] }>();

    for (const t of filteredTests) {
      const w = t.weatherId ? weatherById.get(t.weatherId) : null;
      if (!w) continue;
      const entries = filteredEntries.filter((e) => e.testId === t.id);
      for (const e of entries) {
        const rank = getRank(e);
        if (e.productId && rank != null) {
          if (!productRanks.has(e.productId)) productRanks.set(e.productId, { temps: [], ranks: [] });
          const pr = productRanks.get(e.productId)!;
          pr.temps.push(w.snowTemperatureC);
          pr.ranks.push(rank);
        }
      }
    }

    const topProducts = Array.from(productRanks.entries())
      .map(([pid, data]) => ({
        pid,
        avgRank: data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length,
        count: data.ranks.length,
      }))
      .filter((x) => x.count >= 2)
      .sort((a, b) => a.avgRank - b.avgRank)
      .slice(0, 6);

    for (let i = 0; i < topProducts.length; i++) {
      const { pid } = topProducts[i];
      const data = productRanks.get(pid)!;
      const p = productsById.get(pid);
      const name = p ? `${p.brand} ${p.name}` : `#${pid}`;
      for (let j = 0; j < data.temps.length; j++) {
        points.push({
          snowTemp: data.temps[j],
          avgRank: data.ranks[j],
          product: name,
          color: CHART_COLORS[i % CHART_COLORS.length],
        });
      }
    }
    return points;
  }, [filteredTests, filteredEntries, weatherById, productsById]);

  const testsByMonth = useMemo(() => {
    const months = new Map<string, { glide: number; structure: number }>();
    for (const t of tests) {
      const month = t.date.slice(0, 7);
      if (!months.has(month)) months.set(month, { glide: 0, structure: 0 });
      const m = months.get(month)!;
      if (t.testType === "Glide") m.glide++;
      else m.structure++;
    }
    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({ month, ...counts }));
  }, [tests]);

  const hasData = tests.length > 0;

  // Compute topByWinRate for PDF export (same logic as OverviewStats, using allEntries)
  const exportTopByWinRate = useMemo(() => {
    const pStats = new Map<number, { appearances: number; ranks: number[]; wins: number }>();
    for (const e of allEntries) {
      const ids: number[] = [];
      if (e.productId != null) ids.push(e.productId);
      if (e.additionalProductIds) {
        for (const s of e.additionalProductIds.split(",")) { const n = parseInt(s, 10); if (!isNaN(n)) ids.push(n); }
      }
      const rank = getRank(e);
      for (const pid of ids) {
        if (!pStats.has(pid)) pStats.set(pid, { appearances: 0, ranks: [], wins: 0 });
        const ps = pStats.get(pid)!;
        ps.appearances++;
        if (rank !== null) { ps.ranks.push(rank); if (rank === 1) ps.wins++; }
      }
    }
    return Array.from(pStats.entries())
      .filter(([, s]) => s.appearances >= 3 && s.ranks.length > 0)
      .map(([pid, s]) => {
        const p = productsById.get(pid);
        return {
          name: p ? `${p.brand} ${p.name}` : `#${pid}`,
          appearances: s.appearances,
          avgRank: parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)),
          winRate: parseFloat(((s.wins / s.ranks.length) * 100).toFixed(1)),
          wins: s.wins,
        };
      })
      .sort((a, b) => b.winRate - a.winRate || a.avgRank - b.avgRank)
      .slice(0, 10);
  }, [allEntries, productsById]);

  function handleExportPDF() {
    const newWin = window.open("", "_blank");
    if (!newWin) return;

    const totalTests = tests.length;
    const productsTested = new Set(allEntries.map((e) => e.productId).filter(Boolean)).size;
    const uniqueLocations = new Set(tests.map((t) => t.location)).size;
    const withWeather = tests.filter((t) => t.weatherId != null).length;
    const weatherPct = totalTests > 0 ? Math.round((withWeather / totalTests) * 100) : 0;

    const topRows = exportTopByWinRate.map((p, i) => [i + 1, p.name, p.appearances, p.avgRank, `${p.winRate}%`, p.wins]);
    const monthRows = testsByMonth.map((m) => [m.month, (m.glide || 0) + (m.structure || 0)]);

    const body = `
      <div class="pdf-title">Analytics Report</div>
      <div class="pdf-subtitle">${seasonFilter !== "All" ? `Season ${seasonFilter} · ` : ""}${testTypeFilter !== "All" ? `${testTypeFilter} · ` : ""}All data</div>

      ${pdfCards([
        { value: totalTests, label: "Total Tests" },
        { value: productsTested, label: "Products Tested" },
        { value: uniqueLocations, label: "Unique Locations" },
        { value: `${weatherPct}%`, label: "Tests with Weather" },
      ])}

      ${pdfSection("Top Products by Win Rate")}
      ${pdfTable(["Rank", "Product", "Tests", "Avg Rank", "Win Rate", "Wins"], topRows)}

      <div class="page-break"></div>
      ${pdfSection("Tests per Month")}
      ${pdfTable(["Month", "Total Tests"], monthRows)}
    `;

    openPdfWindow(pdfDocument("Analytics Report", body), newWin);
  }

  const canGrind = can("grinding", "view");
  const TABS = [
    { id: "overview", label: t("analytics.overview"), icon: <BarChart3 className="h-4 w-4" /> },
    { id: "products", label: t("analytics.products"), icon: <Search className="h-4 w-4" /> },
    { id: "compare", label: t("analytics.compare"), icon: <TrendingUp className="h-4 w-4" /> },
    { id: "conditions", label: t("analytics.conditions"), icon: <Snowflake className="h-4 w-4" /> },
    { id: "racedproducts", label: "Raced Products", icon: <Trophy className="h-4 w-4" /> },
  ];

  const { data: grindProfiles = [] } = useQuery<any[]>({
    queryKey: ["/api/grind-profiles"],
    enabled: canGrind,
  });

  // Build a map from test.id -> entries for fast lookup in grind stats
  const entriesByTestId = useMemo(() => {
    const m = new Map<number, TestEntry[]>();
    for (const e of allEntries) {
      const arr = m.get(e.testId) || [];
      arr.push(e);
      m.set(e.testId, arr);
    }
    return m;
  }, [allEntries]);

  const grindStats = useMemo(() => {
    if (!canGrind) return { stoneMap: new Map<string, { wins: number; total: number }>(), patternMap: new Map<string, { wins: number; total: number }>() };

    const grindTests = filteredTests.filter(t => t.testType === "Grind");
    const stoneMap = new Map<string, { wins: number; total: number }>();
    const patternMap = new Map<string, { wins: number; total: number }>();

    for (const test of grindTests) {
      const entries = entriesByTestId.get(test.id) || [];
      for (const entry of entries) {
        const profile = grindProfiles.find((p: any) => p.id === (entry as any).grindProfileId);
        const stone = profile?.stone || (entry as any).grindStone || "Ukjent";
        const pattern = profile?.pattern || (entry as any).grindPattern || "Ukjent";

        if (stone) {
          const s = stoneMap.get(stone) || { wins: 0, total: 0 };
          s.total++;
          if (entry.rank0km === 1) s.wins++;
          stoneMap.set(stone, s);
        }
        if (pattern) {
          const p = patternMap.get(pattern) || { wins: 0, total: 0 };
          p.total++;
          if (entry.rank0km === 1) p.wins++;
          patternMap.set(pattern, p);
        }
      }
    }

    return { stoneMap, patternMap };
  }, [filteredTests, entriesByTestId, grindProfiles, canGrind]);

  const { data: racePreps = [] } = useQuery<any[]>({
    queryKey: ["/api/race-preps"],
    enabled: can("raceskis", "view"),
  });

  const racedProductStats = useMemo(() => {
    const counts = new Map<number, RacedProductStat>();

    const addIds = (idsStr: string | null, type: "glide" | "structure" | "kick", prep: any) => {
      if (!idsStr) return;
      for (const idStr of idsStr.split(",")) {
        const id = parseInt(idStr);
        if (isNaN(id)) continue;
        const product = productsById.get(id);
        if (!product) continue;
        const existing = counts.get(id) ?? { product, glideCount: 0, structureCount: 0, kickCount: 0, total: 0, usages: [] };
        if (type === "glide") existing.glideCount++;
        else if (type === "structure") existing.structureCount++;
        else existing.kickCount++;
        existing.total++;
        const weather = prep.weatherId ? (weatherById.get(prep.weatherId) ?? null) : null;
        existing.usages.push({ prep, role: type, weather });
        counts.set(id, existing);
      }
    };

    for (const prep of racePreps) {
      addIds(prep.productIds, "glide", prep);
      addIds(prep.structureIds, "structure", prep);
      addIds(prep.kickProductIds, "kick", prep);
    }

    return Array.from(counts.values()).sort((a, b) => b.total - a.total);
  }, [racePreps, productsById, weatherById]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-analytics-title">
              {t("analytics.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("analytics.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["All", "Glide", "Structure"]).map((type) => (
              <Button
                key={type}
                variant={testTypeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTestTypeFilter(type)}
                data-testid={`button-filter-${type.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {type === "All" ? t("analytics.all") : type === "Glide" ? t("tests.glide") : type === "Structure" ? t("tests.structure") : type}
              </Button>
            ))}
            {seasons.length > 1 && (
              <>
                <span className="text-xs text-muted-foreground font-medium ml-1">Season:</span>
                {seasons.slice(0, Math.min(5, seasons.length)).map((season) => (
                  <Button
                    key={season}
                    variant={seasonFilter === season ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSeasonFilter(season)}
                    data-testid={`button-season-${season.replace("/", "-")}`}
                  >
                    {season}
                  </Button>
                ))}
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-1.5">
              <FileDown className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 border-b border-border overflow-x-auto px-1"
          style={{ backgroundColor: "hsl(var(--primary) / 0.06)" }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-transparent"
                  : "border-transparent text-muted-foreground hover:text-foreground/80"
              }`}
              style={
                activeTab === tab.id
                  ? { borderColor: "hsl(var(--primary))", color: "hsl(var(--primary))" }
                  : undefined
              }
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <>
            {!hasData ? (
              <Card className="fs-card rounded-2xl p-8 text-center">
                <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <p className="mt-4 text-muted-foreground" data-testid="empty-analytics">{t("analytics.noData")}</p>
              </Card>
            ) : (
              <>
                <ActivityHeatmap tests={tests} />
                <OverviewStats
                  tests={tests}
                  allEntries={allEntries}
                  products={products}
                  productsById={productsById}
                  testsById={testsById}
                  weatherById={weatherById}
                />
                <FormTracker
                  allEntries={allEntries}
                  productsById={productsById}
                  testsById={testsById}
                />

                <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-wins-trend">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h2 className="text-base font-semibold">Product wins over time</h2>
                  </div>
                  {productWinTrend.length > 0 && productWinTrendKeys.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={productWinTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                        <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {productWinTrendKeys.map((key, i) => (
                          <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enough win data to display trend.</p>
                  )}
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-avg-rank">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50">
                        <Award className="h-4 w-4 text-green-600" />
                      </div>
                      <h2 className="text-base font-semibold">Average rank by product</h2>
                      <span className="text-xs text-muted-foreground">(min 2 tests)</span>
                    </div>
                    {avgRankByProduct.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={avgRankByProduct} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" width={130} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} formatter={(value: any, name: string) => { if (name === "avgRank") return [value, "Avg Rank"]; return [value, name]; }} />
                          <Bar dataKey="avgRank" radius={[0, 6, 6, 0]}>
                            {avgRankByProduct.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not enough data (need products with 2+ test appearances).</p>
                    )}
                  </Card>

                  <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-tests-month">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50">
                        <BarChart3 className="h-4 w-4 text-violet-600" />
                      </div>
                      <h2 className="text-base font-semibold">Tests per month</h2>
                    </div>
                    {testsByMonth.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={testsByMonth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar dataKey="glide" name="Glide" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="structure" name="Structure" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">No test data yet.</p>
                    )}
                  </Card>
                </div>
              </>
            )}
          </>
        )}

        {/* Products tab */}
        {activeTab === "products" && (
          <ErrorBoundary label="Products">
            <ProductSearchStats
              products={products}
              tests={tests}
              allEntries={allEntries}
              productsById={productsById}
              testsById={testsById}
              weatherById={weatherById}
            />
          </ErrorBoundary>
        )}

        {/* Compare tab */}
        {activeTab === "compare" && (
          <>
            <ErrorBoundary label="Head-to-head matrix">
              <HeadToHeadMatrix
                allEntries={filteredEntries}
                productsById={productsById}
                testsById={testsById}
              />
            </ErrorBoundary>
            <ErrorBoundary label="Compare">
              <ProductCompare
                products={products}
                allEntries={allEntries}
                productsById={productsById}
                testsById={testsById}
                filteredTestIds={filteredTestIds}
              />
            </ErrorBoundary>
            <ErrorBoundary label="Combination search">
              <CombinationSearch
                products={products}
                allEntries={allEntries}
                productsById={productsById}
                testsById={testsById}
                weatherById={weatherById}
              />
            </ErrorBoundary>
          </>
        )}

        {/* Conditions tab */}
        {activeTab === "conditions" && (
          <>
            <BestProductsByConditions
              products={products}
              tests={filteredTests}
              allEntries={filteredEntries}
              productsById={productsById}
              testsById={testsById}
              weatherById={weatherById}
            />

            <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-temp-rank">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50">
                  <Thermometer className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="text-base font-semibold">Snow temperature vs. rank</h2>
                <span className="text-xs text-muted-foreground">(top 6 products, lower rank = better)</span>
              </div>
              {tempVsRank.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="snowTemp" name="Snow Temp" unit="°C" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis dataKey="avgRank" name="Rank" reversed tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                      content={({ payload }) => {
                        if (!payload || payload.length === 0) return null;
                        const d = payload[0]?.payload;
                        if (!d) return null;
                        return (
                          <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
                            <div className="font-semibold">{d.product}</div>
                            <div>Snow temp: {d.snowTemp}°C</div>
                            <div>Rank: {d.avgRank}</div>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={tempVsRank}>
                      {tempVsRank.map((point, i) => (<Cell key={i} fill={point.color} />))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">Need tests with linked weather data to show temperature correlations.</p>
              )}
              {tempVsRank.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {Array.from(new Set(tempVsRank.map((p) => p.product))).map((name, i) => (
                    <span key={name} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-border/30" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {activeTab === "racedproducts" && (
          <RacedProductsTab
            racePreps={racePreps}
            racedProductStats={racedProductStats}
            lang={lang}
            roleFilter={testTypeFilter}
          />
        )}

      </div>
    </AppShell>
  );
}
