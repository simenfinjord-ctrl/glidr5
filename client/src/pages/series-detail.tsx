import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Award, Plus, Trash2, Disc3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  kickRank: number | null;
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

// #38: regrind history for a testfleet (same as race skis). Newest first.
type SeriesRegrind = { id: number; date: string; grindType: string; stone: string | null; pattern: string | null; notes: string | null };
function SeriesRegrindHistory({ seriesId, currentGrind }: { seriesId: number; currentGrind: string | null }) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const emptyForm = { date: new Date().toISOString().slice(0, 10), grindType: "", stone: "", pattern: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const { data: regrinds = [] } = useQuery<SeriesRegrind[]>({
    queryKey: [`/api/series/${seriesId}/regrinds`],
    select: (rows) => [...rows].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
  });
  const addM = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/series/${seriesId}/regrinds`, { ...form, grindType: form.grindType.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/${seriesId}/regrinds`] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      setOpen(false); setForm(emptyForm);
      toast({ title: L("Regrind lagt til", "Regrind added") });
    },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });
  const delM = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/test-ski-regrinds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/${seriesId}/regrinds`] });
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
    },
  });
  return (
    <Card className="fs-card rounded-2xl p-4 sm:p-5" data-testid="card-series-regrinds">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Disc3 className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold">{L("Slipehistorikk", "Regrind history")}</h2>
          {currentGrind && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{L("Nåværende", "Current")}: {currentGrind}</span>}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-add-series-regrind"><Plus className="mr-1.5 h-3.5 w-3.5" />{L("Legg til slip", "Add regrind")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{L("Legg til slip", "Add regrind")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-xs font-medium">{L("Dato", "Date")}</label><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
                <div><label className="mb-1 block text-xs font-medium">{L("Slip", "Grind")}</label><Input value={form.grindType} onChange={(e) => setForm((f) => ({ ...f, grindType: e.target.value }))} placeholder="R3" /></div>
                <div><label className="mb-1 block text-xs font-medium">{L("Stein/verktøy", "Stone/Tool")}</label><Input value={form.stone} onChange={(e) => setForm((f) => ({ ...f, stone: e.target.value }))} /></div>
                <div><label className="mb-1 block text-xs font-medium">{L("Mønster", "Pattern")}</label><Input value={form.pattern} onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))} /></div>
              </div>
              <div><label className="mb-1 block text-xs font-medium">{L("Notat", "Note")}</label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex justify-end">
                <Button size="sm" disabled={addM.isPending || !form.grindType.trim()} onClick={() => addM.mutate()}>{addM.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {regrinds.length === 0 ? (
        <p className="text-sm text-muted-foreground">{L("Ingen slipehistorikk ennå.", "No regrind history yet.")}</p>
      ) : (
        <div className="space-y-1.5">
          {regrinds.map((r, i) => (
            <div key={r.id} className={cn("flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm", i === 0 ? "bg-primary/5 ring-1 ring-primary/20" : "bg-muted/30")} data-testid={`row-series-regrind-${r.id}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">{fmtDate(r.date)}</span>
                <span className="text-primary font-semibold">{r.grindType}</span>
                {r.stone && <span className="text-xs text-muted-foreground">{r.stone}</span>}
                {r.pattern && <span className="text-xs text-muted-foreground">{r.pattern}</span>}
                {r.notes && <span className="text-xs text-muted-foreground italic">«{r.notes}»</span>}
                {i === 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary">{L("Siste", "Latest")}</span>}
              </div>
              <button className="text-muted-foreground/50 hover:text-red-500" onClick={() => { if (confirm(L("Slette denne slipen?", "Delete this regrind?"))) delM.mutate(r.id); }} data-testid={`button-del-series-regrind-${r.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SeriesDetail() {
  const [, params] = useRoute("/testskis/:id");
  const seriesId = params?.id ? parseInt(params.id) : null;
  const { t } = useI18n();

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
          <p className="text-muted-foreground">{t("seriesDetail.notFound")}</p>
          <AppLink href="/testskis">
            <Button variant="secondary" data-testid="button-back-testskis">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("seriesDetail.back")}
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
              {t("seriesDetail.back")}
            </Button>
          </AppLink>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-series-title">
              {series.name}
            </h1>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", series.type === "Glide" ? "fs-badge-glide" : series.type === "Structure" ? "fs-badge-structure" : "fs-badge-topping")}>
              {series.type}
            </span>
            {series.brand && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                {series.brand}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("seriesDetail.testCount").replace("{n}", String(seriesTests.length))}{seriesTests.length !== 1 ? "s" : ""} · {t("testskis.skiCount").replace("{n}", String(series.numberOfSkis))}{series.grind ? ` · Grind ${series.grind}` : ""}
          </p>
        </div>

        <SeriesRegrindHistory seriesId={series.id} currentGrind={series.grind} />

        {seriesTests.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-series-tests">
            {t("seriesDetail.noTests")}
          </Card>
        ) : (
          seriesTests.map((test) => {
            const distLabels = getDistanceLabels(test);
            const testEntries = allEntries.filter((e) => e.testId === test.id);
            const sortedEntries = [...testEntries].sort((a, b) => a.skiNumber - b.skiNumber);

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
                    <span className="text-xs text-muted-foreground">{fmtDate(test.date)}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{t("seriesDetail.entryCount").replace("{n}", String(sortedEntries.length))}</span>
                </div>

                {sortedEntries.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid={`table-series-test-${test.id}`}>
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-2 pr-3">{t("tests.skiNumber")}</th>
                          <th className="pb-2 pr-3">{t("tests.product")}</th>
                          <th className="pb-2 pr-3">{t("tests.methodology")}</th>
                          {distLabels.map((label, i) => (
                            <th key={i} className="pb-2 pr-3">
                              {label?.trim() || `R${i + 1}`}
                            </th>
                          ))}
                          <th className="pb-2 pr-3">{t("common.rank")}</th>
                          <th className="pb-2">{t("tests.feelingRank")}</th>
                          {test.testType === "Classic" && <th className="pb-2 pl-2">{t("newTest.kick")}</th>}
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
                                  {rr.result ?? "—"}
                                </td>
                              ))}
                              <td className="py-2 pr-3">
                                <RankBadge rank={firstRank} />
                              </td>
                              <td className="py-2 text-xs">
                                {entry.feelingRank != null ? (
                                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                    {entry.feelingRank}
                                  </span>
                                ) : "—"}
                              </td>
                              {test.testType === "Classic" && (
                              <td className="py-2 pl-2 text-xs">
                                {entry.kickRank != null ? (
                                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                                    {entry.kickRank}
                                  </span>
                                ) : "—"}
                              </td>
                              )}
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
