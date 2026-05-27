import { useMemo, useState } from "react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Lightbulb, ThermometerSnowflake, Target, Layers,
  FlaskConical, TrendingUp, ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { parseApplication } from "@/lib/parse-application";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Test = {
  id: number;
  date: string;
  location: string;
  testType: string;
  weatherId: number | null;
  seriesId: number;
  groupScope: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  rank0km: number | null;
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
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number | null;
  airHumidityPct: number | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  snowHumidityType: string | null;
  grainSize: string | null;
  trackHardness: string | null;
  clouds: number | null;
  precipitation: string | null;
  wind: string | null;
  visibility: string | null;
  snowType: string | null;
};

type FilterState = {
  airTempMin: string; airTempMax: string;
  snowTempMin: string; snowTempMax: string;
  airHumMin: string; airHumMax: string;
  snowHumMin: string; snowHumMax: string;
  cloudMin: string; cloudMax: string;
  artificialSnow: string;
  naturalSnow: string;
  snowHumidityType: string;
  grainSize: string;
  trackHardness: string;
  precipitation: string;
  wind: string;
  visibility: string;
};

type ProductResult = {
  productId: number;
  avgRank: number;
  bestRank: number;
  winRate: number;
  count: number;
  wins: number;
  bestApp: string;
  bestCombo: { name: string; count: number } | null;
  confidence: "High" | "Medium" | "Low";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NATURAL_SNOW_OPTIONS = [
  "Falling new", "New", "Irreg. dir. new", "Irreg. dir. transf.", "Transformed",
];
const GRAIN_SIZE_OPTIONS = ["Extra fine", "Fine", "Medium", "Coarse", "Very coarse"];
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry", "Moist", "Wet", "Very wet", "Slush"];
const TRACK_HARDNESS_OPTIONS = ["Very soft", "Soft", "Medium", "Hard", "Very hard", "Ice"];

const emptyFilter: FilterState = {
  airTempMin: "", airTempMax: "",
  snowTempMin: "", snowTempMax: "",
  airHumMin: "", airHumMax: "",
  snowHumMin: "", snowHumMax: "",
  cloudMin: "", cloudMax: "",
  artificialSnow: "",
  naturalSnow: "",
  snowHumidityType: "",
  grainSize: "",
  trackHardness: "",
  precipitation: "",
  wind: "",
  visibility: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRank(entry: TestEntry): number | null {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        const ranks = parsed
          .map((r) => r?.rank)
          .filter((r): r is number => r != null && r > 0);
        if (ranks.length > 0) return Math.min(...ranks);
      }
    } catch {}
  }
  return entry.rank0km && entry.rank0km > 0 ? entry.rank0km : null;
}

function toNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function inRange(val: number, minStr: string, maxStr: string): boolean {
  const min = toNum(minStr);
  const max = toNum(maxStr);
  if (min !== null && val < min) return false;
  if (max !== null && val > max) return false;
  return true;
}

function weatherMatches(w: Weather, f: FilterState): boolean {
  if ((f.airTempMin || f.airTempMax) && !inRange(w.airTemperatureC, f.airTempMin, f.airTempMax)) return false;
  if ((f.snowTempMin || f.snowTempMax) && !inRange(w.snowTemperatureC, f.snowTempMin, f.snowTempMax)) return false;
  if ((f.airHumMin || f.airHumMax) && w.airHumidityPct != null && !inRange(w.airHumidityPct, f.airHumMin, f.airHumMax)) return false;
  if ((f.snowHumMin || f.snowHumMax) && w.snowHumidityPct != null && !inRange(w.snowHumidityPct, f.snowHumMin, f.snowHumMax)) return false;
  if ((f.cloudMin || f.cloudMax) && w.clouds != null && !inRange(w.clouds, f.cloudMin, f.cloudMax)) return false;
  if (f.artificialSnow === "yes" && !w.artificialSnow) return false;
  if (f.naturalSnow && w.naturalSnow !== f.naturalSnow) return false;
  if (f.snowHumidityType && w.snowHumidityType !== f.snowHumidityType) return false;
  if (f.grainSize && w.grainSize !== f.grainSize) return false;
  if (f.trackHardness && w.trackHardness !== f.trackHardness) return false;
  if (f.precipitation && !w.precipitation?.toLowerCase().includes(f.precipitation.toLowerCase())) return false;
  if (f.wind && !w.wind?.toLowerCase().includes(f.wind.toLowerCase())) return false;
  if (f.visibility && !w.visibility?.toLowerCase().includes(f.visibility.toLowerCase())) return false;
  return true;
}

