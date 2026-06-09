// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { Fragment, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  History,
  Thermometer,
  Snowflake,
  Droplets,
  FlaskConical,
  Trophy,
  TrendingUp,
  Flag,
  MapPin,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn, fmtDate } from "@/lib/utils";
import { parseApplication } from "@/lib/parse-application";
import { useI18n } from "@/lib/i18n";

// ─── Types ────────────────────────────────────────────────────────────────────

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
  createdAt: string;
  createdById: number;
  createdByName: string;
  groupScope: string;
  stockQuantity: number;
  archivedAt?: string | null;
};

type ProductTest = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  notes: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  weather: {
    airTemperatureC: number;
    snowTemperatureC: number;
    airHumidityPct: number | null;
    snowHumidityPct: number | null;
    snowType: string | null;
    artificialSnow: string | null;
    naturalSnow: string | null;
    grainSize: string | null;
    snowHumidityType: string | null;
    trackHardness: string | null;
    testQuality: number | null;
    wind: string | null;
    clouds: number | null;
    precipitation: string | null;
  } | null;
  entries: {
    id: number;
    skiNumber: number;
    productId: number | null;
    additionalProductIds: string | null;
    productBrand: string | null;
    productName: string | null;
    additionalProducts: { id: number; brand: string; name: string }[];
    result0kmCmBehind: number | null;
    rank0km: number | null;
    resultXkmCmBehind: number | null;
    rankXkm: number | null;
    results: string | null;
    feelingRank: number | null;
    isSelectedProduct: boolean;
    methodology: string | null;  // pipe-separated applications
  }[];
};

type RacePrep = {
  id: number;
  date: string;
  startTime: string | null;
  location: string;
  raceType: string;
  discipline: string;
  method: string | null;
  notes: string | null;
  tette: string | null;
  weatherId: number | null;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  airHumidityPct: number | null;
  snowType: string | null;
  trackHardness: string | null;
  artificialSnow: string | null;
  createdByName: string;
  roles: string[]; // "glide" | "structure" | "kick"
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function categoryBadgeClass(cat: string) {
  if (cat === "Glide product") return "fs-badge-glide";
  if (cat === "Topping product") return "fs-badge-topping";
  return "fs-badge-structure";
}

function getDistLabels(test: ProductTest): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
  return labels;
}

