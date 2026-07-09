import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, GitCompare, MapPin, Calendar, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { parseApplication } from "@/lib/parse-application";
import { cn } from "@/lib/utils";

type TestListItem = { id: number; date: string | null; location: string; testName: string | null; testType: string; seriesName?: string | null };
type CmpEntry = { skiNumber: number; productNames: string[]; methodology: string; rounds: { result: number | null; rank: number | null }[]; feelingRank: number | null; kickRank: number | null };
type CmpTest = { id: number; date: string | null; startTime?: string | null; location: string; testName: string | null; testType: string; distanceLabels: string[]; entries: CmpEntry[] };

const MAX = 4;

export default function CompareTests() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const { data: allTests = [] } = useQuery<TestListItem[]>({ queryKey: ["/api/tests"] });

  const { data: compared = [] } = useQuery<CmpTest[]>({
    queryKey: [`/api/tests/compare?ids=${selected.join(",")}`],
    enabled: selected.length > 0,
  });

  const q = search.trim().toLowerCase();
  const pickList = useMemo(() => {
    const list = allTests.filter((t) =>
      !q || t.location.toLowerCase().includes(q) || (t.testName ?? "").toLowerCase().includes(q) || (t.date ?? "").includes(q));
    return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, 200);
  }, [allTests, q]);

  const toggle = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : (prev.length >= MAX ? prev : [...prev, id]));
  };

  const rankBadge = (rank: number | null) => (
    <span className={cn("inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
      rank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
      rank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
      rank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
      rank != null ? "bg-muted/70 text-foreground" : "text-muted-foreground")}>{rank ?? "—"}</span>
  );

  const resultTable = (t: CmpTest) => {
    if (t.entries.length === 0) return <div className="mt-2 text-[11px] text-muted-foreground">{L("Ingen resultater", "No results")}</div>;
    const hasKick = t.entries.some((e) => e.kickRank != null);
    return (
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-1.5 pr-2">Ski</th>
              <th className="pb-1.5 pr-2">{L("Produkt", "Product")}</th>
              {t.distanceLabels.map((lbl, i) => (<th key={i} className="pb-1.5 pr-2">{lbl?.trim() || `R${i + 1}`}</th>))}
              <th className="pb-1.5 pr-2">Rank</th>
              <th className="pb-1.5 pr-2">{L("Følelse", "Feel")}</th>
              {hasKick && <th className="pb-1.5">Kick</th>}
            </tr>
          </thead>
          <tbody>
            {t.entries.map((e, idx) => {
              const appParts = e.methodology ? e.methodology.split("|") : [];
              const firstRank = e.rounds[0]?.rank ?? null;
              return (
                <tr key={idx} className={cn("border-b border-border/20 last:border-0", firstRank === 1 && "bg-emerald-500/8")}>
                  <td className="py-1.5 pr-2"><span className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded bg-background/50 px-1 text-[11px] font-semibold ring-1 ring-border/50">{e.skiNumber}</span></td>
                  <td className="py-1.5 pr-2">
                    {e.productNames.length > 0 ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {e.productNames.map((name, i) => {
                          const app = parseApplication(appParts[i]?.trim() ?? "").interpreted;
                          return <span key={i} className="flex items-baseline gap-1"><span className="font-medium">{name}</span>{app && <span className="text-muted-foreground">{app}</span>}</span>;
                        })}
                      </div>
                    ) : "—"}
                  </td>
                  {e.rounds.map((rr, i) => (<td key={i} className="py-1.5 pr-2 font-mono">{rr.result ?? "—"}</td>))}
                  <td className="py-1.5 pr-2">{rankBadge(firstRank)}</td>
                  <td className="py-1.5 pr-2">{e.feelingRank != null ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">{e.feelingRank}</span> : "—"}</td>
                  {hasKick && <td className="py-1.5">{e.kickRank != null ? e.kickRank : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2" data-testid="text-compare-title">
            <GitCompare className="h-6 w-6 text-primary" />{L("Sammenlign tester", "Compare tests")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(`Velg opptil ${MAX} tester for å se resultatlistene side om side.`, `Pick up to ${MAX} tests to see the result lists side by side.`)}
          </p>
        </div>

        {/* Picker */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L("Søk test (sted, navn, dato)…", "Search test (location, name, date)…")} className="pl-9" data-testid="input-compare-search" />
          </div>
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{selected.length}/{MAX} {L("valgt", "selected")}</span>
            {selected.length > 0 && <button className="hover:text-foreground" onClick={() => setSelected([])} data-testid="compare-clear">{L("Tøm valg", "Clear")}</button>}
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border">
            {pickList.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">{L("Ingen tester.", "No tests.")}</div>
            ) : pickList.map((t) => {
              const on = selected.includes(t.id);
              const disabled = !on && selected.length >= MAX;
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  disabled={disabled}
                  className={cn("flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors", on ? "bg-primary/10" : "hover:bg-muted/40", disabled && "opacity-40 cursor-not-allowed")}
                  data-testid={`compare-pick-${t.id}`}
                >
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{on && <X className="h-3 w-3 rotate-45" />}</span>
                  <span className="flex-1 min-w-0 truncate font-medium">{t.testName || t.location}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t.testType}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{t.date ? new Date(t.date).toLocaleDateString() : ""}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Comparison — two columns */}
        {selected.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="compare-empty">
            {L("Velg tester over for å sammenligne.", "Pick tests above to compare.")}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="compare-grid">
            {compared.map((t) => (
              <Card key={t.id} className="fs-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <AppLink href={`/tests/${t.id}`} testId={`compare-open-${t.id}`}>
                      <span className="text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer">{t.testName || t.location}</span>
                    </AppLink>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</span>
                      {t.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(t.date).toLocaleDateString()}</span>}
                      {t.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.startTime}</span>}
                    </div>
                  </div>
                  <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground shrink-0" onClick={() => toggle(t.id)} title={L("Fjern", "Remove")} data-testid={`compare-remove-${t.id}`}><X className="h-4 w-4" /></button>
                </div>
                {resultTable(t)}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
