import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Eye, Download, MapPin, Calendar, Thermometer, Droplets, Snowflake, Award, FlaskConical } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

type Series = {
  id: number;
  name: string;
};

type Weather = {
  id: number;
  date: string;
  time: string;
  location: string;
  airTemperatureC: number;
  airHumidityPct: number;
  snowTemperatureC: number;
  snowHumidityPct: number;
  snowType: string;
};

function RankBadge({ rank, size = "sm" }: { rank: number | null; size?: "sm" | "lg" }) {
  const sizeClass = size === "lg" ? "min-w-12 px-3 py-1.5 text-sm" : "min-w-8 px-2 py-0.5 text-xs";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold",
        sizeClass,
        rank === 1 && "bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 text-emerald-400 ring-1 ring-emerald-500/30",
        rank === 2 && "bg-gradient-to-r from-sky-500/20 to-sky-400/10 text-sky-400 ring-1 ring-sky-500/30",
        rank === 3 && "bg-gradient-to-r from-amber-500/20 to-amber-400/10 text-amber-400 ring-1 ring-amber-500/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

export default function TestDetail() {
  const [, params] = useRoute("/tests/:id");
  const id = params?.id;
  const [hideDetails, setHideDetails] = useState(false);

  const { data: test, isLoading: testLoading } = useQuery<Test>({
    queryKey: [`/api/tests/${id}`],
    enabled: !!id,
  });

  const { data: entries = [] } = useQuery<TestEntry[]>({
    queryKey: [`/api/tests/${id}/entries`],
    enabled: !!id,
  });

  const { data: series = [] } = useQuery<Series[]>({
    queryKey: ["/api/series"],
  });

  const { data: weatherList = [] } = useQuery<Weather[]>({
    queryKey: ["/api/weather"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));
  const productsById = new Map(products.map((p) => [p.id, p] as const));

  const weather = test?.weatherId
    ? weatherList.find((w) => w.id === test.weatherId)
    : null;

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.rank0km == null && b.rank0km == null) return 0;
    if (a.rank0km == null) return 1;
    if (b.rank0km == null) return -1;
    return a.rank0km - b.rank0km;
  });

  if (testLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-test">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (!test) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-test">
          <p className="text-muted-foreground">Test not found.</p>
          <AppLink href="/tests">
            <Button variant="secondary" data-testid="button-back-tests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to tests
            </Button>
          </AppLink>
        </div>
      </AppShell>
    );
  }

  const testTypeBadgeClass = test.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure";

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <AppLink href="/tests" testId="link-back-tests">
            <Button variant="ghost" size="sm" data-testid="button-back-tests">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to tests
            </Button>
          </AppLink>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl" data-testid="text-test-title">
              {test.location}
            </h1>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", testTypeBadgeClass)} data-testid="badge-test-type">
              {test.testType}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{test.date} · {seriesById.get(test.seriesId) ?? "Series"} · {test.groupScope}</p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-metadata">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold">Test Details</h2>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <Calendar className="h-4 w-4 text-primary/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Date</div>
                  <div className="text-sm font-medium" data-testid="text-test-date">{test.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-background/40 px-3 py-2.5">
                <MapPin className="h-4 w-4 text-emerald-400/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</div>
                  <div className="text-sm font-medium" data-testid="text-test-location">{test.location}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Series</div>
                  <div className="text-sm font-medium" data-testid="text-test-series">{seriesById.get(test.seriesId) ?? "—"}</div>
                </div>
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Created By</div>
                  <div className="text-sm font-medium" data-testid="text-test-created-by">{test.createdByName}</div>
                </div>
              </div>
              {test.notes && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Notes</div>
                  <div className="text-sm" data-testid="text-test-notes">{test.notes}</div>
                </div>
              )}
            </div>
          </Card>

          {weather && (
            <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-test-weather">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10">
                  <Snowflake className="h-4 w-4 text-sky-400" />
                </div>
                <h2 className="text-base font-semibold">Weather Conditions</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl fs-gradient-blue px-3 py-3 ring-1 ring-sky-500/10">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sky-300/70">
                    <Thermometer className="h-3 w-3" />
                    Air Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-sky-300" data-testid="text-weather-air-temp">{weather.airTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-emerald px-3 py-3 ring-1 ring-emerald-500/10">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-300/70">
                    <Thermometer className="h-3 w-3" />
                    Snow Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-300" data-testid="text-weather-snow-temp">{weather.snowTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-violet px-3 py-3 ring-1 ring-violet-500/10">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-300/70">
                    <Droplets className="h-3 w-3" />
                    Air Humidity
                  </div>
                  <div className="mt-1 text-lg font-bold text-violet-300" data-testid="text-weather-air-humidity">{weather.airHumidityPct}%</div>
                </div>
                <div className="rounded-xl fs-gradient-amber px-3 py-3 ring-1 ring-amber-500/10">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300/70">
                    <Droplets className="h-3 w-3" />
                    Snow Humidity
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-300" data-testid="text-weather-snow-humidity">{weather.snowHumidityPct}%</div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-background/40 px-3 py-2.5">
                <Snowflake className="h-4 w-4 text-sky-400/60" />
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Snow Type</div>
                  <div className="text-sm font-medium" data-testid="text-weather-snow-type">{weather.snowType}</div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-results">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                <Award className="h-4 w-4 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold">Results</h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">{sortedEntries.length} entries</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="button-export-csv"
                onClick={() => {
                  const headers = ["Rank", "Ski No.", "Product", "Method", "Result 0km (cm)", "Result Xkm (cm)", "Rank Xkm"];
                  const rows = sortedEntries.map((entry) => {
                    const prod = entry.productId ? productsById.get(entry.productId) : null;
                    return [
                      entry.rank0km ?? "",
                      entry.skiNumber,
                      prod ? `${prod.brand} ${prod.name}` : "",
                      entry.methodology,
                      entry.result0kmCmBehind ?? "",
                      entry.resultXkmCmBehind ?? "",
                      entry.rankXkm ?? "",
                    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
                  });
                  const csv = [headers.join(","), ...rows].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `test-${test.location}-${test.date}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-toggle-hide"
                onClick={() => setHideDetails((v) => !v)}
              >
                {hideDetails ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                {hideDetails ? "Show" : "Hide"}
              </Button>
            </div>
          </div>
          {sortedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-entries">
              No entries recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-results">
                <thead>
                  <tr className="border-b border-border/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-3">Rank</th>
                    <th className="pb-3 pr-3">Ski</th>
                    {!hideDetails && <th className="pb-3 pr-3">Product</th>}
                    {!hideDetails && <th className="pb-3 pr-3">Method</th>}
                    <th className="pb-3 pr-3">0km (cm)</th>
                    <th className="pb-3 pr-3">Xkm (cm)</th>
                    <th className="pb-3">Rank Xkm</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const product = entry.productId
                      ? productsById.get(entry.productId)
                      : null;

                    return (
                      <tr
                        key={entry.id}
                        data-testid={`row-entry-${entry.id}`}
                        className={cn(
                          "border-b border-border/30 last:border-0 transition-colors",
                          entry.rank0km === 1 && "bg-emerald-500/8",
                          entry.rank0km === 2 && "bg-sky-500/8",
                          entry.rank0km === 3 && "bg-amber-500/8",
                          idx % 2 === 0 && !entry.rank0km && "bg-background/20",
                        )}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <RankBadge rank={entry.rank0km} size="lg" />
                            {entry.rank0km === 1 && (
                              <span
                                className="rounded-full bg-gradient-to-r from-emerald-500/20 to-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30"
                                data-testid={`badge-winner-${entry.id}`}
                              >
                                Winner
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3" data-testid={`text-ski-number-${entry.id}`}>
                          <span className="inline-flex h-8 w-10 items-center justify-center rounded-lg bg-background/50 text-sm font-semibold ring-1 ring-border/50">
                            {entry.skiNumber}
                          </span>
                        </td>
                        {!hideDetails && (
                          <td className="py-3 pr-3" data-testid={`text-product-${entry.id}`}>
                            {product
                              ? `${product.brand} ${product.name}`
                              : "—"}
                          </td>
                        )}
                        {!hideDetails && (
                          <td className="py-3 pr-3 text-muted-foreground" data-testid={`text-method-${entry.id}`}>
                            {entry.methodology || "—"}
                          </td>
                        )}
                        <td className="py-3 pr-3 font-mono text-sm" data-testid={`text-result0km-${entry.id}`}>
                          {entry.result0kmCmBehind ?? "—"}
                        </td>
                        <td className="py-3 pr-3 font-mono text-sm" data-testid={`text-resultXkm-${entry.id}`}>
                          {entry.resultXkmCmBehind ?? "—"}
                        </td>
                        <td className="py-3" data-testid={`text-rankXkm-${entry.id}`}>
                          <RankBadge rank={entry.rankXkm} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