function getRounds(
  entry: ProductTest["entries"][number],
  numRounds: number,
): { result: number | null; rank: number | null }[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const r: { result: number | null; rank: number | null }[] = [
    { result: entry.result0kmCmBehind, rank: entry.rank0km },
  ];
  if (numRounds > 1) r.push({ result: entry.resultXkmCmBehind ?? null, rank: entry.rankXkm ?? null });
  while (r.length < numRounds) r.push({ result: null, rank: null });
  return r;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full px-1 py-0.5 text-[10px] font-bold",
        rank === 1 && "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-slate-300/20 text-slate-500 ring-1 ring-slate-300/30",
        rank === 3 && "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="fs-card rounded-2xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ProductDetailInner() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, params] = useRoute("/products/:id");
  const productId = params?.id ? parseInt(params.id, 10) : null;

  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const { data: archivedProducts = [] } = useQuery<Product[]>({
    queryKey: ["/api/products/archived"],
    enabled: productId != null && allProducts.length > 0 && !allProducts.find((p) => p.id === productId),
  });

  const product = allProducts.find((p) => p.id === productId)
    ?? archivedProducts.find((p) => p.id === productId)
    ?? null;
  const isArchived = !!product?.archivedAt;

  const { data, isLoading } = useQuery<{ tests: ProductTest[] }>({
    queryKey: [`/api/products/${productId}/tests`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/tests`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load test history");
      return res.json();
    },
    enabled: productId != null,
  });

  const { data: racePreps = [] } = useQuery<RacePrep[]>({
    queryKey: [`/api/products/${productId}/race-preps`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/race-preps`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load race history");
      return res.json();
    },
    enabled: productId != null,
  });

  const tests = data?.tests ?? [];

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let wins = 0;
    const ranks: number[] = [];
    let glideCount = 0;
    let structureCount = 0;

    for (const test of tests) {
      const isStructure =
        test.testType === "Structure" ||
        test.testType === "Structure tool" ||
        test.testType?.toLowerCase().includes("structure");

      for (const entry of test.entries) {
        if (!entry.isSelectedProduct) continue;

        // Count test type from entry perspective
        if (isStructure) {
          structureCount++;
        } else {
          glideCount++;
        }

        // Collect all non-null ranks across all rounds
        const distLabels = getDistLabels(test);
        const rounds = getRounds(entry, distLabels.length);
        for (const r of rounds) {
          if (r.rank != null) {
            ranks.push(r.rank);
            if (r.rank === 1) wins++;
          }
        }
      }
    }

    const avgRank =
      ranks.length > 0
        ? (ranks.reduce((acc, r) => acc + r, 0) / ranks.length).toFixed(1)
        : null;

    return { wins, avgRank, glideCount, structureCount, totalTests: tests.length };
  }, [tests]);

  // ── Application analytics ────────────────────────────────────────────────
  const appStats = useMemo(() => {
    const map = new Map<string, { count: number; ranks: number[]; temps: number[]; snowTypes: string[] }>();
    for (const test of tests) {
      for (const entry of test.entries) {
        if (!entry.methodology || !entry.isSelectedProduct) continue;
        const primaryApp = entry.methodology.split('|')[0].trim();
        if (!primaryApp) continue;
        const parsed = parseApplication(primaryApp);
        const key = parsed.interpreted || primaryApp;
        if (!map.has(key)) map.set(key, { count: 0, ranks: [], temps: [], snowTypes: [] });
        const stat = map.get(key)!;
        stat.count++;
        if (entry.rank0km != null) stat.ranks.push(entry.rank0km);
        if (test.weather?.airTemperatureC != null) stat.temps.push(test.weather.airTemperatureC);
        if (test.weather?.snowType) stat.snowTypes.push(test.weather.snowType);
      }
    }
    return Array.from(map.entries())
      .map(([key, val]) => ({
        application: key,
        count: val.count,
        avgRank: val.ranks.length > 0 ? val.ranks.reduce((a, b) => a + b, 0) / val.ranks.length : null,
        bestRank: val.ranks.length > 0 ? Math.min(...val.ranks) : null,
        avgTemp: val.temps.length > 0 ? val.temps.reduce((a, b) => a + b, 0) / val.temps.length : null,
        commonSnow: val.snowTypes.length > 0
          ? val.snowTypes.sort((a, b) =>
              val.snowTypes.filter(x => x === b).length - val.snowTypes.filter(x => x === a).length
            )[0]
          : null,
      }))
      .filter(s => s.count > 0)
      .sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99));
  }, [tests]);

  // ── Not found ─────────────────────────────────────────────────────────────
  const allProductsLoaded = allProducts.length > 0 || archivedProducts.length > 0;
  if (!isLoading && productId != null && allProductsLoaded && !product) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20">
          <p className="text-muted-foreground">{L("Fant ikke produktet.", "Product not found.")}</p>
          <AppLink href="/products">
            <Button variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {L("Tilbake til produkter", "Back to Products")}
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  const groups = product?.groupScope
    ? product.groupScope.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        {/* ── Back button ─────────────────────────────────────────────────── */}
        <div>
          <AppLink href="/products" testId="link-back-products">
            <Button variant="ghost" size="sm" data-testid="button-back-products">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Products
            </Button>
          </AppLink>

          {/* ── Product header ────────────────────────────────────────────── */}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {product && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  categoryBadgeClass(product.category),
                )}
                data-testid="badge-product-category"
              >
                {product.category}
              </span>
            )}
            {isArchived && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-700">
                {L("Arkivert", "Archived")}
              </span>
            )}
            <h1
              className="text-2xl sm:text-3xl font-bold"
              data-testid="text-product-title"
            >
              {product ? `${product.brand} ${product.name}` : L("Laster…", "Loading…")}
            </h1>
          </div>

          {product && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {groups.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                  data-testid={`badge-group-${g}`}
                >
                  {g}
                </span>
              ))}
              {product.createdByName && (
                <span className="text-xs text-muted-foreground">
                  {L("Lagt til av", "Added by")} {product.createdByName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" data-testid="stats-row">
          <StatCard
            icon={<FlaskConical className="h-3.5 w-3.5" />}
            label={L("Totalt antall tester", "Total tests")}
            value={stats.totalTests}
          />
          <StatCard
            icon={<Trophy className="h-3.5 w-3.5 text-yellow-500" />}
            label={L("Førsteplasser", "#1 finishes")}
            value={stats.wins}
            sub={L("runder med rang = 1", "rounds where rank = 1")}
          />
          <StatCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={L("Snittrang", "Avg rank")}
            value={stats.avgRank ?? "—"}
            sub={stats.avgRank ? L("på tvers av alle rangerte runder", "across all ranked rounds") : L("ingen rangerte runder ennå", "no ranked rounds yet")}
          />
          <StatCard
            icon={<History className="h-3.5 w-3.5" />}
            label={L("Testtyper", "Test types")}
            value={`${stats.glideCount}G / ${stats.structureCount}S`}
            sub={L("glid / struktur-oppføringer", "glide / structure entries")}
          />
          <StatCard
            icon={<Flag className="h-3.5 w-3.5 text-rose-500" />}
            label={L("Antall ganger racet", "Times raced")}
            value={racePreps.length}
            sub={racePreps.length > 0 ? L(`sist: ${racePreps[0].location}`, `last: ${racePreps[0].location}`) : L("ikke brukt i noen raceprep", "not used in any race prep")}
          />
        </div>

        {/* ── Test history ────────────────────────────────────────────────── */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {L("Testhistorikk", "Test History")}
          </h2>

          {isLoading ? (
            <Card className="fs-card rounded-2xl p-8 text-center text-sm text-muted-foreground" data-testid="loading-history">
              {L("Laster testhistorikk…", "Loading test history…")}
            </Card>
          ) : tests.length === 0 ? (
            <Card className="fs-card rounded-2xl p-10 flex flex-col items-center gap-2 text-center" data-testid="empty-history">
              <FlaskConical className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{L("Ingen tester funnet for dette produktet.", "No tests found for this product.")}</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                {tests.length} {tests.length !== 1 ? L("tester", "tests") : L("test", "test")} {L("funnet", "found")}
              </p>

              {tests.map((test) => {
                const distLabels = getDistLabels(test);

                return (
                  <Card
                    key={test.id}
                    className="fs-card rounded-xl p-3 sm:p-4"
                    data-testid={`card-product-test-${test.id}`}
                  >
                    {/* Test header */}
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AppLink href={`/tests/${test.id}`} testId={`link-product-test-${test.id}`}>
                          <span className="font-semibold text-sm hover:text-amber-600 transition-colors cursor-pointer">
                            {test.location}
                          </span>
                        </AppLink>
                        <span className="text-xs text-muted-foreground">{fmtDate(test.date)}</span>
                        {test.testName && (
                          <span className="text-xs text-muted-foreground italic">
                            "{test.testName}"
                          </span>
                        )}
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {test.testType}
                        </span>
                      </div>
                    </div>

                    {/* Weather chips */}
                    {test.weather && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800">
                          <Thermometer className="h-2.5 w-2.5" />
                          {L("Luft", "Air")} {test.weather.airTemperatureC}°C
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800">
                          <Snowflake className="h-2.5 w-2.5" />
                          {L("Snø", "Snow")} {test.weather.snowTemperatureC}°C
                        </span>
                        {test.weather.airHumidityPct != null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:ring-violet-800">
                            <Droplets className="h-2.5 w-2.5" />
                            {test.weather.airHumidityPct}% RH
                          </span>
                        )}
                        {test.weather.artificialSnow && (
                          <span className="inline-flex rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-700 ring-1 ring-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:ring-pink-800">
                            {L("Kunst:", "Art:")} {test.weather.artificialSnow}
                          </span>
                        )}
                        {test.weather.naturalSnow && (
                          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-800">
                            {L("Natur:", "Nat:")} {test.weather.naturalSnow}
                          </span>
                        )}
                        {test.weather.snowHumidityType && (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {test.weather.snowHumidityType}
                          </span>
                        )}
                        {test.weather.trackHardness && (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {test.weather.trackHardness}
                          </span>
                        )}
                        {test.weather.wind && (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {L("Vind:", "Wind:")} {test.weather.wind}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {test.notes && (
                      <p className="mb-2 text-xs text-muted-foreground italic truncate">
                        {test.notes}
                      </p>
                    )}

                    {/* Entries table */}
                    {test.entries.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs" data-testid={`table-product-test-${test.id}`}>
                          <thead>
                            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                              <th className="pb-1.5 pr-3">{L("Ski", "Ski")}</th>
                              <th className="pb-1.5 pr-3">{L("Produkt", "Product")}</th>
                              {distLabels.map((label, i) => (
                                <th key={i} className="pb-1.5 pr-3">
                                  {label} / {L("Rang", "Rank")}
                                </th>
                              ))}
                              <th className="pb-1.5">{L("Følelse", "Feel")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {test.entries.map((e) => {
                              const rounds = getRounds(e, distLabels.length);

                              return (
                                <tr
                                  key={e.id}
                                  className={cn(
                                    "border-b border-border/20 last:border-0",
                                    e.isSelectedProduct && "bg-yellow-500/10",
                                  )}
                                  data-testid={`row-product-entry-${e.id}`}
                                >
                                  {/* Ski number */}
                                  <td
                                    className={cn(
                                      "py-1.5 pr-3 font-bold text-xs",
                                      e.isSelectedProduct && "text-yellow-600",
                                    )}
                                  >
                                    {e.skiNumber}
                                  </td>

                                  {/* Product label(s) */}
                                  <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                                    {(() => {
                                      const all: { id: number | null; label: string }[] = [];
                                      if (e.productId != null && e.productBrand) {
                                        all.push({
                                          id: e.productId,
                                          label: `${e.productBrand} ${e.productName ?? ""}`.trim(),
                                        });
                                      }
                                      for (const ap of e.additionalProducts ?? []) {
                                        all.push({
                                          id: ap.id,
                                          label: `${ap.brand} ${ap.name}`.trim(),
                                        });
                                      }
                                      if (all.length === 0) return <span>—</span>;
                                      return (
                                        <span className="flex flex-wrap items-center gap-0.5">
                                          {all.map((p, i) => {
                                            const isViewed = p.id === productId;
                                            return (
                                              <Fragment key={i}>
                                                {i > 0 && (
                                                  <span className="text-muted-foreground/50 mx-0.5">
                                                    +
                                                  </span>
                                                )}
                                                <span
                                                  className={
                                                    isViewed
                                                      ? "font-semibold text-yellow-700 dark:text-yellow-400"
                                                      : ""
                                                  }
                                                >
                                                  {p.label}
                                                </span>
                                              </Fragment>
                                            );
                                          })}
                                        </span>
                                      );
                                    })()}
                                  </td>

                                  {/* Round results */}
                                  {rounds.map((r, i) => (
                                    <td key={i} className="py-1.5 pr-3">
                                      <div className="flex items-center gap-1">
                                        <span className="tabular-nums">{r.result ?? "—"}</span>
                                        {r.rank != null && <RankBadge rank={r.rank} />}
                                      </div>
                                    </td>
                                  ))}

                                  {/* Feeling rank */}
                                  <td className="py-1.5 text-muted-foreground">
                                    {e.feelingRank ?? "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* APPLICATION ANALYTICS */}
          {appStats.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {L("Applikasjonsinnsikt", "Application Insights")}
              </h2>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">{L("Applikasjon", "Application")}</th>
                        <th className="px-4 py-2 font-medium text-center">{L("Antall", "Count")}</th>
                        <th className="px-4 py-2 font-medium text-center">{L("Snittrang", "Avg Rank")}</th>
                        <th className="px-4 py-2 font-medium text-center">{L("Beste rang", "Best Rank")}</th>
                        <th className="px-4 py-2 font-medium">{L("Typiske forhold", "Typical Conditions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appStats.map((s, i) => (
                        <tr key={i} className={cn("border-b last:border-0", i % 2 === 0 ? "bg-card" : "bg-muted/20")}>
                          <td className="px-4 py-2 font-medium">{s.application}</td>
                          <td className="px-4 py-2 text-center tabular-nums">{s.count}</td>
                          <td className="px-4 py-2 text-center tabular-nums">
                            {s.avgRank != null ? s.avgRank.toFixed(1) : "—"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {s.bestRank != null ? <RankBadge rank={s.bestRank} /> : "—"}
                          </td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">
                            {[
                              s.avgTemp != null ? `${s.avgTemp.toFixed(1)}°C` : null,
                              s.commonSnow,
                            ].filter(Boolean).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* ── Race Prep History ────────────────────────────────────────────── */}
        {racePreps.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {L("Raceprep-historikk", "Race Prep History")} — {racePreps.length} {racePreps.length !== 1 ? L("race", "races") : L("race", "race")}
            </h2>
            <Card className="fs-card rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2.5 font-medium">{L("Dato", "Date")}</th>
                      <th className="px-4 py-2.5 font-medium">{L("Sted", "Location")}</th>
                      <th className="px-4 py-2.5 font-medium">{L("Stilart", "Discipline")}</th>
                      <th className="px-4 py-2.5 font-medium">{L("Rolle", "Role")}</th>
                      <th className="px-4 py-2.5 font-medium">{L("Metode", "Method")}</th>
                      <th className="px-4 py-2.5 font-medium">{L("Forhold", "Conditions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {racePreps.map((rp) => (
                      <tr key={rp.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                          {new Date(rp.date).toLocaleDateString()}
                          {rp.startTime && <span className="ml-1 text-muted-foreground">{rp.startTime}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 text-xs font-medium">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            {rp.location}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{rp.raceType}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">{rp.discipline}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {rp.roles.map((role) => (
                              <span key={role} className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                                role === "glide" ? "fs-badge-glide" :
                                role === "structure" ? "fs-badge-structure" :
                                "fs-badge-topping"
                              )}>{role}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">
                          {rp.method || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {rp.airTemperatureC != null && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-900/20 px-2 py-0.5 text-[10px] text-sky-700 dark:text-sky-300">
                                <Thermometer className="h-2.5 w-2.5" />{rp.airTemperatureC}°C
                              </span>
                            )}
                            {rp.snowTemperatureC != null && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                                <Snowflake className="h-2.5 w-2.5" />{rp.snowTemperatureC}°C
                              </span>
                            )}
                            {rp.snowType && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{rp.snowType}</span>
                            )}
                            {rp.trackHardness && (
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{rp.trackHardness}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ProductDetail() {
  return (
    <ErrorBoundary label="Product Detail">
      <ProductDetailInner />
    </ErrorBoundary>
  );
}
