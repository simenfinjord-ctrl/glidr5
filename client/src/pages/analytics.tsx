// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Thermometer, Award, Filter, Search, Trophy, Percent, Hash, FlaskConical, X, Snowflake, Droplets, Wind, MapPin, Activity, CalendarDays, Target, Layers, AlignLeft, FileDown, ChevronDown, ChevronUp, ChevronRight, ArrowRight, Footprints, FileText, Users, Cloud, Sparkles } from "lucide-react";
import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { parseApplication } from "@/lib/parse-application";
import { Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { pdfDocument, pdfSection, pdfCards, pdfTable, openPdfWindow } from "@/lib/pdf-layout";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { useLocation } from "wouter";

type Test = {
  id: number;
  date: string;
  location: string;
  testType: string;
  seriesId: number;
  weatherId: number | null;
  groupScope: string;
  createdAt: string;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
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

// 2°C snow temperature buckets for temperature curve
const SNOW_TEMP_2C = Array.from({ length: 15 }, (_, i) => {
  const min = -20 + i * 2;
  const max = min + 2;
  const minStr = min < 0 ? `${min}` : `+${min}`;
  const maxStr = max <= 0 ? `${max}` : `+${max}`;
  return { min, max, label: `${minStr}/${maxStr}°` };
});

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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
              <th className="text-center px-3 py-2 font-medium">{L("Tester", "Tests")}</th>
              <th className="text-center px-3 py-2 font-medium">{L("Snittrang", "Avg rank")}</th>
              <th className="text-center px-3 py-2 font-medium">{L("Seire", "Wins")}</th>
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <CalendarDays className="h-4 w-4 text-emerald-600" />
        </div>
        <h2 className="text-base font-semibold">{L("Testaktivitet", "Test activity")}</h2>
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
            <span className="text-[10px] text-muted-foreground">{L("Mindre", "Less")}</span>
            {["bg-muted/40", "bg-green-200", "bg-green-400", "bg-green-600"].map((c, i) => (
              <div key={i} className={`h-3 w-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] text-muted-foreground">{L("Mer", "More")}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Overview Stats ─────────────────────────────────────────────────────────────

function OverviewStats({
  tests, allEntries, products, productsById, testsById, weatherById, productCategoryFilter,
}: {
  tests: Test[];
  allEntries: TestEntry[];
  products: Product[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  weatherById: Map<number, Weather>;
  productCategoryFilter?: string;
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
        // Filter by product category if a category filter is active
        if (productCategoryFilter === "Structure") {
          const p = productsById.get(pid);
          if (!p || p.category !== "Structure tool") continue;
        } else if (productCategoryFilter === "Glide") {
          const p = productsById.get(pid);
          if (!p || p.category === "Structure tool") continue;
        }
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
  }, [tests, allEntries, productsById, weatherById, productCategoryFilter]);

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
            <p className="text-xs text-muted-foreground">{L("Ikke nok data ennå.", "Not enough data yet.")}</p>
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
            <p className="text-xs text-muted-foreground">{L("Ingen værkoblede tester ennå.", "No weather-linked tests yet.")}</p>
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
                  <p className="text-xs text-muted-foreground mb-1">{L("Snøfuktighet", "Snow humidity")}</p>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(stats.humidityTypeDist.entries()).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">{k}: {v}</span>
                    ))}
                  </div>
                </div>
              )}
              {stats.trackHardnessDist.size > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{L("Sporhardhet", "Track hardness")}</p>
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 dark:bg-orange-900/20">
          <TrendingUp className="h-4 w-4 text-orange-500" />
        </div>
        <h2 className="text-base font-semibold">{L("Formkurve", "Form tracker")}</h2>
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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

  if (data.length === 0) return <p className="text-xs text-muted-foreground">{L("Ingen værkoblede tester for dette produktet.", "No weather-linked tests for this product.")}</p>;

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
              <th className="text-left px-3 py-2 text-xs font-medium">{L("Snøtemp-område", "Snow temp range")}</th>
              <th className="text-center px-3 py-2 text-xs font-medium">{L("Tester", "Tests")}</th>
              <th className="text-center px-3 py-2 text-xs font-medium">{L("Snittrang", "Avg rank")}</th>
              <th className="text-center px-3 py-2 text-xs font-medium">{L("Seire", "Wins")}</th>
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
        <h2 className="text-base font-semibold">{L("Beste produkter etter forhold", "Best products by conditions")}</h2>
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
                  <th className="text-left px-3 py-2 text-xs font-medium">{L("Produkt", "Product")}</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">{L("Tester", "Tests")}</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">{L("Snittrang", "Avg rank")}</th>
                  <th className="text-center px-3 py-2 text-xs font-medium">{L("Seiersrate", "Win rate")}</th>
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
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [expandedCombo, setExpandedCombo] = useState<number | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

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

    // Helper: get the application string for a specific product in an entry
    function getEntryApp(entry: TestEntry, productId: number): string {
      if (!entry.methodology) return "";
      const apps = entry.methodology.split("|");
      if (entry.productId === productId) return apps[0]?.trim() ?? "";
      if (entry.additionalProductIds) {
        const addIds = entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n));
        const idx = addIds.indexOf(productId);
        if (idx !== -1) return apps[idx + 1]?.trim() ?? "";
      }
      return "";
    }
    function mostCommonApp(arr: string[]): string {
      const filtered = arr.filter(Boolean);
      if (filtered.length === 0) return "";
      const freq = new Map<string, number>();
      for (const v of filtered) freq.set(v, (freq.get(v) || 0) + 1);
      return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    // Best combinations: other products that appear on the same ski in the same entry
    const comboMap = new Map<number, { count: number; wins: number; totalRank: number; selectedApps: string[]; partnerApps: string[] }>();
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
      const selectedApp = getEntryApp(entry, selectedProductId!);
      for (const pid of partners) {
        if (!comboMap.has(pid)) comboMap.set(pid, { count: 0, wins: 0, totalRank: 0, selectedApps: [], partnerApps: [] });
        const c = comboMap.get(pid)!;
        c.count++;
        if (rank !== null) { c.totalRank += rank; if (rank === 1) c.wins++; }
        if (selectedApp) c.selectedApps.push(selectedApp);
        const partnerApp = getEntryApp(entry, pid);
        if (partnerApp) c.partnerApps.push(partnerApp);
      }
    }
    const bestCombinations = Array.from(comboMap.entries())
      .map(([partnerId, s]) => ({
        partnerId,
        count: s.count,
        avgRank: s.count > 0 ? parseFloat((s.totalRank / s.count).toFixed(2)) : null,
        wins: s.wins,
        selectedApp: mostCommonApp(s.selectedApps),
        partnerApp: mostCommonApp(s.partnerApps),
      }))
      .sort((a, b) => b.count - a.count || (a.avgRank ?? 99) - (b.avgRank ?? 99))
      .slice(0, 6);

    const medianRank = median(ranks);
    const rankStdDev = stdDev(ranks);

    const podiumCount = ranks.filter(r => r <= 3).length;
    const podiumRate = ranks.length > 0 ? parseFloat(((podiumCount / ranks.length) * 100).toFixed(1)) : 0;

    // Application insights: group by primary application of entries where this product is primary
    const appMap = new Map<string, { count: number; ranks: number[]; temps: number[]; snowTypes: string[] }>();
    for (const entry of productEntries) {
      if (!entry.methodology) continue;
      // Only count entries where this product is the primary product
      if (entry.productId !== selectedProductId) continue;
      const primaryApp = entry.methodology.split('|')[0].trim();
      if (!primaryApp) continue;
      const parsed = parseApplication(primaryApp);
      const key = parsed.interpreted || primaryApp;
      if (!appMap.has(key)) appMap.set(key, { count: 0, ranks: [], temps: [], snowTypes: [] });
      const s = appMap.get(key)!;
      s.count++;
      const rank = getRank(entry);
      if (rank !== null) s.ranks.push(rank);
      const test = testsById.get(entry.testId);
      const w = test?.weatherId ? weatherById.get(test.weatherId) : undefined;
      if (w?.airTemperatureC != null) s.temps.push(w.airTemperatureC);
      if (w?.snowType) s.snowTypes.push(w.snowType);
    }
    const appStats = Array.from(appMap.entries())
      .map(([application, s]) => ({
        application,
        count: s.count,
        avgRank: s.ranks.length > 0 ? parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(1)) : null,
        bestRank: s.ranks.length > 0 ? Math.min(...s.ranks) : null,
        avgTemp: s.temps.length > 0 ? parseFloat((s.temps.reduce((a, b) => a + b, 0) / s.temps.length).toFixed(1)) : null,
        commonSnow: s.snowTypes.length > 0
          ? [...s.snowTypes].sort((a, b) => s.snowTypes.filter(x => x === b).length - s.snowTypes.filter(x => x === a).length)[0]
          : null,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99));

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
      appStats,
      productEntries,
    };
  }, [selectedProductId, allEntries, testsById, weatherById]);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-product-search">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/20">
          <Search className="h-4 w-4 text-cyan-600" />
        </div>
        <h2 className="text-base font-semibold">{L("Produktytelse-oppslag", "Product performance lookup")}</h2>
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
                <CommandEmpty>{L("Ingen treff.", "No matches.")}</CommandEmpty>
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
              <div className="text-xs text-muted-foreground">{L("Totalt antall tester", "Total tests")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-total-wins">{stats.totalWins}</div>
              <div className="text-xs text-muted-foreground">Wins (#1)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-avg-rank">{stats.avgRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{L("Snittrang", "Avg rank")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-win-rate">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">{L("Seiersrate", "Win rate")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Target className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold">{stats.medianRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{L("Medianrang", "Median rank")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Activity className="h-4 w-4 mx-auto text-orange-500 mb-1" />
              <div className="text-2xl font-bold">{stats.rankStdDev ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Consistency (σ)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold">{stats.podiumRate}%</div>
              <div className="text-xs text-muted-foreground">{L("Pallplassrate", "Podium rate")}</div>
            </div>
          </div>

          {stats.methodologyBreakdown.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{L("Metodikkfordeling", "Methodology breakdown")}</span>
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
                  <span className="text-sm font-medium">{L("Rangfordeling", "Ranking distribution")}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{L("Pallplassrate: ", "Podium rate: ")}<span className="font-bold text-amber-600">{podiumPct}%</span></span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                    <Bar dataKey="count" name={L("Ganger", "Times")} radius={[4, 4, 0, 0]}>
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
              <div className="text-sm font-medium mb-2">{L("Ytelse over tid", "Performance over time")}</div>
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
                title={L("Snøtemperatur", "Snow temperature")}
                icon={<Snowflake className="h-3.5 w-3.5 text-sky-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.snowTemperatureC != null ? tempBracket(w.snowTemperatureC) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title={L("Lufttemperatur", "Air temperature")}
                icon={<Thermometer className="h-3.5 w-3.5 text-orange-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.airTemperatureC != null ? airTempBracket(w.airTemperatureC) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title={L("Snøfukttype", "Snow humidity type")}
                icon={<Droplets className="h-3.5 w-3.5 text-blue-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.snowHumidityType ?? null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title={L("Sporhardhet", "Track hardness")}
                icon={<Target className="h-3.5 w-3.5 text-amber-600" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.trackHardness ?? null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title={L("Luftfuktighet", "Air humidity")}
                icon={<Wind className="h-3.5 w-3.5 text-teal-500" />}
                entries={stats.productEntries}
                getBucket={(e, t, w) => w?.airHumidityPct != null ? humidityBracket(w.airHumidityPct) : null}
                testsById={testsById}
                weatherById={weatherById}
              />
              <BucketBreakdown
                title={L("Teststed", "Test location")}
                icon={<MapPin className="h-3.5 w-3.5 text-rose-500" />}
                entries={stats.productEntries}
                getBucket={(e, t) => t.location}
                testsById={testsById}
                weatherById={weatherById}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
                        <th className="text-left px-3 py-2 text-xs font-medium">{L("Oppskrift", "Recipe")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Ganger", "Times")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Snittrang", "Avg rank")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Seire", "Wins")}</th>
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bestCombinations.map((c, i) => {
                        const partner = productsById.get(c.partnerId);
                        const selParsed = c.selectedApp ? parseApplication(c.selectedApp) : null;
                        const partParsed = c.partnerApp ? parseApplication(c.partnerApp) : null;
                        const selName = selectedProduct ? `${selectedProduct.brand} ${selectedProduct.name}` : "—";
                        const partName = partner ? `${partner.brand} ${partner.name}` : `#${c.partnerId}`;
                        const isOpen = expandedCombo === c.partnerId;
                        // Find all test results that contain this partner product
                        const comboTests = stats.testResults.filter(({ entry }) => {
                          if (entry.productId !== null && entry.productId !== selectedProductId && entry.productId === c.partnerId) return true;
                          if (entry.additionalProductIds) {
                            const ids = entry.additionalProductIds.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                            if (ids.includes(c.partnerId)) return true;
                          }
                          return false;
                        });
                        return (
                          <React.Fragment key={c.partnerId}>
                            <tr
                              className={cn("border-t cursor-pointer hover:bg-muted/30 transition-colors", i === 0 && "bg-violet-50/40 dark:bg-violet-900/10")}
                              onClick={() => setExpandedCombo(isOpen ? null : c.partnerId)}
                            >
                              <td className="px-3 py-2.5">
                                {i === 0 && (
                                  <div className="text-[9px] font-semibold uppercase tracking-wider text-violet-500 mb-1.5">{L("Beste kombinasjon", "Best combo")}</div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-xs font-semibold text-violet-800 dark:text-violet-200 ring-1 ring-violet-300/60 dark:ring-violet-600/40">
                                    {selName}
                                    {selParsed?.interpreted && (
                                      <span className="font-normal opacity-75 ml-0.5">· {selParsed.interpreted}</span>
                                    )}
                                  </span>
                                  <span className="text-muted-foreground text-xs font-medium">+</span>
                                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-border/60">
                                    {partName}
                                    {partParsed?.interpreted && (
                                      <span className="font-normal text-muted-foreground ml-0.5">· {partParsed.interpreted}</span>
                                    )}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center text-muted-foreground text-xs">{c.count}</td>
                              <td className="px-3 py-2.5 text-center font-semibold text-xs">{c.avgRank ?? "—"}</td>
                              <td className="px-3 py-2.5 text-center text-xs">{c.wins > 0 ? <span className="text-amber-600 font-bold">{c.wins}</span> : "—"}</td>
                              <td className="px-2 py-2.5 text-center">
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t bg-violet-50/20 dark:bg-violet-900/5">
                                <td colSpan={5} className="px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-500 mb-2">
                                    {comboTests.length} test{comboTests.length !== 1 ? "s" : ""} with this combination
                                  </div>
                                  {comboTests.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">{L("Ingen testdetaljer funnet.", "No test details found.")}</p>
                                  ) : (
                                    <div className="rounded-md border overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/60">
                                          <tr>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Dato", "Date")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Sted", "Location")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Type", "Type")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Applikasjon", "Application")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Partnerapplikasjon", "Partner app")}</th>
                                            <th className="text-center px-2.5 py-1.5 font-medium">Snow °C</th>
                                            <th className="text-center px-2.5 py-1.5 font-medium">{L("Rang", "Rank")}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {comboTests.map(({ test, rank, entry }, idx) => {
                                            const w = test.weatherId ? weatherById.get(test.weatherId) : undefined;
                                            const selApp = entry.methodology ? parseApplication(entry.methodology.split("|")[0].trim()).interpreted || entry.methodology.split("|")[0].trim() : "—";
                                            let partApp = "—";
                                            if (entry.methodology && entry.additionalProductIds) {
                                              const addIds = entry.additionalProductIds.split(",").map((s) => parseInt(s.trim(), 10));
                                              const idx2 = addIds.indexOf(c.partnerId);
                                              if (idx2 !== -1) {
                                                const raw = entry.methodology.split("|")[idx2 + 1]?.trim() ?? "";
                                                partApp = raw ? (parseApplication(raw).interpreted || raw) : "—";
                                              }
                                            } else if (entry.productId === c.partnerId && entry.methodology) {
                                              partApp = parseApplication(entry.methodology.split("|")[0].trim()).interpreted || entry.methodology.split("|")[0].trim() || "—";
                                            }
                                            return (
                                              <tr key={`${test.id}-${idx}`} className={cn("border-t hover:bg-muted/30", idx === 0 && "")}>
                                                <td className="px-2.5 py-1.5 font-medium">{fmtDate(test.date)}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground">{test.location}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground">{test.testType}</td>
                                                <td className="px-2.5 py-1.5">{selApp}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground">{partApp}</td>
                                                <td className="px-2.5 py-1.5 text-center text-muted-foreground">{w?.snowTemperatureC != null ? `${w.snowTemperatureC}°` : "—"}</td>
                                                <td className="px-2.5 py-1.5 text-center">
                                                  {rank != null ? (
                                                    <span className={cn(
                                                      "inline-flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold",
                                                      rank === 1 && "bg-yellow-500/20 text-yellow-600",
                                                      rank === 2 && "bg-slate-300/20 text-slate-500",
                                                      rank === 3 && "bg-amber-700/20 text-amber-600",
                                                      rank > 3 && "bg-muted/60 text-muted-foreground",
                                                    )}>#{rank}</span>
                                                  ) : "—"}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {stats.appStats.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-amber-500" />
                  Application insights
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium">{L("Applikasjon", "Application")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Antall", "Count")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Snittrang", "Avg rank")}</th>
                        <th className="text-center px-3 py-2 text-xs font-medium">{L("Beste", "Best")}</th>
                        <th className="text-left px-3 py-2 text-xs font-medium">{L("Forhold", "Conditions")}</th>
                        <th className="w-8 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.appStats.map((s, i) => {
                        const isOpen = expandedApp === s.application;
                        // Find all test results where this product was primary and application matches
                        const appTests = stats.testResults.filter(({ entry }) => {
                          if (entry.productId !== selectedProductId) return false;
                          if (!entry.methodology) return false;
                          const primaryApp = entry.methodology.split("|")[0].trim();
                          const parsed = parseApplication(primaryApp);
                          return (parsed.interpreted || primaryApp) === s.application;
                        });
                        return (
                          <React.Fragment key={i}>
                            <tr
                              className={cn("border-t cursor-pointer hover:bg-muted/30 transition-colors", i === 0 && "bg-amber-50/40 dark:bg-amber-900/10")}
                              onClick={() => setExpandedApp(isOpen ? null : s.application)}
                            >
                              <td className="px-3 py-1.5 font-medium text-xs">
                                {i === 0 && <span className="mr-1 text-amber-500">★</span>}
                                {s.application}
                              </td>
                              <td className="px-3 py-1.5 text-center text-muted-foreground">{s.count}</td>
                              <td className="px-3 py-1.5 text-center font-semibold">{s.avgRank ?? "—"}</td>
                              <td className="px-3 py-1.5 text-center">
                                {s.bestRank != null ? (
                                  <span className={cn(
                                    "inline-flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold",
                                    s.bestRank === 1 && "bg-yellow-500/20 text-yellow-600",
                                    s.bestRank === 2 && "bg-slate-300/20 text-slate-500",
                                    s.bestRank === 3 && "bg-amber-700/20 text-amber-600",
                                    s.bestRank > 3 && "bg-muted/60 text-muted-foreground",
                                  )}>{s.bestRank}</span>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                {[
                                  s.avgTemp != null ? `${s.avgTemp}°C` : null,
                                  s.commonSnow,
                                ].filter(Boolean).join(", ") || "—"}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-t bg-amber-50/20 dark:bg-amber-900/5">
                                <td colSpan={6} className="px-3 py-3">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 mb-2">
                                    {appTests.length} test{appTests.length !== 1 ? "s" : ""} with this application
                                  </div>
                                  {appTests.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">{L("Ingen testdetaljer funnet.", "No test details found.")}</p>
                                  ) : (
                                    <div className="rounded-md border overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-muted/60">
                                          <tr>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Dato", "Date")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Sted", "Location")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Type", "Type")}</th>
                                            <th className="text-left px-2.5 py-1.5 font-medium">{L("Full metodikk", "Full methodology")}</th>
                                            <th className="text-center px-2.5 py-1.5 font-medium">Snow °C</th>
                                            <th className="text-center px-2.5 py-1.5 font-medium">Air °C</th>
                                            <th className="text-center px-2.5 py-1.5 font-medium">{L("Rang", "Rank")}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {appTests.map(({ test, rank, entry }, idx) => {
                                            const w = test.weatherId ? weatherById.get(test.weatherId) : undefined;
                                            return (
                                              <tr key={`${test.id}-${idx}`} className="border-t hover:bg-muted/30">
                                                <td className="px-2.5 py-1.5 font-medium">{fmtDate(test.date)}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground">{test.location}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground">{test.testType}</td>
                                                <td className="px-2.5 py-1.5 max-w-[200px] truncate" title={entry.methodology ?? ""}>{entry.methodology || "—"}</td>
                                                <td className="px-2.5 py-1.5 text-center text-muted-foreground">{w?.snowTemperatureC != null ? `${w.snowTemperatureC}°` : "—"}</td>
                                                <td className="px-2.5 py-1.5 text-center text-muted-foreground">{w?.airTemperatureC != null ? `${w.airTemperatureC}°` : "—"}</td>
                                                <td className="px-2.5 py-1.5 text-center">
                                                  {rank != null ? (
                                                    <span className={cn(
                                                      "inline-flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold",
                                                      rank === 1 && "bg-yellow-500/20 text-yellow-600",
                                                      rank === 2 && "bg-slate-300/20 text-slate-500",
                                                      rank === 3 && "bg-amber-700/20 text-amber-600",
                                                      rank > 3 && "bg-muted/60 text-muted-foreground",
                                                    )}>#{rank}</span>
                                                  ) : "—"}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

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
                        <th className="text-left px-3 py-2 font-medium">{L("Sted", "Location")}</th>
                        <th className="text-center px-3 py-2 font-medium">{L("Tester", "Tests")}</th>
                        <th className="text-center px-3 py-2 font-medium">{L("Snittrang", "Avg rank")}</th>
                        <th className="text-center px-3 py-2 font-medium">{L("Seire", "Wins")}</th>
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
                    <th className="text-left px-3 py-2 font-medium">{L("Dato", "Date")}</th>
                    <th className="text-left px-3 py-2 font-medium">{L("Sted", "Location")}</th>
                    <th className="text-left px-3 py-2 font-medium">{L("Type", "Type")}</th>
                    <th className="text-center px-3 py-2 font-medium">Snow °C</th>
                    <th className="text-center px-3 py-2 font-medium">Air °C</th>
                    <th className="text-center px-3 py-2 font-medium">{L("Fuktighet", "Humidity")}</th>
                    <th className="text-center px-3 py-2 font-medium">{L("Spor", "Track")}</th>
                    <th className="text-center px-3 py-2 font-medium">{L("Rang", "Rank")}</th>
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
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, navigate] = useLocation();
  const [productIds, setProductIds] = useState<number[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  const stats = useMemo(() => {
    if (productIds.length < 2) return null;

    // Find entries where ALL selected products appear on the same ski (same entry)
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
      if (productIds.every((pid) => ids.includes(pid))) {
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
      .map(({ entry, test }) => ({ entry, test, rank: getRank(entry) }));

    return { count: combined.length, avgRank, wins, winRate, conditionStats, best, recentTests };
  }, [productIds, allEntries, testsById, weatherById]);

  function AddProductPicker() {
    return (
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <span className="text-sm">+ Add product</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(380px,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("analytics.searchProducts")} />
            <CommandList>
              <CommandEmpty>{L("Ingen treff.", "No matches.")}</CommandEmpty>
              <CommandGroup>
                {products.filter((p) => !productIds.includes(p.id)).map((p) => (
                  <CommandItem key={p.id} value={`${p.brand} ${p.name}`} onSelect={() => {
                    setProductIds([...productIds, p.id]);
                    setAddOpen(false);
                  }}>
                    <span className="truncate">{p.brand} {p.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{p.category}</span>
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
        <h2 className="text-base font-semibold">{L("Kombinasjonssøk", "Combination search")}</h2>
        <span className="text-xs text-muted-foreground">— find tests where all selected products were used together on the same ski</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {productIds.map((pid) => {
          const p = productsById.get(pid);
          return (
            <span key={pid} className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 px-3 py-1 text-sm font-medium text-violet-800 dark:text-violet-200">
              {p ? `${p.brand} ${p.name}` : `#${pid}`}
              <button
                onClick={() => setProductIds(productIds.filter((id) => id !== pid))}
                className="ml-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800 p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <AddProductPicker />
        {productIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setProductIds([])}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {productIds.length >= 2 && !stats && (
        <p className="text-sm text-muted-foreground">
          No tests found where all selected products were used together on the same ski.
        </p>
      )}
      {productIds.length < 2 && (
        <p className="text-sm text-muted-foreground">
          Select at least 2 products to search for tests where they were used together.
        </p>
      )}

      {stats && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border p-3 text-center">
              <Hash className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-2xl font-bold">{stats.count}</div>
              <div className="text-xs text-muted-foreground">{L("Ski-opptredener", "Ski appearances")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Trophy className="h-4 w-4 mx-auto text-amber-500 mb-1" />
              <div className="text-2xl font-bold">{stats.wins}</div>
              <div className="text-xs text-muted-foreground">Wins (#1)</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Award className="h-4 w-4 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold">{stats.avgRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{L("Snittrang", "Avg rank")}</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">{L("Seiersrate", "Win rate")}</div>
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
                      <th className="text-left px-3 py-2 text-xs font-medium">{L("Snøtemp-område", "Snow temp range")}</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">{L("Tester", "Tests")}</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">{L("Snittrang", "Avg rank")}</th>
                      <th className="text-center px-3 py-2 text-xs font-medium">{L("Seire", "Wins")}</th>
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
            <div className="text-sm font-medium mb-2">Tests ({stats.recentTests.length})</div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="text-left px-3 py-2 text-xs font-medium">{L("Dato", "Date")}</th>
                    <th className="text-left px-3 py-2 text-xs font-medium">{L("Sted", "Location")}</th>
                    <th className="text-center px-3 py-2 text-xs font-medium">Ski #</th>
                    <th className="text-center px-3 py-2 text-xs font-medium">{L("Rang", "Rank")}</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentTests.map(({ entry, test, rank }, i) => {
                    const isExpanded = expandedTestId === entry.id;
                    const w = test.weatherId ? weatherById.get(test.weatherId) ?? null : null;
                    const methodologyParts = entry.methodology ? entry.methodology.split("|").map((s) => s.trim()) : [];
                    return (
                      <React.Fragment key={`${test.id}-${entry.id}-${i}`}>
                        <tr
                          className="border-t hover:bg-muted/30 cursor-pointer select-none"
                          onClick={() => setExpandedTestId(isExpanded ? null : entry.id)}
                        >
                          <td className="px-2 py-2 text-center text-muted-foreground">
                            {isExpanded
                              ? <ChevronDown className="h-3.5 w-3.5 inline-block" />
                              : <ChevronRight className="h-3.5 w-3.5 inline-block" />}
                          </td>
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
                          <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              title={L("Åpne test", "Open test")}
                              onClick={() => navigate(`/tests/${test.id}`)}
                              className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="border-t bg-muted/20">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                {/* Application / methodology */}
                                <div className="space-y-1.5">
                                  <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">{L("Metodikk", "Methodology")}</div>
                                  {productIds.map((pid, idx) => {
                                    const p = productsById.get(pid);
                                    const appStr = methodologyParts[idx] ?? null;
                                    if (!p) return null;
                                    return (
                                      <div key={pid} className="flex items-start gap-1.5">
                                        <span className="font-medium shrink-0">{p.brand} {p.name}:</span>
                                        <span className="text-muted-foreground">{appStr ? parseApplication(appStr).label || appStr : "—"}</span>
                                      </div>
                                    );
                                  })}
                                  {entry.feelingRank != null && (
                                    <div className="flex items-center gap-1.5 pt-0.5">
                                      <span className="text-muted-foreground">{L("Følelsesrang:", "Feeling rank:")}</span>
                                      <span className="font-medium">{entry.feelingRank}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Weather */}
                                {w && (
                                  <div className="space-y-1.5">
                                    <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">{L("Forhold", "Conditions")}</div>
                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                      <div className="flex items-center gap-1">
                                        <Snowflake className="h-3 w-3 text-blue-400 shrink-0" />
                                        <span className="text-muted-foreground">{L("Snø:", "Snow:")}</span>
                                        <span className="font-medium ml-1">{w.snowTemperatureC}°C</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Thermometer className="h-3 w-3 text-orange-400 shrink-0" />
                                        <span className="text-muted-foreground">{L("Luft:", "Air:")}</span>
                                        <span className="font-medium ml-1">{w.airTemperatureC}°C</span>
                                      </div>
                                      {w.snowHumidityPct != null && (
                                        <div className="flex items-center gap-1">
                                          <Droplets className="h-3 w-3 text-cyan-400 shrink-0" />
                                          <span className="text-muted-foreground">{L("Fuktighet:", "Humidity:")}</span>
                                          <span className="font-medium ml-1">{w.snowHumidityPct}%</span>
                                        </div>
                                      )}
                                      {w.snowType && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">{L("Snøtype:", "Snow type:")}</span>
                                          <span className="font-medium ml-1">{w.snowType}</span>
                                        </div>
                                      )}
                                      {w.trackHardness && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">{L("Spor:", "Track:")}</span>
                                          <span className="font-medium ml-1">{w.trackHardness}</span>
                                        </div>
                                      )}
                                      {w.snowHumidityType && (
                                        <div className="flex items-center gap-1">
                                          <span className="text-muted-foreground">{L("Type:", "Type:")}</span>
                                          <span className="font-medium ml-1">{w.snowHumidityType}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
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
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
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
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/20">
          <Target className="h-4 w-4 text-indigo-600" />
        </div>
        <h2 className="text-base font-semibold">{L("Head-to-head-matrise", "Head-to-head matrix")}</h2>
        <span className="text-xs text-muted-foreground">{L("Seier-% når begge produkter testes sammen", "Win % when both products tested together")}</span>
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

export function ProductCompare({
  products,
  allEntries,
  productsById,
  testsById,
  filteredTestIds,
  weatherById = new Map(),
}: {
  products: Product[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
  filteredTestIds: Set<number>;
  weatherById?: Map<number, Weather>;
}) {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  type CurveParam = "snowTemp" | "airTemp" | "snowHumidity" | "airHumidity" | "snowType" | "trackHardness" | "snowHumidityType";
  const [curveParam, setCurveParam] = useState<CurveParam>("snowTemp");

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

  // Performance Curve: avg rank per bucket for a chosen parameter
  const CURVE_PARAM_2C = Array.from({ length: 21 }, (_, i) => {
    const min = -30 + i * 3;
    const max = min + 3;
    const fmt = (v: number) => v <= 0 ? `${v}` : `+${v}`;
    return { min, max, label: `${fmt(min)}/${fmt(max)}°` };
  });
  const HUMIDITY_10PCT = Array.from({ length: 11 }, (_, i) => ({
    min: i * 10, max: (i + 1) * 10, label: `${i * 10}–${(i + 1) * 10}%`,
  }));

  const getBucketLabel = (w: Weather, param: typeof curveParam): string | null => {
    if (param === "snowTemp") {
      const b = SNOW_TEMP_2C.find((b) => w.snowTemperatureC >= b.min && w.snowTemperatureC < b.max);
      return b?.label ?? null;
    }
    if (param === "airTemp") {
      const b = CURVE_PARAM_2C.find((b) => w.airTemperatureC >= b.min && w.airTemperatureC < b.max);
      return b?.label ?? null;
    }
    if (param === "snowHumidity") {
      if (w.snowHumidityPct == null) return null;
      const b = HUMIDITY_10PCT.find((b) => (w.snowHumidityPct as number) >= b.min && (w.snowHumidityPct as number) < b.max);
      return b?.label ?? null;
    }
    if (param === "airHumidity") {
      if (w.airHumidityPct == null) return null;
      const b = HUMIDITY_10PCT.find((b) => (w.airHumidityPct as number) >= b.min && (w.airHumidityPct as number) < b.max);
      return b?.label ?? null;
    }
    if (param === "snowType") return w.snowType ?? null;
    if (param === "trackHardness") return w.trackHardness ?? null;
    if (param === "snowHumidityType") return w.snowHumidityType ?? null;
    return null;
  };

  const ORDERED_BUCKETS = {
    snowTemp: SNOW_TEMP_2C.map((b) => b.label),
    airTemp: CURVE_PARAM_2C.map((b) => b.label),
    snowHumidity: HUMIDITY_10PCT.map((b) => b.label),
    airHumidity: HUMIDITY_10PCT.map((b) => b.label),
    snowType: null,
    trackHardness: null,
    snowHumidityType: null,
  } as Record<string, string[] | null>;

  const { tempCurveData, sweetSpots } = useMemo(() => {
    if (!compareStats) return { tempCurveData: [], sweetSpots: new Map<number, string>() };

    // Build bucket → ranks map for each product
    const productBuckets = new Map<number, Map<string, number[]>>();
    for (const s of compareStats) {
      const bucketMap = new Map<string, number[]>();
      for (const [testId, rank] of s.testRanks) {
        if (rank === null) continue;
        const test = testsById.get(testId);
        if (!test?.weatherId) continue;
        const w = weatherById.get(test.weatherId);
        if (w == null) continue;
        const label = getBucketLabel(w, curveParam);
        if (!label) continue;
        if (!bucketMap.has(label)) bucketMap.set(label, []);
        bucketMap.get(label)!.push(rank);
      }
      productBuckets.set(s.product.id, bucketMap);
    }

    // Determine bucket order
    const orderedKeys = ORDERED_BUCKETS[curveParam];
    const allBuckets = orderedKeys
      ? orderedKeys.filter((lbl) => compareStats.some((s) => productBuckets.get(s.product.id)?.has(lbl)))
      : Array.from(new Set(compareStats.flatMap((s) => Array.from(productBuckets.get(s.product.id)?.keys() ?? []))));

    // Build chart rows
    const rows = allBuckets
      .map((lbl) => {
        const row: Record<string, any> = { bucket: lbl };
        let hasData = false;
        for (const s of compareStats) {
          const ranks = productBuckets.get(s.product.id)?.get(lbl);
          if (ranks && ranks.length > 0) {
            row[`p_${s.product.id}`] = parseFloat((ranks.reduce((a, v) => a + v, 0) / ranks.length).toFixed(2));
            row[`p_${s.product.id}_n`] = ranks.length;
            hasData = true;
          } else {
            row[`p_${s.product.id}`] = null;
          }
        }
        return hasData ? row : null;
      })
      .filter((r): r is Record<string, any> => r !== null);

    // Sweet spot: bucket with lowest avg rank per product
    const sweetSpots = new Map<number, string>();
    for (const s of compareStats) {
      let bestLabel = "—";
      let bestAvg = Infinity;
      for (const [label, ranks] of productBuckets.get(s.product.id)?.entries() ?? []) {
        const avg = ranks.reduce((a, v) => a + v, 0) / ranks.length;
        if (avg < bestAvg) { bestAvg = avg; bestLabel = `${label} (avg #${avg.toFixed(1)})`; }
      }
      sweetSpots.set(s.product.id, bestLabel);
    }

    return { tempCurveData: rows, sweetSpots };
  }, [compareStats, testsById, weatherById, curveParam]);

  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-product-compare">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
          <BarChart3 className="h-4 w-4 text-violet-600" />
        </div>
        <h2 className="text-base font-semibold">{L("Sammenlign produkter", "Compare products")}</h2>
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
                <CommandEmpty>{L("Ingen treff.", "No matches.")}</CommandEmpty>
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
                  <th className="text-left px-3 py-2 font-medium">{L("Produkt", "Product")}</th>
                  <th className="text-center px-3 py-2 font-medium">{L("Tester", "Tests")}</th>
                  <th className="text-center px-3 py-2 font-medium">{L("Seire", "Wins")}</th>
                  <th className="text-center px-3 py-2 font-medium">{L("Snittrang", "Avg rank")}</th>
                  <th className="text-left px-3 py-2 font-medium">{L("Seiersrate", "Win rate")}</th>
                  <th className="text-left px-3 py-2 font-medium">{L("Sweet spot", "Sweet spot")}</th>
                </tr>
              </thead>
              <tbody>
                {compareStats.map((s, i) => {
                  const best = compareStats.every((o) => o === s || (s.avgRank !== null && (o.avgRank === null || s.avgRank <= o.avgRank)));
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <tr key={s.product.id} className={cn("border-t", best && "bg-amber-50/50 dark:bg-amber-900/10")} data-testid={`row-compare-${s.product.id}`}>
                      <td className="px-3 py-2 font-medium">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          {s.product.brand} {s.product.name}
                        </span>
                      </td>
                      <td className="text-center px-3 py-2">{s.totalTests}</td>
                      <td className="text-center px-3 py-2">{s.totalWins}</td>
                      <td className="text-center px-3 py-2 font-semibold">{s.avgRank ?? "—"}</td>
                      <td className="px-3 py-2 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${s.winRate}%`, backgroundColor: color }} />
                          </div>
                          <span className="text-xs font-medium tabular-nums">{s.winRate}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{sweetSpots.get(s.product.id) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {chartData.length > 1 && (
            <div>
              <div className="text-sm font-medium mb-2">{L("Snittrang over tid", "Average rank over time")}</div>
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

          {(tempCurveData.length >= 2 || compareStats != null) && (
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-medium">{L("Ytelseskurve", "Performance Curve")}</span>
                <Select value={curveParam} onValueChange={(v) => setCurveParam(v as typeof curveParam)}>
                  <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snowTemp">{t("weather.snowTemp")}</SelectItem>
                    <SelectItem value="airTemp">{t("weather.airTemp")}</SelectItem>
                    <SelectItem value="snowHumidity">{t("weather.snowHumidity")}</SelectItem>
                    <SelectItem value="airHumidity">{t("weather.airHumidity")}</SelectItem>
                    <SelectItem value="snowType">{t("weather.snowType")}</SelectItem>
                    <SelectItem value="trackHardness">{t("weather.trackHardness")}</SelectItem>
                    <SelectItem value="snowHumidityType">{t("weather.snowHumidityType")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {tempCurveData.length < 2 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">{L("Ikke nok data for valgt parameter.", "Not enough data for the selected parameter.")}</p>
              ) : (<>
              <p className="text-xs text-muted-foreground mb-3">Lower rank = better performance. Only buckets with test data shown.</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={tempCurveData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="bucket" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={48} />
                  <YAxis
                    reversed
                    allowDecimals={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    label={{ value: "Avg Rank", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                    formatter={(value: any, name: string) => {
                      const id = parseInt(name.replace("p_", ""), 10);
                      const prod = productsById.get(id);
                      return [value != null ? `#${value}` : "—", prod ? `${prod.brand} ${prod.name}` : name];
                    }}
                  />
                  <Legend
                    formatter={(value) => {
                      const id = parseInt(value.replace("p_", ""), 10);
                      const prod = productsById.get(id);
                      return prod ? `${prod.brand} ${prod.name}` : value;
                    }}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  {compareStats.map((s, i) => (
                    <Line
                      key={s.product.id}
                      type="monotone"
                      dataKey={`p_${s.product.id}`}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2.5}
                      dot={{ r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              </>)}
            </div>
          )}

          {headToHead.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium">Head-to-head ({headToHead.length} shared tests)</span>
                <div className="flex flex-wrap gap-2">
                  {compareStats.map((s, i) => {
                    const wins = headToHead.filter(({ ranks }) => {
                      const myRank = ranks.find((r) => r.product.id === s.product.id)?.rank;
                      return myRank != null && ranks.every((r) => r.product.id === s.product.id || r.rank == null || myRank <= r.rank);
                    }).length;
                    return (
                      <span key={s.product.id} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-border/40"
                        style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {s.product.name}: {wins}W / {headToHead.length - wins}L
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border" data-testid="table-head-to-head">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">{L("Dato", "Date")}</th>
                      <th className="text-left px-3 py-2 font-medium">{L("Sted", "Location")}</th>
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
  usages: { prep: any; role: "glide" | "structure" | "kick"; weather: Weather | null; application: string }[];
};

type RacedCombination = {
  key: string;
  products: { product: Product; application: string }[]; // representative apps from first usage
  count: number;
  usages: { prep: any; weather: Weather | null; products: { product: Product; application: string }[] }[];
};

// Parse a productApps JSON string into a Map<productId, application>.
function parseAppsMap(appsJson: string | null | undefined): Map<number, string> {
  const m = new Map<number, string>();
  if (appsJson) {
    try {
      const arr = JSON.parse(appsJson);
      if (Array.isArray(arr)) for (const x of arr) if (x && typeof x.productId === "number") m.set(x.productId, x.application || "");
    } catch {}
  }
  return m;
}

// ─── Durability Analysis ─────────────────────────────────────────────────────
const DURABILITY_CHART_COLORS = ["#10b981","#3b82f6","#f59e0b","#ef4444","#8b5cf6","#f97316"];

function DurabilityAnalysis({
  products,
  tests,
  allEntries,
  productsById,
  testsById,
}: {
  products: Product[];
  tests: Test[];
  allEntries: TestEntry[];
  productsById: Map<number, Product>;
  testsById: Map<number, Test>;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [minTests, setMinTests] = React.useState(2);
  const [sortBy, setSortBy] = React.useState<"name" | "trend" | "count">("trend");
  const [search, setSearch] = React.useState("");
  const [compareMode, setCompareMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);

  // Build distance labels for each test
  function getLabels(test: Test): string[] {
    if (test.distanceLabels) {
      try {
        const p = JSON.parse(test.distanceLabels);
        if (Array.isArray(p) && p.length > 0) return p;
      } catch {}
    }
    const ls = [test.distanceLabel0km || "0 km"];
    if (test.distanceLabelXkm) ls.push(test.distanceLabelXkm);
    return ls;
  }

  // Get ranks per round from an entry
  function getRounds(entry: TestEntry, n: number): (number | null)[] {
    if (entry.results) {
      try {
        const p = JSON.parse(entry.results);
        if (Array.isArray(p)) {
          return Array.from({ length: n }, (_, i) => p[i]?.rank ?? null);
        }
      } catch {}
    }
    const res: (number | null)[] = [entry.rank0km ?? null];
    while (res.length < n) res.push(null);
    return res;
  }

  // For each product, aggregate rank at each round position
  const productStats = useMemo(() => {
    // Only use multi-round tests
    const multiRoundTests = tests.filter((t) => {
      const labels = getLabels(t);
      return labels.length > 1;
    });

    // Map: productId → round index → list of ranks
    const ranksByProduct = new Map<number, Map<number, number[]>>();
    const labelsByRound = new Map<number, Map<string, number>>(); // round index → label → count

    for (const test of multiRoundTests) {
      const labels = getLabels(test);
      const n = labels.length;

      // Collect label names per round
      labels.forEach((lbl, i) => {
        if (!labelsByRound.has(i)) labelsByRound.set(i, new Map());
        const m = labelsByRound.get(i)!;
        m.set(lbl, (m.get(lbl) ?? 0) + 1);
      });

      const entries = allEntries.filter((e) => e.testId === test.id);
      for (const entry of entries) {
        if (!entry.productId) continue;
        const rounds = getRounds(entry, n);

        if (!ranksByProduct.has(entry.productId)) ranksByProduct.set(entry.productId, new Map());
        const productRounds = ranksByProduct.get(entry.productId)!;

        rounds.forEach((rank, i) => {
          if (rank == null) return;
          if (!productRounds.has(i)) productRounds.set(i, []);
          productRounds.get(i)!.push(rank);
        });
      }
    }

    // Number of rounds
    const maxRound = Math.max(0, ...Array.from(labelsByRound.keys()));
    const numRounds = maxRound + 1;

    // Most common label per round
    const roundLabels = Array.from({ length: numRounds }, (_, i) => {
      const m = labelsByRound.get(i);
      if (!m || m.size === 0) return `Round ${i + 1}`;
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    });

    // Build result per product
    const results: {
      productId: number;
      name: string;
      roundAvgRanks: (number | null)[];
      count: number;
      trend: number | null; // last avg - first avg (positive = degrades, negative = improves)
    }[] = [];

    for (const [productId, productRounds] of ranksByProduct.entries()) {
      const product = productsById.get(productId);
      if (!product) continue;

      const roundAvgRanks = Array.from({ length: numRounds }, (_, i) => {
        const ranks = productRounds.get(i) ?? [];
        if (ranks.length === 0) return null;
        return ranks.reduce((a, b) => a + b, 0) / ranks.length;
      });

      const firstRound = roundAvgRanks[0];
      const lastRound = roundAvgRanks[numRounds - 1];
      const trend = firstRound != null && lastRound != null ? lastRound - firstRound : null;

      // Count = number of multi-round test entries for this product
      const count = productRounds.get(0)?.length ?? 0;

      results.push({
        productId,
        name: `${product.brand} ${product.name}`,
        roundAvgRanks,
        count,
        trend,
      });
    }

    return { results, roundLabels, numRounds };
  }, [tests, allEntries, productsById]);

  const multiRoundCount = useMemo(
    () => tests.filter((t) => { const ls = getLabels(t); return ls.length > 1; }).length,
    [tests]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productStats.results
      .filter((r) => r.count >= minTests)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "count") return b.count - a.count;
        // Sort by trend: most improved first (negative trend = better), then unknown
        if (a.trend == null && b.trend == null) return 0;
        if (a.trend == null) return 1;
        if (b.trend == null) return -1;
        return a.trend - b.trend;
      });
  }, [productStats, minTests, sortBy, search]);

  // Toggle a product in/out of comparison selection (max 6)
  function toggleSelect(productId: number) {
    setSelectedIds((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 6) return prev;
      return [...prev, productId];
    });
  }

  // Chart data: one data point per round label
  const chartData = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const { roundLabels, numRounds } = productStats;
    return Array.from({ length: numRounds }, (_, i) => {
      const point: Record<string, string | number | null> = { label: roundLabels[i] };
      for (const id of selectedIds) {
        const row = productStats.results.find((r) => r.productId === id);
        point[String(id)] = row?.roundAvgRanks[i] ?? null;
      }
      return point;
    });
  }, [selectedIds, productStats]);

  const maxRankInChart = useMemo(() => {
    let max = 1;
    for (const id of selectedIds) {
      const row = productStats.results.find((r) => r.productId === id);
      if (row) {
        for (const v of row.roundAvgRanks) {
          if (v != null && v > max) max = v;
        }
      }
    }
    return max;
  }, [selectedIds, productStats]);

  if (multiRoundCount === 0) {
    return (
      <Card className="fs-card rounded-2xl p-6 text-center text-muted-foreground">
        <p className="text-sm">{L("Ingen flerrundetester funnet.", "No multi-round tests found.")}</p>
        <p className="text-xs mt-1">Create tests with multiple distance rounds (e.g. 0 km + 30 km) to see durability analysis.</p>
      </Card>
    );
  }

  const { roundLabels, numRounds } = productStats;

  return (
    <div className="space-y-4">
      {/* ── Top controls bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={L("Søk produkter…", "Search products…")}
            className="w-full rounded-md border border-border bg-background pl-8 pr-8 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Min appearances */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{L("Min:", "Min:")}</span>
          <select
            value={minTests}
            onChange={(e) => setMinTests(Number(e.target.value))}
            className="rounded border border-border bg-background px-1.5 py-1 text-xs"
          >
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{L("Sortér:", "Sort:")}</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded border border-border bg-background px-1.5 py-1 text-xs"
          >
            <option value="trend">{L("Best holdbarhet", "Best durability")}</option>
            <option value="count">{L("Flest tester", "Most tests")}</option>
            <option value="name">{L("Navn A–Å", "Name A–Z")}</option>
          </select>
        </div>

        {/* Compare toggle */}
        <Button
          variant={compareMode ? "default" : "outline"}
          size="sm"
          className="ml-auto h-7 px-3 text-xs gap-1.5"
          onClick={() => {
            setCompareMode((v) => !v);
            if (compareMode) setSelectedIds([]);
          }}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Compare
          {compareMode && selectedIds.length > 0 && (
            <span className="ml-1 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {selectedIds.length}
            </span>
          )}
        </Button>
      </div>

      {/* ── Chart panel (compare mode, ≥1 selected) ── */}
      {compareMode && selectedIds.length >= 1 && (
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{L("Rang over distanse", "Rank over distance")}</h3>
            <span className="text-xs text-muted-foreground">Lower rank = better performance</span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis
                reversed
                domain={[0, maxRankInChart + 0.5]}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  const row = productStats.results.find((r) => String(r.productId) === name);
                  return [value != null ? value.toFixed(2) : "—", row?.name ?? name];
                }}
                labelFormatter={(label) => `Distance: ${label}`}
              />
              <Legend
                formatter={(value: string) => {
                  const row = productStats.results.find((r) => String(r.productId) === value);
                  return row?.name ?? value;
                }}
              />
              {selectedIds.map((id, idx) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={String(id)}
                  stroke={DURABILITY_CHART_COLORS[idx % DURABILITY_CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Table card ── */}
      <Card className="fs-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Durability — Performance over distance</h2>
            <p className="text-xs text-muted-foreground">
              Average rank at each distance across {multiRoundCount} multi-round {multiRoundCount === 1 ? "test" : "tests"}.
              Trend = rank change from start to finish (negative = improves, positive = degrades).
            </p>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {search
              ? `No products matching "${search}" with ${minTests}+ appearances.`
              : `No products with ${minTests}+ multi-round appearances. Try lowering the minimum.`}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {compareMode && <th className="w-8 px-2 py-2" />}
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-48">{L("Produkt", "Product")}</th>
                  {roundLabels.map((lbl, i) => (
                    <th key={i} className="text-center px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                      {lbl}
                    </th>
                  ))}
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">{L("Trend", "Trend")}</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground">{L("Tester", "Tests")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isSelected = selectedIds.includes(row.productId);
                  const selectedIdx = selectedIds.indexOf(row.productId);
                  const accentColor = isSelected ? DURABILITY_CHART_COLORS[selectedIdx % DURABILITY_CHART_COLORS.length] : undefined;

                  const trendBadge = (() => {
                    if (row.trend == null) return <span className="text-muted-foreground">—</span>;
                    if (row.trend < -0.3) return (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
                        title={L("Forbedres over distanse", "Improves over distance")}>
                        ▼ {Math.abs(row.trend).toFixed(2)}
                      </span>
                    );
                    if (row.trend < 0.3) return (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                        title={L("Stabil", "Stable")}>
                        → {row.trend.toFixed(2)}
                      </span>
                    );
                    return (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600"
                        title={L("Forringes over distanse", "Degrades over distance")}>
                        ▲ +{row.trend.toFixed(2)}
                      </span>
                    );
                  })();

                  return (
                    <tr
                      key={row.productId}
                      className={cn(
                        "border-b border-border/50 transition-colors",
                        isSelected ? "bg-muted/40" : "hover:bg-muted/20",
                        compareMode && "cursor-pointer"
                      )}
                      style={isSelected && accentColor ? { borderLeft: `3px solid ${accentColor}` } : undefined}
                      onClick={compareMode ? () => toggleSelect(row.productId) : undefined}
                    >
                      {compareMode && (
                        <td className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            readOnly
                            checked={isSelected}
                            className="h-3.5 w-3.5 rounded border-border accent-primary"
                            onClick={(e) => { e.stopPropagation(); toggleSelect(row.productId); }}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 font-medium truncate max-w-[180px]" title={row.name}>
                        {isSelected && accentColor ? (
                          <span style={{ color: accentColor }}>{row.name}</span>
                        ) : row.name}
                      </td>
                      {row.roundAvgRanks.map((avg, i) => (
                        <td key={i} className="text-center px-3 py-2">
                          {avg != null ? (
                            <span className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                              avg <= 1.5 ? "bg-emerald-50 text-emerald-700" :
                              avg <= 2.5 ? "bg-green-50 text-green-600" :
                              avg <= 3.5 ? "bg-amber-50 text-amber-600" :
                              "bg-red-50 text-red-500"
                            )}>
                              {avg.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center px-3 py-2">
                        {trendBadge}
                      </td>
                      <td className="text-center px-3 py-2 text-muted-foreground text-xs">
                        {row.count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-3">
          <span className="font-medium">{L("Trend:", "Trend:")}</span>
          <span className="text-emerald-700 font-medium">▼ Negative = improves</span>
          <span>→ ≈ 0 = stable</span>
          <span className="text-red-500 font-medium">▲ Positive = degrades</span>
          {compareMode && (
            <span className="ml-auto text-muted-foreground">Select up to 6 products to compare</span>
          )}
        </div>
      </Card>
    </div>
  );
}

// Renders every available weather/conditions field for a race usage.
function WeatherFields({ w, L }: { w: Weather; L: (no: string, en: string) => string }) {
  const cell = (label: string, value: any) =>
    value != null && value !== "" ? (
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    ) : null;
  return (
    <>
      {cell(L("Snøtemp", "Snow temp"), w.snowTemperatureC != null ? `${w.snowTemperatureC}°C` : null)}
      {cell(L("Lufttemp", "Air temp"), w.airTemperatureC != null ? `${w.airTemperatureC}°C` : null)}
      {cell(L("Snøfukt", "Snow humidity"), w.snowHumidityPct != null ? `${w.snowHumidityPct}%` : null)}
      {cell(L("Luftfukt", "Air humidity"), w.airHumidityPct != null ? `${w.airHumidityPct}%` : null)}
      {cell(L("Snøtype", "Snow type"), w.snowType)}
      {cell(L("Snøfukttype", "Snow humidity type"), w.snowHumidityType)}
      {cell(L("Kornstørrelse", "Grain size"), w.grainSize)}
      {cell(L("Sporhardhet", "Track hardness"), w.trackHardness)}
      {cell(L("Vind", "Wind"), w.wind)}
      {cell(L("Skydekke", "Clouds"), w.clouds != null ? `${w.clouds}/8` : null)}
      {cell(L("Nedbør", "Precipitation"), w.precipitation)}
      {cell(L("Sikt", "Visibility"), w.visibility)}
      {cell(L("Kunstig snø", "Artificial snow"), w.artificialSnow)}
      {cell(L("Naturlig snø", "Natural snow"), w.naturalSnow)}
      {cell(L("Testkvalitet", "Test quality"), w.testQuality != null ? `${w.testQuality}/10` : null)}
    </>
  );
}

// ── Brand statistics ─────────────────────────────────────────────────────────
type BrandStat = {
  brand: string; productCount: number; structureToolCount: number; raceSkiCount: number; seriesCount: number;
  raceTestEntries: number; productTestEntries: number;
  avgRank: number | null; avgFeeling: number | null; avgProductRank: number | null;
  products: { name: string; category: string; tests: number; avgRank: number | null }[];
  paramBreakdown: { category: string; values: { value: string; count: number; avgRank: number | null; avgFeeling: number | null }[] }[];
  conditions: { label: string; count: number; avgRank: number | null; avgFeeling: number | null }[];
};

// Generate a short written insight per brand from what the waxers have entered
// (best-performing grind/base/structure, conditions, product, overall trend).
// Deterministic — reads the same aggregated numbers shown in the breakdown.
function buildBrandNote(b: BrandStat, lang: string): string {
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  const num = (n: number | null) => (n == null ? "—" : n.toFixed(1));
  const parts: string[] = [];

  // Best value in a parameter category (lowest avg rank, needs ≥2 results).
  const bestIn = (category: string) => {
    const cat = b.paramBreakdown.find((p) => p.category.toLowerCase() === category.toLowerCase());
    if (!cat) return null;
    const ranked = cat.values.filter((v) => v.avgRank != null && v.count >= 2);
    return ranked.length ? ranked[0] : null;
  };

  const grind = bestIn("Grind");
  const base = bestIn("Base");
  if (grind || base) {
    const bits: string[] = [];
    if (grind) bits.push(L(`slip ${grind.value} (snittrang ${num(grind.avgRank)}, ${grind.count} tester)`, `grind ${grind.value} (avg rank ${num(grind.avgRank)}, ${grind.count} tests)`));
    if (base) bits.push(L(`base ${base.value}`, `base ${base.value}`));
    parts.push(L(`${b.brand} presterer best med ${bits.join(" og ")}.`, `${b.brand} performs best with ${bits.join(" and ")}.`));
  }

  // Strongest conditions bucket.
  const cond = [...b.conditions].filter((c) => c.avgRank != null && c.count >= 2).sort((x, y) => (x.avgRank! - y.avgRank!))[0];
  if (cond) parts.push(L(`Sterkest i ${cond.label} (snittrang ${num(cond.avgRank)}).`, `Strongest in ${cond.label} (avg rank ${num(cond.avgRank)}).`));

  // Best product (if any product test data).
  const prod = b.products.filter((p) => p.avgRank != null && p.tests >= 2)[0];
  if (prod) parts.push(L(`Beste produkt: ${prod.name} (snittrang ${num(prod.avgRank)}).`, `Best product: ${prod.name} (avg rank ${num(prod.avgRank)}).`));

  // Overall trend.
  if (b.avgRank != null && b.raceTestEntries > 0) {
    parts.push(L(
      `Totalt snittrang ${num(b.avgRank)}${b.avgFeeling != null ? ` og følelse ${num(b.avgFeeling)}` : ""} på tvers av merkets ski.`,
      `Overall avg rank ${num(b.avgRank)}${b.avgFeeling != null ? ` and feeling ${num(b.avgFeeling)}` : ""} across the brand's skis.`,
    ));
  }

  return parts.join(" ");
}

// ── Kick report (#9): the interpreted kick-test reports + recipes, in Analytics.
type KickRptSki = { id: number; name: string | null; brand: string | null; color: string | null };
type KickRptEntry = { id?: number; kickSkiId: number; binder: string | null; kickSolution: string | null; feelingRank: number | null; feelingNotes: string | null };
type KickRptTest = { id: number; date: string; location: string | null; weatherId: number | null; testPersons: string | null; notes: string | null; report: string | null; entries: KickRptEntry[] };
type KickRptWeather = { id: number; location: string; airTemperatureC: number | null; snowType: string | null; snowHumidityType: string | null };
type KickUse = { solution: string; binder: string | null; date: string; location: string | null; airTemp: number | null; snowType: string | null; feelingRank: number | null; feelingNotes: string | null; skiId: number };

const KICK_POS = ["bra", "godt", "god", "perfekt", "stabil", "good", "great", "grip", "feste", "solid"];
const KICK_NEG = ["dårlig", "darlig", "glipper", "glir", "slips", "icing", "ising", "bom", "poor", "bad", "no grip"];

// Written summary of one kick solution across its uses, tied to weather/snow.
function buildKickSolutionSummary(uses: KickUse[], lang: string): string {
  const L = (no: string, en: string) => (lang === "no" ? no : en);
  const temps = uses.map((u) => u.airTemp).filter((t): t is number => typeof t === "number");
  const ranks = uses.map((u) => u.feelingRank).filter((r): r is number => typeof r === "number");
  const parts: string[] = [];

  parts.push(L(`Brukt ${uses.length} gang${uses.length === 1 ? "" : "er"}`, `Used ${uses.length} time${uses.length === 1 ? "" : "s"}`)
    + (ranks.length ? L(`, snitt feeling ${(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)}.`, `, avg feeling ${(ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)}.`) : "."));

  if (temps.length) {
    const lo = Math.min(...temps), hi = Math.max(...temps);
    const range = lo === hi ? `${lo.toFixed(0)}°C` : `${lo.toFixed(0)}–${hi.toFixed(0)}°C`;
    const snowFreq = new Map<string, number>();
    for (const u of uses) { const s = (u.snowType || "").trim(); if (s) snowFreq.set(s, (snowFreq.get(s) ?? 0) + 1); }
    const topSnow = [...snowFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    parts.push(L(`Føre: lufttemp ${range}${topSnow ? `, oftest ${topSnow.toLowerCase()}` : ""}.`, `Conditions: air temp ${range}${topSnow ? `, mostly ${topSnow.toLowerCase()}` : ""}.`));
  }

  // Which conditions it performed best in (lowest feeling rank).
  const rated = uses.filter((u) => u.feelingRank != null && u.airTemp != null);
  if (rated.length >= 2) {
    const best = [...rated].sort((a, b) => a.feelingRank! - b.feelingRank!)[0];
    const band = best.airTemp! <= -8 ? L("kaldt føre", "cold conditions") : best.airTemp! >= -2 ? L("mildt føre", "mild conditions") : L("variert føre", "varied conditions");
    parts.push(L(`Best i ${band} (${best.airTemp!.toFixed(0)}°C, feeling ${best.feelingRank}).`, `Best in ${band} (${best.airTemp!.toFixed(0)}°C, feeling ${best.feelingRank}).`));
  }

  const allText = uses.map((u) => (u.feelingNotes || "").toLowerCase()).join(" ");
  let pos = 0, neg = 0;
  for (const w of KICK_POS) if (allText.includes(w)) pos++;
  for (const w of KICK_NEG) if (allText.includes(w)) neg++;
  if (neg > pos && neg > 0) parts.push(L("Notatene peker på svakt feste ved flere anledninger.", "Notes point to weak grip on several occasions."));
  else if (pos > neg && pos > 0) parts.push(L("Overveiende godt feste i notatene.", "Mostly good grip in the notes."));

  return parts.join(" ");
}

function KickReportView() {
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
                                <td className="py-1.5 pr-3 whitespace-nowrap">{u.airTemp != null ? `${u.airTemp}°C` : "—"}{u.snowType ? ` · ${u.snowType}` : ""}</td>
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
              {w && <span className="inline-flex items-center gap-1 text-muted-foreground"><Cloud className="h-3.5 w-3.5" />{w.airTemperatureC != null ? `${w.airTemperatureC}°C` : w.location}</span>}
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

function BrandStatsView() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { data: brands = [], isLoading } = useQuery<BrandStat[]>({ queryKey: ["/api/analytics/brands"] });
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () => brands.filter((b) => !search.trim() || b.brand.toLowerCase().includes(search.trim().toLowerCase())),
    [brands, search],
  );
  const num = (n: number | null) => (n == null ? "—" : n.toFixed(1));

  if (isLoading) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>;
  if (brands.length === 0) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Ingen merker registrert ennå.", "No brands recorded yet.")}</Card>;

  const Breakdown = ({ title, rows }: { title: string; rows: BrandStat["paramBreakdown"][number]["values"] }) =>
    rows.length === 0 ? null : (
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
        <div className="space-y-0.5">
          {rows.map((r) => (
            <div key={r.value} className="flex items-center justify-between gap-2 text-xs rounded bg-muted/40 px-2 py-1">
              <span className="font-medium truncate">{r.value}</span>
              <span className="text-muted-foreground whitespace-nowrap">
                {L("snittrang", "avg rank")} {num(r.avgRank)} · {L("følelse", "feel")} {num(r.avgFeeling)} · {r.count}×
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-3" data-testid="brand-stats">
      <p className="text-sm text-muted-foreground">
        {L("Alle merker i Glidr (produkter, structure tools, skimerker). Klikk for å se hvordan hvert merkes parametre presterer mot resultat, følelse og føre.",
           "Every brand in Glidr (products, structure tools, ski brands). Click a brand to see how its parameters perform against result, feeling and conditions.")}
      </p>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L("Søk merke…", "Search brand…")} className="h-9 max-w-xs text-sm" />
      <div className="space-y-2">
        {filtered.map((b) => {
          const isOpen = open === b.brand;
          return (
            <Card key={b.brand} className="fs-card rounded-2xl overflow-hidden" data-testid={`brand-${b.brand}`}>
              <button type="button" onClick={() => setOpen(isOpen ? null : b.brand)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors">
                <div className="min-w-0">
                  <div className="font-semibold">{b.brand}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {b.raceSkiCount > 0 && <span>{b.raceSkiCount} {L("skipar", "skis")}</span>}
                    {b.productCount > 0 && <span>{b.productCount} {L("produkter", "products")}</span>}
                    {b.structureToolCount > 0 && <span>{b.structureToolCount} structure tools</span>}
                    {b.seriesCount > 0 && <span>{b.seriesCount} testfleets</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {b.avgRank != null && <span className="text-muted-foreground">{L("Snittrang", "Avg rank")} <span className="font-semibold text-foreground">{num(b.avgRank)}</span></span>}
                  {b.avgFeeling != null && <span className="text-muted-foreground">{L("Følelse", "Feel")} <span className="font-semibold text-foreground">{num(b.avgFeeling)}</span></span>}
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-border/40 px-4 py-3 space-y-4">
                  {/* Written insight generated from what the waxers have entered */}
                  {(() => { const note = buildBrandNote(b, language); return note ? (
                    <div className="rounded-lg bg-violet-50 dark:bg-violet-950/20 px-3 py-2 text-sm">
                      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300 mb-1">
                        <Sparkles className="h-3.5 w-3.5" />{L("Innsikt", "Insight")}
                      </div>
                      {note}
                    </div>
                  ) : null; })()}
                  {/* Every parameter the waxers have entered, ranked within its category */}
                  {b.paramBreakdown.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {b.paramBreakdown.map((p) => (
                        <Breakdown key={p.category} title={p.category} rows={p.values} />
                      ))}
                    </div>
                  )}
                  {/* Conditions */}
                  {b.conditions.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{L("Føre (lufttemp)", "Conditions (air temp)")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {b.conditions.map((c) => (
                          <span key={c.label} className="rounded-full bg-muted/50 px-2 py-0.5 text-[11px]">
                            {c.label}: {L("rang", "rank")} {num(c.avgRank)} · {L("føl.", "feel")} {num(c.avgFeeling)} ({c.count})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Products */}
                  {b.products.length > 0 && (
                    <div className="overflow-x-auto">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{L("Produkter", "Products")}</div>
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-muted-foreground border-b"><th className="py-1 pr-2">{L("Produkt", "Product")}</th><th className="py-1 pr-2">{L("Kategori", "Category")}</th><th className="py-1 pr-2">{L("Snittrang", "Avg rank")}</th><th className="py-1">{L("Tester", "Tests")}</th></tr></thead>
                        <tbody>
                          {b.products.map((p, i) => (
                            <tr key={i} className="border-b border-border/30"><td className="py-1 pr-2 font-medium">{p.name}</td><td className="py-1 pr-2 text-muted-foreground">{p.category}</td><td className="py-1 pr-2">{num(p.avgRank)}</td><td className="py-1">{p.tests}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {b.paramBreakdown.length === 0 && b.products.length === 0 && b.conditions.length === 0 && (
                    <p className="text-xs text-muted-foreground">{L("Ingen testresultater knyttet til dette merket ennå.", "No test results linked to this brand yet.")}</p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RacedSkisView() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [q, setQ] = useState("");
  const { data: usages = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/ski-race-usages"] });
  const rows = useMemo(() => {
    const norm = q.trim().toLowerCase();
    return usages
      .map((u: any) => {
        let mw: any = null; try { mw = u.manualWeather ? JSON.parse(u.manualWeather) : null; } catch {}
        return { ...u, snowT: u.snowTemperatureC ?? mw?.snowTemperatureC ?? null, airT: u.airTemperatureC ?? mw?.airTemperatureC ?? null, snowTypeV: u.snowType ?? mw?.snowType ?? null };
      })
      .filter((u: any) => !norm || [u.athleteName, u.location, u.skiId, u.brand, u.snowTypeV].some((x: any) => String(x ?? "").toLowerCase().includes(norm)));
  }, [usages, q]);
  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h2 className="text-base font-semibold">{L("Kjørte ski", "Raced Skis")}</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L("Søk utøver, sted, snøtype…", "Search athlete, location, snow type…")} className="mb-3 h-9 text-sm max-w-xs" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{L("Laster…", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L("Ingen løpsbruk logget ennå. Smørere logger dette på hvert skipar i garasjen.", "No race use logged yet. Waxers log this on each ski pair in the garage.")}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-sm" data-testid={`raced-ski-${u.id}`}>
              <span className="font-semibold">{u.brand ? `${u.brand} ` : ""}{u.skiId}</span>
              <span className="text-muted-foreground">{u.athleteName}</span>
              <span className="text-muted-foreground">· {u.location || "—"} {fmtDate(u.date)}</span>
              {u.discipline && <span className="rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">{u.discipline}</span>}
              <div className="ml-auto flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                {u.snowT != null && <span>{L("Snø", "Snow")} {u.snowT}°C</span>}
                {u.airT != null && <span>{L("Luft", "Air")} {u.airT}°C</span>}
                {u.snowTypeV && <span>{u.snowTypeV}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RacedProductsTab({
  racePreps,
  racedProductStats,
  racedCombinations,
  lang,
  roleFilter,
}: {
  racePreps: any[];
  racedProductStats: RacedProductStat[];
  racedCombinations: RacedCombination[];
  lang: string;
  roleFilter: string;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [expandedCombo, setExpandedCombo] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"products" | "combinations">("products");
  const [showFilters, setShowFilters] = useState(false);
  // Full conditions filter (same fields as the Tests page)
  const emptyCf = {
    airTempMin: "", airTempMax: "", snowTempMin: "", snowTempMax: "",
    airHumMin: "", airHumMax: "", snowHumMin: "", snowHumMax: "",
    cloudMin: "", cloudMax: "", snowType: "", trackHardness: "",
    snowHumidityType: "", grainSize: "", artificialSnow: "", naturalSnow: "",
    precipitation: "", wind: "", visibility: "",
  };
  const [cf, setCf] = useState({ ...emptyCf });
  const setCfField = (k: keyof typeof cf, v: string) => setCf(prev => ({ ...prev, [k]: v }));
  const L = (no: string, en: string) => lang === "en" ? en : no;

  const hasCondFilter = Object.values(cf).some(v => v !== "");
  const condCount = Object.values(cf).filter(v => v !== "").length;
  const weatherMatches = (w: Weather | null): boolean => {
    if (!hasCondFilter) return true;
    if (!w) return false;
    const range = (val: number | null | undefined, minS: string, maxS: string): boolean => {
      let lo = minS !== "" ? parseFloat(minS) : null;
      let hi = maxS !== "" ? parseFloat(maxS) : null;
      if (lo != null && hi != null && lo > hi) { const t = lo; lo = hi; hi = t; }
      if (lo != null && (val == null || val < lo)) return false;
      if (hi != null && (val == null || val > hi)) return false;
      return true;
    };
    const has = (field: string | null | undefined, q: string): boolean =>
      !q || (field ?? "").toLowerCase().includes(q.toLowerCase());
    if (!range(w.airTemperatureC, cf.airTempMin, cf.airTempMax)) return false;
    if (!range(w.snowTemperatureC, cf.snowTempMin, cf.snowTempMax)) return false;
    if (!range(w.airHumidityPct, cf.airHumMin, cf.airHumMax)) return false;
    if (!range(w.snowHumidityPct, cf.snowHumMin, cf.snowHumMax)) return false;
    if (!range(w.clouds, cf.cloudMin, cf.cloudMax)) return false;
    if (!has(w.snowType, cf.snowType)) return false;
    if (!has(w.trackHardness, cf.trackHardness)) return false;
    if (!has(w.snowHumidityType, cf.snowHumidityType)) return false;
    if (!has(w.grainSize, cf.grainSize)) return false;
    if (!has(w.artificialSnow, cf.artificialSnow)) return false;
    if (!has(w.naturalSnow, cf.naturalSnow)) return false;
    if (!has(w.precipitation, cf.precipitation)) return false;
    if (!has(w.wind, cf.wind)) return false;
    if (!has(w.visibility, cf.visibility)) return false;
    return true;
  };

  // Apply role filter from analytics header (All / Glide / Structure) + conditions filter
  const visibleStats = useMemo(() => {
    let stats = racedProductStats;
    if (roleFilter === "Glide") stats = racedProductStats.filter(s => s.glideCount > 0).map(s => ({ ...s, usages: s.usages.filter(u => u.role === "glide") }));
    else if (roleFilter === "Structure") stats = racedProductStats.filter(s => s.structureCount > 0).map(s => ({ ...s, usages: s.usages.filter(u => u.role === "structure") }));
    if (hasCondFilter) {
      stats = stats
        .map(s => ({ ...s, usages: s.usages.filter(u => weatherMatches(u.weather)) }))
        .filter(s => s.usages.length > 0)
        .map(s => ({ ...s, total: s.usages.length }));
    }
    return stats;
  }, [racedProductStats, roleFilter, cf]);

  const visibleCombos = useMemo(() => {
    if (!hasCondFilter) return racedCombinations;
    return racedCombinations
      .map(c => ({ ...c, usages: c.usages.filter(u => weatherMatches(u.weather)) }))
      .filter(c => c.usages.length > 0)
      .map(c => ({ ...c, count: c.usages.length }));
  }, [racedCombinations, cf]);

  function toggleCombo(key: string) {
    setExpandedCombo(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

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
      {/* View toggle + conditions filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-border bg-background p-0.5">
          <button onClick={() => setView("products")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", view === "products" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {L("Produkter", "Products")}
          </button>
          <button onClick={() => setView("combinations")} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", view === "combinations" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
            {L("Kombinasjoner", "Combinations")}
          </button>
        </div>
        <button
          onClick={() => setShowFilters(v => !v)}
          className={cn("ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            hasCondFilter ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
        >
          <Snowflake className="h-3.5 w-3.5" />
          {L("Vær/føre-filter", "Weather/conditions filter")}
          {condCount > 0 && <span className="rounded-full bg-primary text-primary-foreground px-1.5 text-[10px]">{condCount}</span>}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showFilters && "rotate-180")} />
        </button>
      </div>

      {showFilters && (() => {
        const RangeRow = ({ label, dot, minK, maxK }: { label: string; dot: string; minK: keyof typeof cf; maxK: keyof typeof cf }) => (
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />{label}
            </label>
            <div className="flex items-center gap-1">
              <input type="number" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs" placeholder={L("Min", "Min")} value={cf[minK]} onChange={e => setCfField(minK, e.target.value)} />
              <span className="text-xs">–</span>
              <input type="number" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs" placeholder={L("Max", "Max")} value={cf[maxK]} onChange={e => setCfField(maxK, e.target.value)} />
            </div>
          </div>
        );
        const TextRow = ({ label, k, ph }: { label: string; k: keyof typeof cf; ph?: string }) => (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
            <input type="text" className="h-7 w-full rounded border border-input bg-background px-1.5 text-xs" placeholder={ph} value={cf[k]} onChange={e => setCfField(k, e.target.value)} />
          </div>
        );
        return (
          <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Temperatur og fuktighet", "Temperature & Humidity")}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <RangeRow label={L("Lufttemp (°C)", "Air temp (°C)")} dot="bg-sky-400" minK="airTempMin" maxK="airTempMax" />
                <RangeRow label={L("Snøtemp (°C)", "Snow temp (°C)")} dot="bg-emerald-400" minK="snowTempMin" maxK="snowTempMax" />
                <RangeRow label={L("Luftfukt (%)", "Air humidity (%)")} dot="bg-violet-400" minK="airHumMin" maxK="airHumMax" />
                <RangeRow label={L("Snøfukt (%)", "Snow humidity (%)")} dot="bg-amber-400" minK="snowHumMin" maxK="snowHumMax" />
                <RangeRow label={L("Skydekke (/8)", "Cloud cover (/8)")} dot="bg-slate-400" minK="cloudMin" maxK="cloudMax" />
              </div>
            </div>
            <div>
              <div className="mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{L("Snø og spor", "Snow & Track")}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <TextRow label={L("Snøtype", "Snow type")} k="snowType" />
                <TextRow label={L("Snøfukttype", "Snow humidity type")} k="snowHumidityType" />
                <TextRow label={L("Kornstørrelse", "Grain size")} k="grainSize" />
                <TextRow label={L("Sporhardhet", "Track hardness")} k="trackHardness" />
                <TextRow label={L("Kunstig snø", "Artificial snow")} k="artificialSnow" />
                <TextRow label={L("Naturlig snø", "Natural snow")} k="naturalSnow" />
                <TextRow label={L("Nedbør", "Precipitation")} k="precipitation" ph={L("f.eks. Lett snø", "e.g. Light snow")} />
                <TextRow label={L("Vind", "Wind")} k="wind" ph={L("f.eks. Lett NV", "e.g. Light NW")} />
                <TextRow label={L("Sikt", "Visibility")} k="visibility" ph={L("f.eks. God", "e.g. Good")} />
              </div>
            </div>
            {hasCondFilter && (
              <button onClick={() => setCf({ ...emptyCf })} className="text-xs text-muted-foreground hover:text-foreground underline">
                {L("Nullstill filter", "Clear filter")}
              </button>
            )}
          </div>
        );
      })()}
      {hasCondFilter && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {L("Viser kun produkter/kombinasjoner som har vært kjørt på dette føret.", "Showing only products/combinations raced in these conditions.")}
        </p>
      )}

      {view === "combinations" ? (
        <RacedCombinationsList combos={visibleCombos} expanded={expandedCombo} toggle={toggleCombo} L={L} fmtD={fmtD} lang={lang} />
      ) : (
      <>
      <p className="text-sm text-muted-foreground">
        {L(`${racePreps.length} rennprep-er · ${visibleStats.length} produkter`, `${racePreps.length} race preps · ${visibleStats.length} products`)}
      </p>
      {visibleStats.length === 0 ? (
        <Card className="p-8 text-center">
          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {hasCondFilter
              ? L("Ingen produkter kjørt på dette føret.", "No products raced in these conditions.")
              : L("Ingen produkter registrert i rennprep ennå.", "No products recorded in race preps yet.")}
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
                          {u.application && (
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Applikasjon", "Application")}</p>
                              <p className="font-medium">{u.application}</p>
                            </div>
                          )}
                          {/* Weather fields */}
                          {w && <WeatherFields w={w} L={L} />}
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
      </>
      )}
    </div>
  );
}

// ─── Raced combinations list ─────────────────────────────────────────────────
function RacedCombinationsList({
  combos, expanded, toggle, L, fmtD, lang,
}: {
  combos: RacedCombination[];
  expanded: Set<string>;
  toggle: (key: string) => void;
  L: (no: string, en: string) => string;
  fmtD: (d: string) => string;
  lang: string;
}) {
  if (combos.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{L("Ingen kombinasjoner (2+ produkter) kjørt.", "No combinations (2+ products) raced.")}</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{L(`${combos.length} kombinasjoner`, `${combos.length} combinations`)}</p>
      {combos.map((c) => {
        const isOpen = expanded.has(c.key);
        return (
          <div key={c.key} className="rounded-xl border border-border overflow-hidden">
            <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left" onClick={() => toggle(c.key)}>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                {c.products.map(({ product: p, application }, i) => (
                  <span key={p.id} className="inline-flex items-center text-xs">
                    {i > 0 && <span className="mx-1 text-muted-foreground font-bold">+</span>}
                    <span className="font-semibold">{p.brand} {p.name}</span>
                    {application && <span className="ml-1 text-muted-foreground">({application})</span>}
                  </span>
                ))}
              </div>
              <span className="font-bold text-foreground text-sm shrink-0">{c.count}×</span>
            </button>
            {isOpen && (
              <div className="border-t border-border divide-y divide-border/50">
                {c.usages.map((u, i) => {
                  const p = u.prep; const w = u.weather;
                  return (
                    <div key={i} className="px-4 py-3 bg-muted/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Dato / Sted", "Date / Location")}</p>
                        <p className="font-medium">{fmtD(p.date)} — {p.location}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Renntype", "Race type")}</p>
                        <p className="font-medium">{p.raceType} <span className="text-muted-foreground text-xs">({p.discipline})</span></p>
                      </div>
                      {w && <WeatherFields w={w} L={L} />}
                      {/* Products + applications used in this race */}
                      <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{L("Produkter + applikasjon", "Products + application")}</p>
                        <p className="font-medium">
                          {u.products.map((pp, j) => (
                            <span key={pp.product.id}>{j > 0 ? " + " : ""}{pp.product.brand} {pp.product.name}{pp.application ? ` (${pp.application})` : ""}</span>
                          ))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const { t, language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { can } = useAuth();
  const { lang } = useLanguage();
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather/for-filtering"] });

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
    // "Glide" and "Structure" are product-category filters, not test-type filters
    const isProductCategoryFilter = testTypeFilter === "Glide" || testTypeFilter === "Structure";
    let result = (testTypeFilter === "All" || isProductCategoryFilter) ? tests : tests.filter(t => t.testType === testTypeFilter);
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
      <div class="pdf-title">{L("Analyserapport", "Analytics Report")}</div>
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
    { id: "durability", label: t("analytics.durability") || "Durability", icon: <TrendingUp className="h-4 w-4 rotate-90" /> },
    { id: "racedproducts", label: "Raced Products", icon: <Trophy className="h-4 w-4" /> },
    { id: "racedskis", label: L("Kjørte ski", "Raced Skis"), icon: <Trophy className="h-4 w-4" /> },
    { id: "brands", label: L("Merkestatistikk", "Brand stats"), icon: <Search className="h-4 w-4" /> },
    ...(can("kick", "view") ? [{ id: "kick", label: "Kick", icon: <Footprints className="h-4 w-4" /> }] : []),
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

    const addIds = (idsStr: string | null, appsJson: string | null, type: "glide" | "structure" | "kick", prep: any) => {
      if (!idsStr) return;
      const apps = parseAppsMap(appsJson);
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
        existing.usages.push({ prep, role: type, weather, application: apps.get(id) || "" });
        counts.set(id, existing);
      }
    };

    for (const prep of racePreps) {
      addIds(prep.productIds, prep.productApps, "glide", prep);
      addIds(prep.structureIds, prep.structureApps, "structure", prep);
      addIds(prep.kickProductIds, null, "kick", prep);
    }

    return Array.from(counts.values()).sort((a, b) => b.total - a.total);
  }, [racePreps, productsById, weatherById]);

  // Raced combinations: products used TOGETHER (2+) on the same race prep.
  const racedCombinations = useMemo(() => {
    const combos = new Map<string, RacedCombination>();
    for (const prep of racePreps) {
      const ids = (prep.productIds || "").split(",").map((s: string) => parseInt(s)).filter((n: number) => !isNaN(n));
      const products = ids.map((id: number) => productsById.get(id)).filter(Boolean) as Product[];
      if (products.length < 2) continue;
      const apps = parseAppsMap(prep.productApps);
      const withApps = products.map((p) => ({ product: p, application: apps.get(p.id) || "" }));
      const key = [...products.map((p) => p.id)].sort((a, b) => a - b).join(",");
      const weather = prep.weatherId ? (weatherById.get(prep.weatherId) ?? null) : null;
      const existing = combos.get(key) ?? { key, products: withApps, count: 0, usages: [] };
      existing.count++;
      existing.usages.push({ prep, weather, products: withApps });
      combos.set(key, existing);
    }
    return Array.from(combos.values()).sort((a, b) => b.count - a.count);
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
                <span className="text-xs text-muted-foreground font-medium ml-1">{L("Sesong:", "Season:")}</span>
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
        {/* Mobile: a single dropdown instead of a cramped icon row */}
        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={(v) => setActiveTab(v)}>
            <SelectTrigger data-testid="analytics-tab-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TABS.map((tab) => <SelectItem key={tab.id} value={tab.id}>{tab.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div
          className="hidden sm:flex gap-1 border-b border-border overflow-x-auto px-1"
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
                  productCategoryFilter={testTypeFilter !== "All" ? testTypeFilter : undefined}
                />
                <FormTracker
                  allEntries={allEntries}
                  productsById={productsById}
                  testsById={testsById}
                />

                <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-wins-trend">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    </div>
                    <h2 className="text-base font-semibold">{L("Produktseire over tid", "Product wins over time")}</h2>
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
                    <p className="text-sm text-muted-foreground">{L("Ikke nok seiersdata for å vise trend.", "Not enough win data to display trend.")}</p>
                  )}
                </Card>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-avg-rank">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20">
                        <Award className="h-4 w-4 text-green-600" />
                      </div>
                      <h2 className="text-base font-semibold">{L("Snittrang per produkt", "Average rank by product")}</h2>
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                        <BarChart3 className="h-4 w-4 text-violet-600" />
                      </div>
                      <h2 className="text-base font-semibold">{L("Tester per måned", "Tests per month")}</h2>
                    </div>
                    {testsByMonth.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={testsByMonth}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }} />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar dataKey="glide" name={L("Glid", "Glide")} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="structure" name={L("Struktur", "Structure")} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-sm text-muted-foreground">{L("Ingen testdata ennå.", "No test data yet.")}</p>
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
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
                  <Thermometer className="h-4 w-4 text-amber-600" />
                </div>
                <h2 className="text-base font-semibold">{L("Snøtemperatur vs. rang", "Snow temperature vs. rank")}</h2>
                <span className="text-xs text-muted-foreground">(top 6 products, lower rank = better)</span>
              </div>
              {tempVsRank.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="snowTemp" name={L("Snøtemp", "Snow Temp")} unit="°C" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis dataKey="avgRank" name={L("Rang", "Rank")} reversed tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
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
                <p className="text-sm text-muted-foreground">{L("Trenger tester med koblet værdata for å vise temperatursammenhenger.", "Need tests with linked weather data to show temperature correlations.")}</p>
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

        {activeTab === "durability" && (
          <ErrorBoundary label="Durability">
            <DurabilityAnalysis
              products={products}
              tests={tests}
              allEntries={allEntries}
              productsById={productsById}
              testsById={testsById}
            />
          </ErrorBoundary>
        )}

        {activeTab === "racedproducts" && (
          <RacedProductsTab
            racePreps={racePreps}
            racedProductStats={racedProductStats}
            racedCombinations={racedCombinations}
            lang={lang}
            roleFilter={testTypeFilter}
          />
        )}

        {activeTab === "racedskis" && <RacedSkisView />}

        {activeTab === "brands" && <BrandStatsView />}

        {activeTab === "kick" && <KickReportView />}

      </div>
    </AppShell>
  );
}
