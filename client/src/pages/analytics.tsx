import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Thermometer, Award, Filter } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
            <h1 className="text-2xl sm:text-3xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text" data-testid="text-analytics-title">
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

        {!hasData ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-muted-foreground" data-testid="empty-analytics">No test data to analyze yet. Create some tests to see trends.</p>
          </Card>
        ) : (
          <>
            <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-chart-wins-trend">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10">
                    <Award className="h-4 w-4 text-blue-400" />
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
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/10">
                    <BarChart3 className="h-4 w-4 text-violet-400" />
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
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10">
                  <Thermometer className="h-4 w-4 text-amber-400" />
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
