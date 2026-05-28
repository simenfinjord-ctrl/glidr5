import { useMemo, useState } from "react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Lightbulb, ThermometerSnowflake, Target, Layers,
  FlaskConical, TrendingUp, ChevronDown, Link2, HelpCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseApplication } from "@/lib/parse-application";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Test = {
  id: number; date: string; location: string;
  testType: string; weatherId: number | null;
  seriesId: number; groupScope: string;
};

type TestEntry = {
  id: number; testId: number; skiNumber: number;
  productId: number | null; additionalProductIds: string | null;
  rank0km: number | null; results: string | null;
  feelingRank: number | null; methodology: string | null;
};

type Product = { id: number; category: string; brand: string; name: string; };

type Weather = {
  id: number; snowTemperatureC: number; airTemperatureC: number;
  snowHumidityPct: number | null; airHumidityPct: number | null;
  artificialSnow: string | null; naturalSnow: string | null;
  snowHumidityType: string | null; grainSize: string | null;
  trackHardness: string | null; clouds: number | null;
  precipitation: string | null; wind: string | null;
  visibility: string | null; snowType: string | null;
};

type FilterState = {
  airTempMin: string; airTempMax: string;
  snowTempMin: string; snowTempMax: string;
  airHumMin: string; airHumMax: string;
  snowHumMin: string; snowHumMax: string;
  cloudMin: string; cloudMax: string;
  artificialSnow: string; naturalSnow: string;
  snowHumidityType: string; grainSize: string;
  trackHardness: string; precipitation: string;
  wind: string; visibility: string;
};

type ProductResult = {
  productId: number;
  avgRank: number | null;
  bestRank: number | null;
  winRate: number;
  count: number;
  wins: number;
  bestApp: string;
  bestCombo: { name: string; count: number } | null;
  confidence: "High" | "Medium" | "Low";
  hasRankData: boolean;
};

type ComboResult = {
  product1Id: number; product2Id: number;
  app1: string; app2: string;
  avgRank: number | null; bestRank: number | null;
  count: number; wins: number;
  confidence: "High" | "Medium" | "Low";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NATURAL_SNOW_OPTIONS = ["Falling new","New","Irreg. dir. new","Irreg. dir. transf.","Transformed"];
const GRAIN_SIZE_OPTIONS = ["Extra fine","Fine","Medium","Coarse","Very coarse"];
const SNOW_HUMIDITY_TYPE_OPTIONS = ["Dry","Moist","Wet","Very wet","Slush"];
const TRACK_HARDNESS_OPTIONS = ["Very soft","Soft","Medium","Hard","Very hard","Ice"];

const emptyFilter: FilterState = {
  airTempMin:"", airTempMax:"", snowTempMin:"", snowTempMax:"",
  airHumMin:"", airHumMax:"", snowHumMin:"", snowHumMax:"",
  cloudMin:"", cloudMax:"", artificialSnow:"", naturalSnow:"",
  snowHumidityType:"", grainSize:"", trackHardness:"",
  precipitation:"", wind:"", visibility:"",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRank(entry: TestEntry): number | null {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        const ranks = parsed.map((r) => r?.rank).filter((r): r is number => r != null && r > 0);
        if (ranks.length > 0) return Math.min(...ranks);
      }
    } catch {}
  }
  return entry.rank0km && entry.rank0km > 0 ? entry.rank0km : null;
}

function toNum(s: string): number | null {
  const n = parseFloat(s); return isNaN(n) ? null : n;
}

function inRange(val: number, minStr: string, maxStr: string): boolean {
  const min = toNum(minStr); const max = toNum(maxStr);
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
    f.cloudMin, f.cloudMax, f.artificialSnow, f.naturalSnow,
    f.snowHumidityType, f.grainSize, f.trackHardness,
    f.precipitation, f.wind, f.visibility,
  ].filter(Boolean).length;
}