function activeFilterCount(f: FilterState): number {
  return [
    f.airTempMin, f.airTempMax, f.snowTempMin, f.snowTempMax,
    f.airHumMin, f.airHumMax, f.snowHumMin, f.snowHumMax,
    f.cloudMin, f.cloudMax,
    f.artificialSnow, f.naturalSnow, f.snowHumidityType,
    f.grainSize, f.trackHardness, f.precipitation, f.wind, f.visibility,
  ].filter(Boolean).length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MinMaxInput({
  minVal, maxVal, onMinChange, onMaxChange,
}: {
  minVal: string; maxVal: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        placeholder="Min"
        value={minVal}
        onChange={(e) => onMinChange(e.target.value)}
        className="h-8 w-[72px] text-xs text-center px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto"
      />
      <span className="text-muted-foreground text-xs">–</span>
      <Input
        type="number"
        placeholder="Max"
        value={maxVal}
        onChange={(e) => onMaxChange(e.target.value)}
        className="h-8 w-[72px] text-xs text-center px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto"
      />
    </div>
  );
}

function RankBadge({ rank }: { rank: number | null }) {
  if (rank === null) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className={cn(
      "inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
      rank === 1 && "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
      rank === 2 && "bg-slate-300/30 text-slate-500 dark:text-slate-300",
      rank === 3 && "bg-amber-700/20 text-amber-600 dark:text-amber-500",
      rank > 3 && "bg-muted/60 text-muted-foreground",
    )}>
      #{rank}
    </span>
  );
}

function ConfidenceBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1",
      level === "High" && "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800",
      level === "Medium" && "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800",
      level === "Low" && "bg-muted text-muted-foreground ring-border",
    )}>
      {level}
    </span>
  );
}

