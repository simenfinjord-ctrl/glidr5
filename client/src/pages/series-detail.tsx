import { useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Award } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Series = {
  id: number;
  name: string;
  type: string;
  brand: string | null;
  grind: string | null;
  numberOfSkis: number;
};

type Test = {
  id: number;
  date: string;
  location: string;
  weatherId: number | null;
  testType: string;
  seriesId: number;
  notes: string | null;
  distanceLabels: string | null;
  distanceLabel0km: string | null;
  distanceLabelXkm: string | null;
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
  results: string | null;
  feelingRank: number | null;
};

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
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
  if (test.distanceLabelXkm) labels.push(test.distanceLabelXkm);
  return labels;
}

function getEntryRounds(entry: TestEntry & { resultXkmCmBehind?: number | null; rankXkm?: number | null }, numRounds: number): RoundResult[] {
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
    results.push({ result: entry.resultXkmCmBehind ?? null, rank: entry.rankXkm ?? null });
  }
  while (results.length < numRounds) results.push({ result: null, rank: null });
  return results;
}

function RankBadge({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-7 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        rank === 1 && "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30",
        rank === 2 && "bg-slate-300/20 text-slate-300 ring-1 ring-slate-300/30",
        rank === 3 && "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30",
        rank !== null && rank > 3 && "bg-muted/60 text-muted-foreground",
        rank === null && "text-muted-foreground",
      )}
    >
      {rank ?? "—"}
    </span>
  );
}

export default function SeriesDetail() {
  const [, params] = useRoute("/testskis/:id");
  const seriesId = params?.id ? parseInt(params.id) : null;

  const { data: allSeries = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const series = allSeries.find((s) => s.id === seriesId);
  const seriesTests = useMemo(
    () => tests.filter((t) => t.seriesId === seriesId).sort((a, b) => b.date.localeCompare(a.date)),
    [tests, seriesId],
  );

  const testIds = seriesTests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/series-entries", testIds],
    queryFn: async () => {
      if (testIds.length === 0) return [];
      const results = await Promise.all(
        testIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.json()),
        ),
      );
      return results.flat();
    },
    enabled: testIds.length > 0,
  });

  const productsById = new Map(products.map((p) => [p.id, p] as const));

  if (!series) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 py-20" data-testid="not-found-series">
          <p className="text-muted-foreground">Series not found.</p>
          <AppLink href="/testskis">
            <Button variant="secondary" data-testid="button-back-testskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to TestSkis
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
          <AppLink href="/testskis" testId="link-back-testskis">
            <Button variant="ghost" size="sm" data-testid="button-back-testskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to TestSkis
            </Button>
          </AppLink>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl" data-testid="text-series-title">
              {series.name}
            </h1>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", series.type === "Glide" ? "fs-badge-glide" : series.type === "Structure" ? "fs-badge-structure" : "fs-badge-topping")}>
              {series.type}
            </span>
            {series.brand && (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                {series.brand}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {seriesTests.length} test{seriesTests.length !== 1 ? "s" : ""} · {series.numberOfSkis} skis{series.grind ? ` · Grind ${series.grind}` : ""}
          </p>
        </div>

        {seriesTests.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-series-tests">
            No tests recorded for this series yet.
          </Card>
        ) : (
          seriesTests.map((test) => {
            const distLabels = getDistanceLabels(test);
            const testEntries = allEntries.filter((e) => e.testId === test.id);
            const sortedEntries = [...testEntries].sort((a, b) => {
              const aR = getEntryRounds(a, distLabels.length)[0]?.rank;
              const bR = getEntryRounds(b, distLabels.length)[0]?.rank;
              if (aR == null && bR == null) return 0;
              if (aR == null) return 1;
              if (bR == null) return -1;
              return aR - bR;
            });

            return (
              <Card key={test.id} className="fs-card rounded-2xl p-4 sm:p-5" data-testid={`card-series-test-${test.id}`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AppLink href={`/tests/${test.id}`} testId={`link-test-${test.id}`}>
                      <span className="text-base font-semibold hover:text-primary transition-colors cursor-pointer">
                        {test.location}
                      </span>
                    </AppLink>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", test.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                      {test.testType}
                    </span>
                    <span className="text-xs text-muted-foreground">{test.date}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{sortedEntries.length} entries</span>
                </div>

                {sortedEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid={`table-series-test-${test.id}`}>
                      <thead>
                        <tr className="border-b border-border/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-2 pr-3">Rank</th>
                          <th className="pb-2 pr-3">Ski</th>
                          <th className="pb-2 pr-3">Product</th>
                          <th className="pb-2 pr-3">Method</th>
                          {distLabels.map((label, i) => (
                            <th key={i} className="pb-2 pr-3">
                              {label?.trim() || `R${i + 1}`}
                            </th>
                          ))}
                          <th className="pb-2">Feel</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedEntries.map((entry) => {
                          const product = entry.productId ? productsById.get(entry.productId) : null;
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
                              className={cn(
                                "border-b border-border/20 last:border-0",
                                firstRank === 1 && "bg-emerald-500/8",
                              )}
                              data-testid={`row-series-entry-${entry.id}`}
                            >
                              <td className="py-2 pr-3">
                                <RankBadge rank={firstRank} />
                              </td>
                              <td className="py-2 pr-3">
                                <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-background/50 text-xs font-semibold ring-1 ring-border/50">
                                  {entry.skiNumber}
                                </span>
                              </td>
                              <td className="py-2 pr-3 text-xs">
                                {allProducts.length > 0 ? allProducts.join(" + ") : "—"}
                              </td>
                              <td className="py-2 pr-3 text-xs text-muted-foreground">
                                {entry.methodology || "—"}
                              </td>
                              {rounds.map((rr, i) => (
                                <td key={i} className="py-2 pr-3 font-mono text-xs">
                                  {rr.result != null ? (
                                    <span className="flex items-center gap-1">
                                      {rr.result}
                                      {i > 0 && <RankBadge rank={rr.rank} />}
                                    </span>
                                  ) : "—"}
                                </td>
                              ))}
                              <td className="py-2 text-xs">
                                {entry.feelingRank != null ? (
                                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-300">
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
            );
          })
        )}
      </div>
    </AppShell>
  );
}
