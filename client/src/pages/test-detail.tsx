import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Eye } from "lucide-react";
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

          <h1 className="mt-2 text-2xl sm:text-3xl" data-testid="text-test-title">
            {test.location} — {test.date}
          </h1>
        </div>

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-metadata">
          <h2 className="mb-3 text-lg font-semibold">Test Details</h2>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Date:</dt>
              <dd data-testid="text-test-date">{test.date}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Location:</dt>
              <dd data-testid="text-test-location">{test.location}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Test Type:</dt>
              <dd data-testid="text-test-type">{test.testType}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Series:</dt>
              <dd data-testid="text-test-series">{seriesById.get(test.seriesId) ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Created By:</dt>
              <dd data-testid="text-test-created-by">{test.createdByName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Group:</dt>
              <dd data-testid="text-test-group">{test.groupScope}</dd>
            </div>
            {test.notes && (
              <div className="flex gap-2 sm:col-span-2">
                <dt className="text-muted-foreground">Notes:</dt>
                <dd data-testid="text-test-notes">{test.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        {weather && (
          <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-weather">
            <h2 className="mb-3 text-lg font-semibold">Weather Conditions</h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Air Temp:</dt>
                <dd data-testid="text-weather-air-temp">{weather.airTemperatureC}°C</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Snow Temp:</dt>
                <dd data-testid="text-weather-snow-temp">{weather.snowTemperatureC}°C</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Air Humidity:</dt>
                <dd data-testid="text-weather-air-humidity">{weather.airHumidityPct}%</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Snow Humidity:</dt>
                <dd data-testid="text-weather-snow-humidity">{weather.snowHumidityPct}%</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Snow Type:</dt>
                <dd data-testid="text-weather-snow-type">{weather.snowType}</dd>
              </div>
            </dl>
          </Card>
        )}

        <Card className="fs-card rounded-2xl p-4 sm:p-6" data-testid="card-test-results">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Results</h2>
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
          {sortedEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="empty-entries">
              No entries recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-results">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3">Rank</th>
                    <th className="pb-2 pr-3">Ski No.</th>
                    {!hideDetails && <th className="pb-2 pr-3">Product</th>}
                    {!hideDetails && <th className="pb-2 pr-3">Method</th>}
                    <th className="pb-2 pr-3">Result 0km (cm)</th>
                    <th className="pb-2 pr-3">Result Xkm (cm)</th>
                    <th className="pb-2">Rank Xkm</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry) => {
                    const product = entry.productId
                      ? productsById.get(entry.productId)
                      : null;

                    return (
                      <tr
                        key={entry.id}
                        data-testid={`row-entry-${entry.id}`}
                        className={cn(
                          "border-b last:border-0",
                          entry.rank0km === 1 &&
                            "bg-emerald-500/10 text-emerald-200",
                          entry.rank0km === 2 &&
                            "bg-sky-500/10 text-sky-200",
                          entry.rank0km === 3 &&
                            "bg-indigo-500/10 text-indigo-200",
                        )}
                      >
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            {entry.rank0km ?? "—"}
                            {entry.rank0km === 1 && (
                              <span
                                className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400"
                                data-testid={`badge-winner-${entry.id}`}
                              >
                                Winner
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-3" data-testid={`text-ski-number-${entry.id}`}>
                          {entry.skiNumber}
                        </td>
                        {!hideDetails && (
                          <td className="py-2 pr-3" data-testid={`text-product-${entry.id}`}>
                            {product
                              ? `${product.brand} ${product.name}`
                              : "—"}
                          </td>
                        )}
                        {!hideDetails && (
                          <td className="py-2 pr-3" data-testid={`text-method-${entry.id}`}>
                            {entry.methodology}
                          </td>
                        )}
                        <td className="py-2 pr-3" data-testid={`text-result0km-${entry.id}`}>
                          {entry.result0kmCmBehind ?? "—"}
                        </td>
                        <td className="py-2 pr-3" data-testid={`text-resultXkm-${entry.id}`}>
                          {entry.resultXkmCmBehind ?? "—"}
                        </td>
                        <td className="py-2" data-testid={`text-rankXkm-${entry.id}`}>
                          {entry.rankXkm ?? "—"}
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