function ProductRow({
  rank,
  productName,
  result,
}: {
  rank: number;
  productName: string;
  result: ProductResult;
}) {
  const [open, setOpen] = useState(false);
  const winPct = (result.winRate * 100).toFixed(0);

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      rank === 1 && "border-yellow-300/70 bg-yellow-50/40 dark:border-yellow-700/40 dark:bg-yellow-900/10",
      rank === 2 && "border-slate-300/70 bg-slate-50/40 dark:border-slate-600/40 dark:bg-slate-900/10",
      rank === 3 && "border-amber-300/70 bg-amber-50/40 dark:border-amber-700/40 dark:bg-amber-900/10",
      rank > 3 && "border-border/60",
    )}>
      {/* Header row — clickable */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {/* Rank circle */}
        <span className={cn(
          "flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          rank === 1 && "bg-yellow-500/25 text-yellow-600 dark:text-yellow-400",
          rank === 2 && "bg-slate-300/40 text-slate-500 dark:text-slate-300",
          rank === 3 && "bg-amber-700/25 text-amber-600 dark:text-amber-500",
          rank > 3 && "bg-muted text-muted-foreground",
        )}>
          {rank}
        </span>

        {/* Product name */}
        <span className="flex-1 text-sm font-semibold truncate min-w-0">{productName}</span>

        {/* Key stats */}
        <div className="flex items-center gap-2.5 text-xs shrink-0">
          <span className="hidden sm:inline text-muted-foreground">
            Avg <span className="font-semibold text-foreground">#{result.avgRank.toFixed(1)}</span>
          </span>
          <span className="hidden md:inline text-muted-foreground">
            Best <RankBadge rank={result.bestRank < 99 ? result.bestRank : null} />
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{result.count}</span>t
          </span>
          {result.wins > 0 && (
            <span className="hidden sm:inline text-amber-600 font-bold">{result.wins}W</span>
          )}
          <ConfidenceBadge level={result.confidence} />
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </div>
      </div>

      {/* Expanded details */}
      {open && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-2.5 text-xs">
          {/* Stats row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Avg rank</span>
              <span className="font-semibold">#{result.avgRank.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Best rank</span>
              <RankBadge rank={result.bestRank < 99 ? result.bestRank : null} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Win rate</span>
              <span className="font-semibold">{winPct}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Wins</span>
              <span className="font-semibold text-amber-600">{result.wins}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Tests</span>
              <span className="font-semibold">{result.count}</span>
            </div>
          </div>

          {/* Best application */}
          {result.bestApp && (
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">Best application:</span>
              <span className="font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md ring-1 ring-amber-200/60 dark:ring-amber-800/60">
                {result.bestApp}
              </span>
            </div>
          )}

          {/* Best combo */}
          {result.bestCombo && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span className="text-muted-foreground">Best combo partner:</span>
              <span className="font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md ring-1 ring-violet-200/60 dark:ring-violet-800/60">
                {result.bestCombo.name}
              </span>
              <span className="text-muted-foreground">({result.bestCombo.count}×)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsColumn({
  title,
  icon,
  results,
  productsById,
  hasFilters,
  matchCount,
}: {
  title: string;
  icon: React.ReactNode;
  results: ProductResult[];
  productsById: Map<number, Product>;
  hasFilters: boolean;
  matchCount: number;
}) {
  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl",
          title === "Glide" ? "bg-cyan-50 dark:bg-cyan-900/30" : "bg-violet-50 dark:bg-violet-900/30",
        )}>
          {icon}
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        {hasFilters && matchCount > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            from {matchCount} matching test{matchCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-8">
          <Lightbulb className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {hasFilters ? "No test data for these conditions." : "No test data yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((r, idx) => {
            const product = productsById.get(r.productId);
            if (!product) return null;
            return (
              <ProductRow
                key={r.productId}
                rank={idx + 1}
                productName={`${product.brand} ${product.name}`}
                result={r}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Suggestions() {
  const { t } = useI18n();

  // ─── Data ───────────────────────────────────────────────────────────────────
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

  const allTestIds = useMemo(() => tests.map((t) => t.id), [tests]);
  const { data: allEntries = [], isLoading: entriesLoading } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/all-suggestions", allTestIds],
    queryFn: async () => {
      if (allTestIds.length === 0) return [];
      const results = await Promise.all(
        allTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => (r.ok ? r.json() : []))
        )
      );
      return results.flat();
    },
    enabled: allTestIds.length > 0,
  });

  // ─── Filter state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(emptyFilter);
  function set(field: keyof FilterState) {
    return (v: string) => setFilters((prev) => ({ ...prev, [field]: v }));
  }
  function selectSet(field: keyof FilterState) {
    return (v: string) => setFilters((prev) => ({ ...prev, [field]: v === "__any__" ? "" : v }));
  }

  // ─── Derived maps ────────────────────────────────────────────────────────────
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);
  const testsById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);

  // ─── Compute matching tests ──────────────────────────────────────────────────
  const { matchingTestIds, matchingTestCount, globalConfidence } = useMemo(() => {
    const nFilters = activeFilterCount(filters);
    if (nFilters === 0) {
      const ids = new Set(tests.map((t) => t.id));
      return { matchingTestIds: ids, matchingTestCount: ids.size, globalConfidence: "Low" as const };
    }
    const matchingWeatherIds = new Set<number>();
    for (const w of weather) {
      if (weatherMatches(w, filters)) matchingWeatherIds.add(w.id);
    }
    const matchedIds = new Set<number>();
    for (const t of tests) {
      if (t.weatherId && matchingWeatherIds.has(t.weatherId)) matchedIds.add(t.id);
    }
    const conf: "High" | "Medium" | "Low" =
      matchedIds.size >= 5 ? "High" : matchedIds.size >= 2 ? "Medium" : "Low";
    return { matchingTestIds: matchedIds, matchingTestCount: matchedIds.size, globalConfidence: conf };
  }, [filters, tests, weather]);

  // ─── Compute product rankings for a given test type ─────────────────────────
  function buildResults(testType: string): ProductResult[] {
    const nFilters = activeFilterCount(filters);
    const useAll = nFilters === 0;
    const relevant = useAll
      ? allEntries
      : allEntries.filter((e) => matchingTestIds.has(e.testId));

    const entries = relevant.filter((e) => {
      const test = testsById.get(e.testId);
      return test?.testType === testType && e.productId != null;
    });

    type Stats = {
      ranks: number[]; wins: number; testIds: Set<number>;
      apps: string[]; partners: Map<number, number>;
    };
    const statsMap = new Map<number, Stats>();

    for (const entry of entries) {
      if (!entry.productId) continue;
      const rank = getRank(entry);
      if (!statsMap.has(entry.productId)) {
        statsMap.set(entry.productId, {
          ranks: [], wins: 0, testIds: new Set(), apps: [], partners: new Map(),
        });
      }
      const s = statsMap.get(entry.productId)!;
      s.testIds.add(entry.testId);
      if (rank !== null) {
        s.ranks.push(rank);
        if (rank === 1) s.wins++;
      }
      if (entry.methodology) {
        const raw = entry.methodology.split("|")[0].trim();
        if (raw) s.apps.push(parseApplication(raw).interpreted || raw);
      }
      if (entry.additionalProductIds) {
        for (const idStr of entry.additionalProductIds.split(",")) {
          const n = parseInt(idStr.trim(), 10);
          if (!isNaN(n)) s.partners.set(n, (s.partners.get(n) ?? 0) + 1);
        }
      }
    }

    const results: ProductResult[] = [];
    for (const [productId, s] of statsMap.entries()) {
      if (s.ranks.length === 0) continue;
      const avgRank = s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length;
      const bestRank = Math.min(...s.ranks);
      const winRate = s.wins / s.ranks.length;

      // Best application (most frequent)
      const appFreq = new Map<string, number>();
      for (const a of s.apps) appFreq.set(a, (appFreq.get(a) ?? 0) + 1);
      const bestApp = [...appFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      // Best combo partner
      let bestCombo: { name: string; count: number } | null = null;
      if (s.partners.size > 0) {
        const [topId, topCount] = [...s.partners.entries()].sort((a, b) => b[1] - a[1])[0];
        const partner = productsById.get(topId);
        if (partner) bestCombo = { name: `${partner.brand} ${partner.name}`, count: topCount };
      }

      const conf: "High" | "Medium" | "Low" =
        nFilters > 0 && s.ranks.length >= 3 ? globalConfidence :
        nFilters > 0 && s.ranks.length >= 1 ? "Medium" : "Low";

      results.push({
        productId,
        avgRank: parseFloat(avgRank.toFixed(2)),
        bestRank,
        winRate,
        count: s.testIds.size,
        wins: s.wins,
        bestApp,
        bestCombo,
        confidence: conf,
      });
    }

    return results
      .sort((a, b) => {
        const sA = (1 / a.avgRank) * 0.6 + a.winRate * 0.4;
        const sB = (1 / b.avgRank) * 0.6 + b.winRate * 0.4;
        return sB - sA;
      })
      .slice(0, 12);
  }

  const glideResults = useMemo(
    () => buildResults("Glide"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEntries, matchingTestIds, testsById, productsById, globalConfidence, filters]
  );
  const structureResults = useMemo(
    () => buildResults("Structure"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEntries, matchingTestIds, testsById, productsById, globalConfidence, filters]
  );

  const nFilters = activeFilterCount(filters);
  const hasFilters = nFilters > 0;
  const isLoading = entriesLoading && allTestIds.length > 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-suggestions-title">
            {t("suggestions.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Condition-based product recommendations from your test history
          </p>
        </div>

        {/* ─── Weather Conditions filter card ─────────────────────────────────── */}
        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-weather-params">
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30">
                <ThermometerSnowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ❄ Weather Conditions
              </span>
            </div>
            {hasFilters && (
              <button
                onClick={() => setFilters(emptyFilter)}
                className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Temperature & Humidity */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Temperature &amp; Humidity
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-5 gap-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  Air temp (°C)
                </label>
                <MinMaxInput minVal={filters.airTempMin} maxVal={filters.airTempMax} onMinChange={set("airTempMin")} onMaxChange={set("airTempMax")} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  Snow temp (°C)
                </label>
                <MinMaxInput minVal={filters.snowTempMin} maxVal={filters.snowTempMax} onMinChange={set("snowTempMin")} onMaxChange={set("snowTempMax")} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                  Air humidity (%rH)
                </label>
                <MinMaxInput minVal={filters.airHumMin} maxVal={filters.airHumMax} onMinChange={set("airHumMin")} onMaxChange={set("airHumMax")} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                  Snow humidity (%)
                </label>
                <MinMaxInput minVal={filters.snowHumMin} maxVal={filters.snowHumMax} onMinChange={set("snowHumMin")} onMaxChange={set("snowHumMax")} />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
                  Cloud cover (%)
                </label>
                <MinMaxInput minVal={filters.cloudMin} maxVal={filters.cloudMax} onMinChange={set("cloudMin")} onMaxChange={set("cloudMax")} />
              </div>
            </div>
          </div>

          {/* Snow Type */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Snow Type
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                  Artificial snow
                </label>
                <Select value={filters.artificialSnow || "__any__"} onValueChange={selectSet("artificialSnow")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">— Any —</SelectItem>
                    <SelectItem value="yes">Artificial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                  Natural snow
                </label>
                <Select value={filters.naturalSnow || "__any__"} onValueChange={selectSet("naturalSnow")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">— Any —</SelectItem>
                    {NATURAL_SNOW_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />
                  Snow humidity type
                </label>
                <Select value={filters.snowHumidityType || "__any__"} onValueChange={selectSet("snowHumidityType")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">— Any —</SelectItem>
                    {SNOW_HUMIDITY_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-lime-500" />
                  Grain size
                </label>
                <Select value={filters.grainSize || "__any__"} onValueChange={selectSet("grainSize")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">— Any —</SelectItem>
                    {GRAIN_SIZE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Snow & Track */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Snow &amp; Track
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
                  Track hardness
                </label>
                <Select value={filters.trackHardness || "__any__"} onValueChange={selectSet("trackHardness")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">— Any —</SelectItem>
                    {TRACK_HARDNESS_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                  Precipitation
                </label>
                <Input
                  placeholder="e.g. Light snow"
                  value={filters.precipitation}
                  onChange={(e) => set("precipitation")(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-500" />
                  Wind
                </label>
                <Input
                  placeholder="e.g. Light NW"
                  value={filters.wind}
                  onChange={(e) => set("wind")(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-pink-400" />
                  Visibility
                </label>
                <Input
                  placeholder="e.g. Good"
                  value={filters.visibility}
                  onChange={(e) => set("visibility")(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Results ─────────────────────────────────────────────────────────── */}
        {isLoading ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-violet-500 animate-pulse mb-3" />
            <p className="text-sm text-muted-foreground">Loading test data…</p>
          </Card>
        ) : allEntries.length === 0 && allTestIds.length > 0 ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <Lightbulb className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No test data found. Run some tests first to get recommendations.</p>
          </Card>
        ) : (
          <>
            {/* Match summary banner */}
            {hasFilters && (
              <div className={cn(
                "rounded-xl border px-4 py-2.5 text-xs font-medium",
                matchingTestCount === 0
                  ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  : matchingTestCount >= 5
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              )}>
                {matchingTestCount === 0
                  ? `⚠ No tests found matching these conditions. Try widening your filters.`
                  : `✓ ${matchingTestCount} test${matchingTestCount !== 1 ? "s" : ""} match these conditions (${nFilters} active filter${nFilters !== 1 ? "s" : ""})`
                }
              </div>
            )}

            {/* Glide + Structure columns */}
            {(!hasFilters || matchingTestCount > 0) && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <ResultsColumn
                  title="Glide"
                  icon={<Target className="h-4 w-4 text-cyan-500" />}
                  results={glideResults}
                  productsById={productsById}
                  hasFilters={hasFilters}
                  matchCount={matchingTestCount}
                />
                <ResultsColumn
                  title="Structure"
                  icon={<Layers className="h-4 w-4 text-violet-500" />}
                  results={structureResults}
                  productsById={productsById}
                  hasFilters={hasFilters}
                  matchCount={matchingTestCount}
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
