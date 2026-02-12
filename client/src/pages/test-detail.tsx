import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, EyeOff, Eye, Download, MapPin, Calendar, Thermometer, Droplets, Snowflake, Award, FlaskConical, Pencil, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
  distanceLabels: string | null;
  createdAt: string;
  createdByName: string;
  groupScope: string;
};

type TestEntry = {
  id: number;
  testId: number;
  skiNumber: number;
  productId: number | null;
  additionalProductIds: string | null;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
  results: string | null;
  feelingRank: number | null;
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
  snowTemperatureC: number;
  airTemperatureC: number;
  snowHumidityPct: number;
  airHumidityPct: number;
  clouds: number | null;
  visibility: string | null;
  wind: string | null;
  precipitation: string | null;
  artificialSnow: string | null;
  naturalSnow: string | null;
  grainSize: string | null;
  snowHumidityType: string | null;
  trackHardness: string | null;
  testQuality: number | null;
  snowType: string | null;
};

type RoundResult = { result: number | null; rank: number | null };

function getDistanceLabels(test: Test): string[] {
  if (test.distanceLabels) {
    try {
      const parsed = JSON.parse(test.distanceLabels);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  const labels: string[] = [test.distanceLabel0km || "0 km"];
  if (test.distanceLabelXkm) {
    labels.push(test.distanceLabelXkm);
  }
  return labels;
}

function getEntryRounds(entry: TestEntry, numRounds: number): RoundResult[] {
  if (entry.results) {
    try {
      const parsed = JSON.parse(entry.results);
      if (Array.isArray(parsed)) {
        while (parsed.length < numRounds) parsed.push({ result: null, rank: null });
        return parsed.slice(0, numRounds);
      }
    } catch {}
  }
  const results: RoundResult[] = [
    { result: entry.result0kmCmBehind, rank: entry.rank0km },
  ];
  if (numRounds > 1) {
    results.push({ result: entry.resultXkmCmBehind, rank: entry.rankXkm });
  }
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tests"] });
      toast({ title: "Test deleted" });
      setLocation("/tests");
    },
    onError: (e) => {
      toast({
        title: "Could not delete test",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

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

  const distLabels = test ? getDistanceLabels(test) : ["0 km"];

  const sortedEntries = [...entries].sort((a, b) => {
    const aRounds = getEntryRounds(a, distLabels.length);
    const bRounds = getEntryRounds(b, distLabels.length);
    const aRank = aRounds[0]?.rank;
    const bRank = bRounds[0]?.rank;
    if (aRank == null && bRank == null) return 0;
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    return aRank - bRank;
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
          <div className="flex items-center justify-between">
            <AppLink href="/tests" testId="link-back-tests">
              <Button variant="ghost" size="sm" data-testid="button-back-tests">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to tests
              </Button>
            </AppLink>
            <div className="flex items-center gap-2">
              <AppLink href={`/tests/${id}/edit`} testId="link-edit-test">
                <Button variant="outline" size="sm" data-testid="button-edit-test">
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </AppLink>
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" data-testid="button-delete-test">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this test?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the test "{test.location}" ({test.date}) and all its entries. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => deleteMutation.mutate()}
                      data-testid="button-confirm-delete-test"
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

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
              {distLabels.length > 0 && (
                <div className="rounded-xl bg-background/40 px-3 py-2.5">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Rounds</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {distLabels.map((label, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {label || `Round ${i + 1}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
                {weather.testQuality != null && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300 ring-1 ring-amber-500/20">
                    Quality {weather.testQuality}/10
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl fs-gradient-emerald px-3 py-3 ring-1 ring-emerald-500/10" data-testid="text-weather-snow-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-emerald-300/70">
                    <Thermometer className="h-3 w-3" /> Snow Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-emerald-300">{weather.snowTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-blue px-3 py-3 ring-1 ring-sky-500/10" data-testid="text-weather-air-temp">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-sky-300/70">
                    <Thermometer className="h-3 w-3" /> Air Temp
                  </div>
                  <div className="mt-1 text-lg font-bold text-sky-300">{weather.airTemperatureC}°C</div>
                </div>
                <div className="rounded-xl fs-gradient-amber px-3 py-3 ring-1 ring-amber-500/10" data-testid="text-weather-snow-humidity">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-amber-300/70">
                    <Droplets className="h-3 w-3" /> Snow Hum (Doser)
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-300">{weather.snowHumidityPct}%</div>
                </div>
                <div className="rounded-xl fs-gradient-violet px-3 py-3 ring-1 ring-violet-500/10" data-testid="text-weather-air-humidity">
                  <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-300/70">
                    <Droplets className="h-3 w-3" /> Air Hum
                  </div>
                  <div className="mt-1 text-lg font-bold text-violet-300">{weather.airHumidityPct}%rH</div>
                </div>
              </div>

              {(weather.clouds != null || weather.visibility || weather.wind || weather.precipitation) && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {weather.clouds != null && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clouds</div>
                      <div className="text-sm font-medium">{weather.clouds}/8</div>
                    </div>
                  )}
                  {weather.visibility && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Visibility</div>
                      <div className="text-sm font-medium">{weather.visibility}</div>
                    </div>
                  )}
                  {weather.wind && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Wind</div>
                      <div className="text-sm font-medium">{weather.wind}</div>
                    </div>
                  )}
                  {weather.precipitation && (
                    <div className="rounded-lg bg-background/40 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Precipitation</div>
                      <div className="text-sm font-medium">{weather.precipitation}</div>
                    </div>
                  )}
                </div>
              )}

              {(weather.artificialSnow || weather.naturalSnow || weather.grainSize || weather.snowHumidityType || weather.trackHardness) && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {weather.artificialSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-1 text-xs font-medium text-pink-300 ring-1 ring-pink-500/20">
                      Art. snow: {weather.artificialSnow}
                    </span>
                  )}
                  {weather.naturalSnow && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/20">
                      Nat. snow: {weather.naturalSnow}
                    </span>
                  )}
                  {weather.grainSize && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-300 ring-1 ring-orange-500/20">
                      Grain: {weather.grainSize}
                    </span>
                  )}
                  {weather.snowHumidityType && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/20">
                      Snow hum: {weather.snowHumidityType}
                    </span>
                  )}
                  {weather.trackHardness && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300 ring-1 ring-rose-500/20">
                      Track: {weather.trackHardness}
                    </span>
                  )}
                </div>
              )}
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
                  const headers = ["Rank", "Ski No.", "Product", "Method"];
                  for (const label of distLabels) {
                    const lbl = label?.trim() || "Round";
                    headers.push(`Result ${lbl} (cm)`, `Rank ${lbl}`);
                  }
                  headers.push("Feeling");
                  const csvRows = sortedEntries.map((entry) => {
                    const prod = entry.productId ? productsById.get(entry.productId) : null;
                    const additionalIds = entry.additionalProductIds
                      ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                      : [];
                    const allProducts = [
                      prod ? `${prod.brand} ${prod.name}` : null,
                      ...additionalIds.map((aid) => {
                        const p = productsById.get(aid);
                        return p ? `${p.brand} ${p.name}` : null;
                      }),
                    ].filter(Boolean);
                    const rounds = getEntryRounds(entry, distLabels.length);
                    const vals: (string | number)[] = [
                      rounds[0]?.rank ?? "",
                      entry.skiNumber,
                      allProducts.join(" + "),
                      entry.methodology,
                    ];
                    for (const rr of rounds) {
                      vals.push(rr.result ?? "", rr.rank ?? "");
                    }
                    vals.push(entry.feelingRank ?? "");
                    return vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
                  });
                  const csv = [headers.join(","), ...csvRows].join("\n");
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
                    <th className="pb-3 pr-3">Product</th>
                    <th className="pb-3 pr-3">Method</th>
                    {distLabels.map((label, i) => (
                      <th key={i} className="pb-3 pr-3" colSpan={i === 0 ? 1 : 2}>
                        {(label?.trim() || `Round ${i + 1}`)} (cm)
                      </th>
                    ))}
                    {distLabels.length > 1 && <th className="pb-3 pr-3"></th>}
                    <th className="pb-3">Feeling</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedEntries.map((entry, idx) => {
                    const product = entry.productId
                      ? productsById.get(entry.productId)
                      : null;
                    const additionalIds = entry.additionalProductIds
                      ? entry.additionalProductIds.split(",").map(Number).filter((n) => !isNaN(n) && n > 0)
                      : [];
                    const allProducts = [
                      product ? `${product.brand} ${product.name}` : null,
                      ...additionalIds.map((aid) => {
                        const p = productsById.get(aid);
                        return p ? `${p.brand} ${p.name}` : null;
                      }),
                    ].filter(Boolean);

                    const rounds = getEntryRounds(entry, distLabels.length);
                    const firstRank = rounds[0]?.rank ?? null;

                    return (
                      <tr
                        key={entry.id}
                        data-testid={`row-entry-${entry.id}`}
                        className={cn(
                          "border-b border-border/30 last:border-0 transition-colors",
                          firstRank === 1 && "bg-emerald-500/8",
                          firstRank === 2 && "bg-sky-500/8",
                          firstRank === 3 && "bg-amber-500/8",
                          idx % 2 === 0 && !firstRank && "bg-background/20",
                        )}
                      >
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2">
                            <RankBadge rank={firstRank} size="lg" />
                            {firstRank === 1 && (
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
                        <td className="py-3 pr-3" data-testid={`text-product-${entry.id}`}>
                          {hideDetails ? "" : (allProducts.length > 0 ? allProducts.join(" + ") : "—")}
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground" data-testid={`text-method-${entry.id}`}>
                          {hideDetails ? "" : (entry.methodology || "—")}
                        </td>
                        {rounds.map((rr, roundIdx) => (
                          <>
                            <td key={`res-${roundIdx}`} className="py-3 pr-3 font-mono text-sm" data-testid={`text-result-${roundIdx}-${entry.id}`}>
                              {rr.result ?? "—"}
                            </td>
                            {roundIdx > 0 && (
                              <td key={`rank-${roundIdx}`} className="py-3 pr-3" data-testid={`text-rank-${roundIdx}-${entry.id}`}>
                                <RankBadge rank={rr.rank} />
                              </td>
                            )}
                          </>
                        ))}
                        <td className="py-3" data-testid={`text-feeling-${entry.id}`}>
                          {entry.feelingRank != null ? (
                            <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-300">
                              {entry.feelingRank}
                            </span>
                          ) : "—"}
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
