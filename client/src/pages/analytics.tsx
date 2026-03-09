import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Thermometer, Award, Filter, Search, Trophy, Percent, Hash, FlaskConical, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  snowHumidityPct: number;
  airHumidityPct: number;
  artificialSnow: string | null;
  naturalSnow: string | null;
  snowHumidityType: string | null;
  testQuality: number | null;
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

function ProductSearchStats({
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

    return {
      totalTests: testsUsed.length,
      totalWins,
      avgRank,
      winRate,
      methodologyBreakdown,
      performanceOverTime,
      testResults,
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
              <CommandInput data-testid="input-product-search" placeholder="Search products…" />
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
        <div className="flex flex-col gap-4" data-testid="card-product-stats">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
              <Award className="h-4 w-4 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-avg-rank">{stats.avgRank ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Avg rank</div>
            </div>
            <div className="rounded-xl border p-3 text-center">
              <Percent className="h-4 w-4 mx-auto text-emerald-500 mb-1" />
              <div className="text-2xl font-bold" data-testid="text-product-win-rate">{stats.winRate}%</div>
              <div className="text-xs text-muted-foreground">Win rate</div>
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
            <div className="text-sm font-medium mb-2">Test history ({stats.testResults.length})</div>
            <div className="max-h-64 overflow-y-auto rounded-lg border" data-testid="list-product-test-history">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Date</th>
                    <th className="text-left px-3 py-2 font-medium">Location</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-center px-3 py-2 font-medium">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.testResults.map(({ test, rank }, i) => (
                    <tr key={`${test.id}-${i}`} className="border-t hover:bg-muted/30" data-testid={`row-product-test-${test.id}`}>
                      <td className="px-3 py-2">{test.date}</td>
                      <td className="px-3 py-2 truncate max-w-[120px]">{test.location}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-xs">{test.testType}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {rank !== null ? (
                          <span className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                            rank === 1 && "bg-amber-100 text-amber-700",
                            rank === 2 && "bg-gray-100 text-gray-700",
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
                  ))}
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [open, setOpen] = useState(false);

  const addProduct = (id: number) => {
    if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]);
    setOpen(false);
  };
  const removeProduct = (id: number) => setSelectedIds(selectedIds.filter((x) => x !== id));

  const compareStats = useMemo(() => {
    if (selectedIds.length < 2) return null;
    return selectedIds.map((id) => {
      const product = productsById.get(id)!;
      return getProductStats(id, product, allEntries, testsById, filteredTestIds);
    });
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
      .map((testId) => {
        const test = testsById.get(testId)!;
        const ranks = compareStats.map((s) => ({ product: s.product, rank: s.testRanks.get(testId) ?? null }));
        return { test, ranks };
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
              <CommandInput placeholder="Search products…" data-testid="input-compare-search" />
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
                          <td className="px-3 py-2">{test.date}</td>
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

export default function Analytics() {
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

  const [testTypeFilter, setTestTypeFilter] = useState<"All" | "Glide" | "Structure">("All");

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const testsById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);
  const weatherById = useMemo(() => new Map(weather.map((w) => [w.id, w])), [weather]);

  const filteredTests = useMemo(() => {
    if (testTypeFilter === "All") return tests;
    return tests.filter((t) => t.testType === testTypeFilter);
  }, [tests, testTypeFilter]);

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

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900" data-testid="text-analytics-title">
              Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Product performance trends and weather correlations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            {(["All", "Glide", "Structure"] as const).map((type) => (
              <Button
                key={type}
                variant={testTypeFilter === type ? "default" : "outline"}
                size="sm"
                onClick={() => setTestTypeFilter(type)}
                data-testid={`button-filter-${type.toLowerCase()}`}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>

        <ProductSearchStats
          products={products}
          tests={tests}
          allEntries={allEntries}
          productsById={productsById}
          testsById={testsById}
        />

        <ProductCompare
          products={products}
          allEntries={allEntries}
          productsById={productsById}
          testsById={testsById}
          filteredTestIds={filteredTestIds}
        />

        {!hasData ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground" data-testid="empty-analytics">No test data to analyze yet. Create some tests to see trends.</p>
          </Card>
        ) : (
          <>
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
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {productWinTrendKeys.map((key, i) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50">
                    <Award className="h-4 w-4 text-blue-600" />
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
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: string) => {
                          if (name === "avgRank") return [value, "Avg Rank"];
                          return [value, name];
                        }}
                      />
                      <Bar dataKey="avgRank" radius={[0, 6, 6, 0]}>
                        {avgRankByProduct.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
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
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          fontSize: "12px",
                        }}
                      />
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
                    <XAxis
                      dataKey="snowTemp"
                      name="Snow Temp"
                      unit="°C"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <YAxis
                      dataKey="avgRank"
                      name="Rank"
                      reversed
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        fontSize: "12px",
                      }}
                      formatter={(value: any, name: string) => [value, name]}
                      labelFormatter={() => ""}
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
                      {tempVsRank.map((point, i) => (
                        <Cell key={i} fill={point.color} />
                      ))}
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
      </div>
    </AppShell>
  );
}