function mostCommon(arr: string[]): string {
  if (arr.length === 0) return "";
  const freq = new Map<string, number>();
  for (const a of arr) freq.set(a, (freq.get(a) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MinMaxInput({ minVal, maxVal, onMinChange, onMaxChange }: {
  minVal: string; maxVal: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Input type="number" placeholder="Min" value={minVal} onChange={(e) => onMinChange(e.target.value)}
        className="h-8 w-[72px] text-xs text-center px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto" />
      <span className="text-muted-foreground text-xs">–</span>
      <Input type="number" placeholder="Max" value={maxVal} onChange={(e) => onMaxChange(e.target.value)}
        className="h-8 w-[72px] text-xs text-center px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto" />
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
    )}>#{rank}</span>
  );
}

function ConfidenceBadge({ level, count, usingFallback }: {
  level: "High" | "Medium" | "Low";
  count?: number;
  usingFallback?: boolean;
}) {
  const tooltipText =
    usingFallback
      ? "No tests matched these conditions — showing results from all tests."
      : level === "High"
        ? `High confidence: based on ${count ?? "5+"} tests that closely match your conditions.`
        : level === "Medium"
          ? `Medium confidence: based on ${count ?? "2–4"} tests matching your conditions.`
          : `Low confidence: based on ${count ?? 1} test matching your conditions, or estimated from all tests.`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 cursor-help",
            level === "High" && "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-800",
            level === "Medium" && "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:ring-amber-800",
            level === "Low" && "bg-muted text-muted-foreground ring-border",
          )}>
            {level}
            <HelpCircle className="h-2.5 w-2.5 opacity-60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs text-center">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProductRow({ rank, productName, result }: {
  rank: number; productName: string; result: ProductResult;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      rank === 1 && "border-yellow-300/70 bg-yellow-50/40 dark:border-yellow-700/40 dark:bg-yellow-900/10",
      rank === 2 && "border-slate-300/70 bg-slate-50/40 dark:border-slate-600/40 dark:bg-slate-900/10",
      rank === 3 && "border-amber-300/70 bg-amber-50/40 dark:border-amber-700/40 dark:bg-amber-900/10",
      rank > 3 && "border-border/60",
    )}>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className={cn(
          "flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
          rank === 1 && "bg-yellow-500/25 text-yellow-600 dark:text-yellow-400",
          rank === 2 && "bg-slate-300/40 text-slate-500 dark:text-slate-300",
          rank === 3 && "bg-amber-700/25 text-amber-600 dark:text-amber-500",
          rank > 3 && "bg-muted text-muted-foreground",
        )}>{rank}</span>
        <span className="flex-1 text-sm font-semibold truncate min-w-0">{productName}</span>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {result.hasRankData ? (
            <>
              <span className="hidden sm:inline text-muted-foreground">
                Avg <span className="font-semibold text-foreground">#{result.avgRank!.toFixed(1)}</span>
              </span>
              <span className="hidden md:inline text-muted-foreground">
                Best <RankBadge rank={result.bestRank} />
              </span>
              {result.wins > 0 && (
                <span className="hidden sm:inline text-amber-600 font-bold">{result.wins}W</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground text-[10px]">no rank data</span>
          )}
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{result.count}</span>t
          </span>
          <ConfidenceBadge level={result.confidence} count={result.count} />
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </div>
      </div>
      {open && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-2 text-xs">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {result.hasRankData && <>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Avg rank</span><span className="font-semibold">#{result.avgRank!.toFixed(1)}</span></div>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Best rank</span><RankBadge rank={result.bestRank} /></div>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Win rate</span><span className="font-semibold">{(result.winRate * 100).toFixed(0)}%</span></div>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Wins</span><span className="font-semibold text-amber-600">{result.wins}</span></div>
            </>}
            <div className="flex items-center gap-1"><span className="text-muted-foreground">Tests</span><span className="font-semibold">{result.count}</span></div>
          </div>
          {result.bestApp && (
            <div className="flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">Best application:</span>
              <span className="font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md ring-1 ring-amber-200/60 dark:ring-amber-800/60">{result.bestApp}</span>
            </div>
          )}
          {result.bestCombo && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-violet-500 shrink-0" />
              <span className="text-muted-foreground">Best combo partner:</span>
              <span className="font-medium bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-md ring-1 ring-violet-200/60 dark:ring-violet-800/60">{result.bestCombo.name}</span>
              <span className="text-muted-foreground">({result.bestCombo.count}×)</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ComboRow({ rank, combo, productsById }: {
  rank: number; combo: ComboResult; productsById: Map<number, Product>;
}) {
  const [open, setOpen] = useState(false);
  const p1 = productsById.get(combo.product1Id);
  const p2 = productsById.get(combo.product2Id);
  if (!p1 || !p2) return null;
  const p1Name = `${p1.brand} ${p1.name}`;
  const p2Name = `${p2.brand} ${p2.name}`;

  return (
    <div className={cn(
      "rounded-lg border overflow-hidden",
      rank === 1 && "border-violet-300/70 bg-violet-50/40 dark:border-violet-700/40 dark:bg-violet-900/10",
      rank > 1 && "border-border/60",
    )}>
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className={cn(
          "flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold mt-0.5",
          rank === 1 && "bg-violet-500/20 text-violet-600 dark:text-violet-400",
          rank > 1 && "bg-muted text-muted-foreground",
        )}>{rank}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="font-semibold text-foreground">{p1Name}</span>
            {combo.app1 && (
              <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] ring-1 ring-amber-200/60 dark:ring-amber-800/60">{combo.app1}</span>
            )}
            <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground">{p2Name}</span>
            {combo.app2 && (
              <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded text-[10px] ring-1 ring-amber-200/60 dark:ring-amber-800/60">{combo.app2}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs shrink-0">
          {combo.hasRankData && <RankBadge rank={combo.bestRank} />}
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{combo.count}</span>t</span>
          <ConfidenceBadge level={combo.confidence} count={combo.count} />
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", open && "rotate-180")} />
        </div>
      </div>
      {open && (
        <div className="border-t bg-muted/20 px-3 py-3 space-y-1.5 text-xs">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {combo.hasRankData && <>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Avg rank</span><span className="font-semibold">#{combo.avgRank!.toFixed(1)}</span></div>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Best rank</span><RankBadge rank={combo.bestRank} /></div>
              <div className="flex items-center gap-1"><span className="text-muted-foreground">Wins</span><span className="font-semibold text-amber-600">{combo.wins}</span></div>
            </>}
            <div className="flex items-center gap-1"><span className="text-muted-foreground">Times tested</span><span className="font-semibold">{combo.count}</span></div>
          </div>
          <div className="flex items-start gap-2 pt-1">
            <FlaskConical className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {combo.app1 && <div><span className="text-muted-foreground">{p1Name}:</span> <span className="font-medium">{combo.app1}</span></div>}
              {combo.app2 && <div><span className="text-muted-foreground">{p2Name}:</span> <span className="font-medium">{combo.app2}</span></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Add hasRankData to ComboResult usage
declare module "./suggestions" {}
// @ts-ignore — augment ComboResult inline
type ComboResultFull = ComboResult & { hasRankData: boolean };

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Suggestions() {
  const { t } = useI18n();

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

  const [filters, setFilters] = useState<FilterState>(emptyFilter);
  function set(field: keyof FilterState) { return (v: string) => setFilters((p) => ({ ...p, [field]: v })); }
  function sel(field: keyof FilterState) { return (v: string) => setFilters((p) => ({ ...p, [field]: v === "__any__" ? "" : v })); }

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const testsById    = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);

  // ─── Compute everything in one useMemo ────────────────────────────────────
  const computed = useMemo(() => {
    const nFilters = activeFilterCount(filters);

    // Step 1: Find matching weather → matching test IDs
    let matchingTestIds = new Set<number>();
    let usingFallback = false;

    if (nFilters === 0) {
      matchingTestIds = new Set(tests.map((t) => t.id));
    } else {
      const matchingWeatherIds = new Set<number>();
      for (const w of weather) {
        if (weatherMatches(w, filters)) matchingWeatherIds.add(w.id);
      }
      for (const t of tests) {
        if (t.weatherId && matchingWeatherIds.has(t.weatherId)) matchingTestIds.add(t.id);
        // Also include tests without weather when no categorical/text filters are set
        // (only numeric filters) — weather not logged doesn't mean conditions didn't match
        else if (!t.weatherId && nFilters > 0) {
          // skip tests with no weather if filters are set
        }
      }
      // Fallback: if 0 matches, use all tests but flag as fallback
      if (matchingTestIds.size === 0) {
        matchingTestIds = new Set(tests.map((t) => t.id));
        usingFallback = true;
      }
    }

    const matchCount = usingFallback ? 0 : matchingTestIds.size;
    const globalConf: "High" | "Medium" | "Low" =
      usingFallback ? "Low" :
      matchCount >= 5 ? "High" :
      matchCount >= 2 ? "Medium" : "Low";

    // Step 2: Get relevant entries
    const relevantEntries = allEntries.filter((e) => matchingTestIds.has(e.testId));

    // Step 3: Build product results for a given test type
    function buildProducts(testType: string): ProductResult[] {
      const entries = relevantEntries.filter((e) => {
        const test = testsById.get(e.testId);
        return test?.testType === testType && e.productId != null;
      });

      type Stats = { ranks: number[]; wins: number; testIds: Set<number>; apps: string[]; partners: Map<number, number> };
      const statsMap = new Map<number, Stats>();

      for (const entry of entries) {
        if (!entry.productId) continue;
        const rank = getRank(entry);
        if (!statsMap.has(entry.productId)) {
          statsMap.set(entry.productId, { ranks: [], wins: 0, testIds: new Set(), apps: [], partners: new Map() });
        }
        const s = statsMap.get(entry.productId)!;
        s.testIds.add(entry.testId);
        if (rank !== null) { s.ranks.push(rank); if (rank === 1) s.wins++; }
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
        const count = s.testIds.size;
        if (count === 0) continue;
        const hasRankData = s.ranks.length > 0;
        const avgRank = hasRankData ? parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)) : null;
        const bestRank = hasRankData ? Math.min(...s.ranks) : null;
        const winRate = hasRankData ? s.wins / s.ranks.length : 0;
        const bestApp = mostCommon(s.apps);
        let bestCombo: { name: string; count: number } | null = null;
        if (s.partners.size > 0) {
          const [topId, topCount] = [...s.partners.entries()].sort((a, b) => b[1] - a[1])[0];
          const partner = productsById.get(topId);
          if (partner) bestCombo = { name: `${partner.brand} ${partner.name}`, count: topCount };
        }
        const conf: "High" | "Medium" | "Low" =
          usingFallback ? "Low" :
          nFilters > 0 && s.ranks.length >= 3 ? globalConf :
          nFilters > 0 && s.ranks.length >= 1 ? "Medium" : "Low";

        results.push({ productId, avgRank, bestRank, winRate, count, wins: s.wins, bestApp, bestCombo, confidence: conf, hasRankData });
      }

      return results.sort((a, b) => {
        if (a.hasRankData !== b.hasRankData) return a.hasRankData ? -1 : 1;
        if (a.hasRankData && b.hasRankData) {
          const sA = (1 / a.avgRank!) * 0.6 + a.winRate * 0.4;
          const sB = (1 / b.avgRank!) * 0.6 + b.winRate * 0.4;
          return sB - sA;
        }
        return b.count - a.count;
      }).slice(0, 12);
    }

    // Step 4: Build combination results for a given test type
    function buildCombos(testType: string): (ComboResult & { hasRankData: boolean })[] {
      const entries = relevantEntries.filter((e) => {
        const test = testsById.get(e.testId);
        return test?.testType === testType && e.productId != null && e.additionalProductIds;
      });

      type CS = { p1: number; p2: number; ranks: number[]; wins: number; apps1: string[]; apps2: string[] };
      const comboMap = new Map<string, CS>();

      for (const entry of entries) {
        if (!entry.productId || !entry.additionalProductIds) continue;
        const rank = getRank(entry);
        const app1Raw = entry.methodology?.split("|")[0].trim() ?? "";
        const app1 = app1Raw ? (parseApplication(app1Raw).interpreted || app1Raw) : "";
        const addIds = entry.additionalProductIds.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
        const addApps = entry.methodology ? entry.methodology.split("|").slice(1) : [];

        for (let i = 0; i < addIds.length; i++) {
          const p2 = addIds[i];
          const app2Raw = addApps[i]?.trim() ?? "";
          const app2 = app2Raw ? (parseApplication(app2Raw).interpreted || app2Raw) : "";
          // Keep original order: entry.productId is always p1, addId is always p2
          // Different orders = different combinations (not merged)
          const key = `${entry.productId}-${p2}`;
          if (!comboMap.has(key)) comboMap.set(key, { p1: entry.productId, p2, ranks: [], wins: 0, apps1: [], apps2: [] });
          const s = comboMap.get(key)!;
          if (rank !== null) { s.ranks.push(rank); if (rank === 1) s.wins++; }
          if (app1) s.apps1.push(app1);
          if (app2) s.apps2.push(app2);
        }
      }

      const results: (ComboResult & { hasRankData: boolean })[] = [];
      for (const [, s] of comboMap.entries()) {
        if (!productsById.has(s.p1) || !productsById.has(s.p2)) continue;
        const hasRankData = s.ranks.length > 0;
        const avgRank = hasRankData ? parseFloat((s.ranks.reduce((a, b) => a + b, 0) / s.ranks.length).toFixed(2)) : null;
        const bestRank = hasRankData ? Math.min(...s.ranks) : null;
        const count = Math.max(s.ranks.length, s.apps1.length);
        if (count === 0) continue;
        const conf: "High" | "Medium" | "Low" =
          usingFallback ? "Low" :
          nFilters > 0 && s.ranks.length >= 3 ? globalConf :
          s.ranks.length >= 1 ? "Medium" : "Low";
        results.push({
          product1Id: s.p1, product2Id: s.p2,
          app1: mostCommon(s.apps1), app2: mostCommon(s.apps2),
          avgRank, bestRank, count, wins: s.wins,
          confidence: conf, hasRankData,
        });
      }

      return results.sort((a, b) => {
        if (a.hasRankData !== b.hasRankData) return a.hasRankData ? -1 : 1;
        if (a.hasRankData && b.hasRankData) {
          const sA = (1 / a.avgRank!) * 0.6 + (a.wins / a.count) * 0.4;
          const sB = (1 / b.avgRank!) * 0.6 + (b.wins / b.count) * 0.4;
          return sB - sA;
        }
        return b.count - a.count;
      }).slice(0, 8);
    }

    return {
      matchCount,
      usingFallback,
      glideProducts: buildProducts("Glide"),
      structureProducts: buildProducts("Structure"),
      glideCombos: buildCombos("Glide"),
      structureCombos: buildCombos("Structure"),
    };
  }, [allEntries, tests, weather, filters, testsById, productsById]);

  const nFilters = activeFilterCount(filters);
  const hasFilters = nFilters > 0;
  const isLoading = entriesLoading && allTestIds.length > 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-suggestions-title">
            {t("suggestions.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Condition-based product recommendations from your test history
          </p>
        </div>

        {/* ─── Filter card ──────────────────────────────────────────────────── */}
        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-weather-params">
          <div className="flex items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-900/30">
                <ThermometerSnowflake className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">❄ Weather Conditions</span>
            </div>
            {hasFilters && (
              <button onClick={() => setFilters(emptyFilter)} className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
                Clear all
              </button>
            )}
          </div>

          {/* Temperature & Humidity */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Temperature &amp; Humidity</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-5 gap-y-4">
              {[
                { label: "Air temp (°C)", color: "bg-blue-500", minF: "airTempMin" as const, maxF: "airTempMax" as const },
                { label: "Snow temp (°C)", color: "bg-green-500", minF: "snowTempMin" as const, maxF: "snowTempMax" as const },
                { label: "Air humidity (%rH)", color: "bg-purple-500", minF: "airHumMin" as const, maxF: "airHumMax" as const },
                { label: "Snow humidity (%)", color: "bg-yellow-500", minF: "snowHumMin" as const, maxF: "snowHumMax" as const },
                { label: "Cloud cover (%)", color: "bg-slate-400", minF: "cloudMin" as const, maxF: "cloudMax" as const },
              ].map(({ label, color, minF, maxF }) => (
                <div key={minF}>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                    <span className={cn("inline-block w-2 h-2 rounded-full", color)} />{label}
                  </label>
                  <MinMaxInput minVal={filters[minF]} maxVal={filters[maxF]} onMinChange={set(minF)} onMaxChange={set(maxF)} />
                </div>
              ))}
            </div>
          </div>

          {/* Snow Type */}
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Snow Type</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" />Artificial snow</label>
                <Select value={filters.artificialSnow || "__any__"} onValueChange={sel("artificialSnow")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__any__">— Any —</SelectItem><SelectItem value="yes">Artificial</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-green-400" />Natural snow</label>
                <Select value={filters.naturalSnow || "__any__"} onValueChange={sel("naturalSnow")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__any__">— Any —</SelectItem>{NATURAL_SNOW_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-cyan-500" />Snow humidity type</label>
                <Select value={filters.snowHumidityType || "__any__"} onValueChange={sel("snowHumidityType")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__any__">— Any —</SelectItem>{SNOW_HUMIDITY_TYPE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-lime-500" />Grain size</label>
                <Select value={filters.grainSize || "__any__"} onValueChange={sel("grainSize")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__any__">— Any —</SelectItem>{GRAIN_SIZE_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Snow & Track */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Snow &amp; Track</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-orange-500" />Track hardness</label>
                <Select value={filters.trackHardness || "__any__"} onValueChange={sel("trackHardness")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="__any__">— Any —</SelectItem>{TRACK_HARDNESS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-500" />Precipitation</label>
                <Input placeholder="e.g. Light snow" value={filters.precipitation} onChange={(e) => set("precipitation")(e.target.value)} className="h-9 text-xs" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-pink-500" />Wind</label>
                <Input placeholder="e.g. Light NW" value={filters.wind} onChange={(e) => set("wind")(e.target.value)} className="h-9 text-xs" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5"><span className="inline-block w-2 h-2 rounded-full bg-pink-400" />Visibility</label>
                <Input placeholder="e.g. Good" value={filters.visibility} onChange={(e) => set("visibility")(e.target.value)} className="h-9 text-xs" />
              </div>
            </div>
          </div>
        </Card>

        {/* ─── Results ─────────────────────────────────────────────────────── */}
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
            {/* Match banner */}
            {hasFilters && (
              <div className={cn(
                "rounded-xl border px-4 py-2.5 text-xs font-medium",
                computed.usingFallback
                  ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : computed.matchCount >= 5
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                  : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
              )}>
                {computed.usingFallback
                  ? `⚠ No tests with matching weather found — showing results from all ${tests.length} tests (Low confidence)`
                  : `✓ ${computed.matchCount} test${computed.matchCount !== 1 ? "s" : ""} match these conditions (${nFilters} active filter${nFilters !== 1 ? "s" : ""})`
                }
              </div>
            )}

            {/* Glide + Structure */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Glide */}
              <Card className="fs-card rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/30">
                    <Target className="h-4 w-4 text-cyan-500" />
                  </div>
                  <h2 className="text-base font-semibold">Glide</h2>
                  {computed.glideProducts.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{computed.glideProducts.length} products</span>}
                </div>
                {computed.glideProducts.length === 0 ? (
                  <div className="text-center py-6"><Lightbulb className="mx-auto h-7 w-7 text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">No glide test data.</p></div>
                ) : (
                  <div className="space-y-2">
                    {computed.glideProducts.map((r, idx) => {
                      const p = productsById.get(r.productId);
                      if (!p) return null;
                      return <ProductRow key={r.productId} rank={idx + 1} productName={`${p.brand} ${p.name}`} result={r} />;
                    })}
                  </div>
                )}
                {computed.glideCombos.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-5 mb-3">
                      <TrendingUp className="h-4 w-4 text-violet-500" />
                      <h3 className="text-sm font-semibold">Best combinations</h3>
                      <span className="ml-auto text-xs text-muted-foreground">{computed.glideCombos.length} combos</span>
                    </div>
                    <div className="space-y-2">
                      {computed.glideCombos.map((c, idx) => (
                        <ComboRow key={`${c.product1Id}-${c.product2Id}`} rank={idx + 1} combo={c} productsById={productsById} />
                      ))}
                    </div>
                  </>
                )}
              </Card>

              {/* Structure */}
              <Card className="fs-card rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-900/30">
                    <Layers className="h-4 w-4 text-violet-500" />
                  </div>
                  <h2 className="text-base font-semibold">Structure</h2>
                  {computed.structureProducts.length > 0 && <span className="ml-auto text-xs text-muted-foreground">{computed.structureProducts.length} products</span>}
                </div>
                {computed.structureProducts.length === 0 ? (
                  <div className="text-center py-6"><Lightbulb className="mx-auto h-7 w-7 text-muted-foreground/30 mb-2" /><p className="text-sm text-muted-foreground">No structure test data.</p></div>
                ) : (
                  <div className="space-y-2">
                    {computed.structureProducts.map((r, idx) => {
                      const p = productsById.get(r.productId);
                      if (!p) return null;
                      return <ProductRow key={r.productId} rank={idx + 1} productName={`${p.brand} ${p.name}`} result={r} />;
                    })}
                  </div>
                )}
                {computed.structureCombos.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-5 mb-3">
                      <TrendingUp className="h-4 w-4 text-violet-500" />
                      <h3 className="text-sm font-semibold">Best combinations</h3>
                      <span className="ml-auto text-xs text-muted-foreground">{computed.structureCombos.length} combos</span>
                    </div>
                    <div className="space-y-2">
                      {computed.structureCombos.map((c, idx) => (
                        <ComboRow key={`${c.product1Id}-${c.product2Id}`} rank={idx + 1} combo={c} productsById={productsById} />
                      ))}
                    </div>
                  </>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
