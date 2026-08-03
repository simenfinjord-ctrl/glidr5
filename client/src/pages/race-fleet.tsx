// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Race fleets: the team's competition skis, organised in named groups/series
// that get tested against each other (one pair from each) to pick the series
// of the day. Built to read and work like the Athlete Skis garage: the same
// add-ski dialog layout, colour tags, search and filters, collapsible group
// sections, cards/table views, and per-ski test history and group analytics.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Boxes, Pencil, Trash2, Accessibility, FlaskConical, Trophy, Wrench,
  Search, X, ChevronDown, LayoutGrid, Table as TableIcon, BarChart2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LastEdited } from "@/components/last-edited";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type FleetSki = {
  id: number;
  skiId: string;
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  construction: string | null;
  mold: string | null;
  base: string | null;
  grind: string | null;
  heights: string | null;
  year: string | null;
  length: string | null;
  typeOfSki: string | null;
  whereReceived: string | null;
  notes: string | null;
  isTrainingSki: number;
  isSitski: number;
  customParams: string | null;
  createdByName: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  fleetGroup: string | null;
  // Usage record — the reason the register exists.
  testCount: number;
  lastTestDate: string | null;
  bestRank: number | null;
  winCount: number;
  avgRank: number | null;
  raceCount: number;
  lastRaceDate: string | null;
  lastRaceLocation: string | null;
  lastRaceResult: string | null;
  lastGrindDate: string | null;
  lastGrindType: string | null;
};

type FleetTestRow = {
  testId: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  resultUnit: string | null;
  createdByName: string | null;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  snowType: string | null;
  fleetEntryCount: number;
  pairLabels: string[];
  pairGroups: (string | null)[];
  bestRank: number | null;
  entries: { skiLabel: string; group: string | null; grind: string | null; rank: number | null; result: number | null }[];
};

type SkiTestRow = {
  testId: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  resultUnit: string | null;
  rank: number | null;
  result: number | null;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  snowType: string | null;
};

type GroupTestRow = {
  raceSkiId: number;
  skiLabel: string;
  date: string;
  rank: number | null;
  airTemperatureC: number | null;
  snowTemperatureC: number | null;
  snowType: string | null;
};

// Snow-temperature buckets — the axis waxers actually think along.
const TEMP_BUCKETS: { label: string; test: (t: number) => boolean }[] = [
  { label: "≥ 0°",       test: (t) => t >= 0 },
  { label: "−1…−4°",     test: (t) => t < 0 && t >= -4 },
  { label: "−5…−9°",     test: (t) => t < -4 && t >= -9 },
  { label: "−10…−14°",   test: (t) => t < -9 && t >= -14 },
  { label: "< −15°",     test: (t) => t < -14 },
];

// Average rank per snow-temp bucket and per snow type. Rank is the unit-free
// measure, so cm tests and photocell time tests aggregate together.
function conditionBreakdown(rows: { rank: number | null; snowTemperatureC: number | null; snowType: string | null }[]) {
  const temp = TEMP_BUCKETS.map((b) => ({ label: b.label, n: 0, sum: 0 }));
  const types = new Map<string, { n: number; sum: number }>();
  for (const r of rows) {
    if (r.rank == null) continue;
    if (r.snowTemperatureC != null) {
      const i = TEMP_BUCKETS.findIndex((b) => b.test(r.snowTemperatureC!));
      if (i >= 0) { temp[i].n++; temp[i].sum += r.rank; }
    }
    const st = r.snowType?.trim();
    if (st) {
      const e = types.get(st) ?? { n: 0, sum: 0 };
      e.n++; e.sum += r.rank;
      types.set(st, e);
    }
  }
  return {
    temp: temp.filter((b) => b.n > 0).map((b) => ({ label: b.label, n: b.n, avg: b.sum / b.n })),
    types: Array.from(types.entries()).map(([label, e]) => ({ label, n: e.n, avg: e.sum / e.n }))
      .sort((a, b) => a.avg - b.avg),
  };
}

// Compact "performs best in" rendering shared by ski and series dialogs.
function ConditionsSection({ rows, L }: {
  rows: { rank: number | null; snowTemperatureC: number | null; snowType: string | null }[];
  L: (no: string, en: string) => string;
}) {
  const b = conditionBreakdown(rows);
  if (b.temp.length === 0 && b.types.length === 0) {
    return <p className="text-[11px] text-muted-foreground">{L("Ingen tester med værdata ennå — koble vær til testene for å få føreanalyse.", "No tests with weather data yet — link weather to the tests to get condition analysis.")}</p>;
  }
  const best = (list: { label: string; n: number; avg: number }[]) => list.length ? Math.min(...list.map((x) => x.avg)) : null;
  const bestTemp = best(b.temp), bestType = best(b.types);
  const row = (x: { label: string; n: number; avg: number }, isBest: boolean) => (
    <div key={x.label} className={cn("flex items-center gap-2 rounded px-2 py-1 text-xs", isBest && "bg-amber-50 dark:bg-amber-950/20")}>
      <span className={cn("w-24 shrink-0", isBest && "font-semibold")}>{x.label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        {/* Lower avg rank = better = fuller bar (scaled against rank 5). */}
        <div className={cn("h-full rounded-full", isBest ? "bg-amber-400" : "bg-primary/50")}
          style={{ width: `${Math.max(8, Math.min(100, (1 / Math.max(1, x.avg)) * 100))}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">Ø {x.avg.toFixed(2)}</span>
      <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">{x.n} {L("t.", "t.")}</span>
    </div>
  );
  return (
    <div className="space-y-2">
      {b.temp.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Snøtemperatur — snittrangering", "Snow temperature — average rank")}</p>
          <div className="space-y-0.5">{b.temp.map((x) => row(x, x.avg === bestTemp))}</div>
        </div>
      )}
      {b.types.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{L("Snøtype — snittrangering", "Snow type — average rank")}</p>
          <div className="space-y-0.5">{b.types.map((x) => row(x, x.avg === bestType))}</div>
        </div>
      )}
    </div>
  );
}

// Same palette as the Athlete Skis garage — a colour tag is a physical strip
// of tape on the ski, so the two registers must speak the same colours.
const SKI_COLORS = [
  { id: "none",    label: "White",  dot: "bg-white ring-1 ring-border" },
  { id: "emerald", label: "Green",  dot: "bg-emerald-400" },
  { id: "sky",     label: "Blue",   dot: "bg-sky-400" },
  { id: "violet",  label: "Purple", dot: "bg-violet-400" },
  { id: "red",     label: "Red",    dot: "bg-red-400" },
  { id: "yellow",  label: "Yellow", dot: "bg-yellow-400" },
  { id: "grey",    label: "Grey",   dot: "bg-gray-400" },
  { id: "rose",    label: "Pink",   dot: "bg-rose-400" },
  { id: "orange",  label: "Orange", dot: "bg-orange-400" },
  { id: "teal",    label: "Teal",   dot: "bg-teal-400" },
] as const;

function skiColor(s: { customParams: string | null }): string {
  try { return (s.customParams ? JSON.parse(s.customParams) : {})._color || "none"; } catch { return "none"; }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

const EMPTY = {
  skiId: "", serialNumber: "", brand: "", discipline: "Classic", construction: "", mold: "", base: "",
  grind: "", heights: "", year: "", length: "", typeOfSki: "", whereReceived: "", notes: "",
  fleetGroup: "", color: "none",
  isTrainingSki: false, isSitski: false,
};

export default function RaceFleet() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { can } = useAuth();
  const canEdit = can("raceskis", "edit");

  // Register (the garage) or the tests run with it — like the Athlete Skis tabs.
  const [pageTab, setPageTab] = useState<"register" | "tests">("register");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const set = (k: keyof typeof EMPTY, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const { data: skis = [], isLoading, error } = useQuery<FleetSki[]>({ queryKey: ["/api/race-fleet"], retry: false });
  const forbidden = (error as any)?.message?.includes("403");

  // ── Toolbar state ──────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [discipline, setDiscipline] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [grindFilter, setGrindFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [view, setView] = useState<"cards" | "table">(() => {
    try { return localStorage.getItem("glidr-fleet-view") === "table" ? "table" : "cards"; } catch { return "cards"; }
  });
  const setViewMode = (v: "cards" | "table") => { setView(v); try { localStorage.setItem("glidr-fleet-view", v); } catch {} };
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("glidr-fleet-collapsed") || "[]")); } catch { return new Set(); }
  });
  const toggleGroup = (g: string) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(g)) next.delete(g); else next.add(g);
    try { localStorage.setItem("glidr-fleet-collapsed", JSON.stringify(Array.from(next))); } catch {}
    return next;
  });

  // Per-ski detail (specs + test history) and per-group analytics.
  const [detailSki, setDetailSki] = useState<FleetSki | null>(null);
  const [analyticsGroup, setAnalyticsGroup] = useState<string | null>(null);

  const groups = useMemo(() => Array.from(new Set(skis.map((s) => s.fleetGroup?.trim()).filter(Boolean))) as string[], [skis]);
  const grinds = useMemo(() => Array.from(new Set(skis.map((s) => s.grind?.trim()).filter(Boolean))).sort() as string[], [skis]);
  const brands = useMemo(() => Array.from(new Set(skis.map((s) => s.brand?.trim()).filter(Boolean))).sort() as string[], [skis]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skis.filter((s) => {
      if (discipline !== "all" && s.discipline !== discipline) return false;
      if (groupFilter !== "all" && (s.fleetGroup?.trim() || "") !== groupFilter) return false;
      if (grindFilter !== "all" && (s.grind?.trim() || "") !== grindFilter) return false;
      if (brandFilter !== "all" && (s.brand?.trim() || "") !== brandFilter) return false;
      if (q) {
        const hay = [s.skiId, s.serialNumber, s.brand, s.grind, s.fleetGroup, s.mold, s.base, s.construction,
          s.typeOfSki, s.whereReceived, s.notes, s.year, s.length, s.heights].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [skis, search, discipline, groupFilter, grindFilter, brandFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, FleetSki[]>();
    for (const s of filtered) {
      const key = s.fleetGroup?.trim() || "";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(s);
    }
    const keys = Array.from(m.keys()).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    return { m, keys };
  }, [filtered]);

  const hasFilters = search !== "" || discipline !== "all" || groupFilter !== "all" || grindFilter !== "all" || brandFilter !== "all";

  // ── Mutations ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditId(null); setForm({ ...EMPTY }); setOpen(true); };
  const openEdit = (s: FleetSki) => {
    setEditId(s.id);
    setForm({
      skiId: s.skiId ?? "", serialNumber: s.serialNumber ?? "", brand: s.brand ?? "", discipline: s.discipline ?? "Classic",
      construction: s.construction ?? "", mold: s.mold ?? "", base: s.base ?? "", grind: s.grind ?? "",
      heights: s.heights ?? "", year: s.year ?? "", length: s.length ?? "", typeOfSki: s.typeOfSki ?? "",
      whereReceived: s.whereReceived ?? "", notes: s.notes ?? "", fleetGroup: s.fleetGroup ?? "",
      color: skiColor(s),
      isTrainingSki: s.isTrainingSki === 1, isSitski: s.isSitski === 1,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { color, ...rest } = form;
      // Colour rides in customParams, exactly like the athlete garage.
      const payload = { ...rest, customParams: JSON.stringify({ _color: color === "none" ? undefined : color }) };
      if (editId) return (await apiRequest("PUT", `/api/race-fleet/${editId}`, payload)).json();
      return (await apiRequest("POST", "/api/race-fleet", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] });
      toast({ title: editId ? L("Ski oppdatert", "Ski updated") : L("Ski lagt til", "Ski added") });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: L("Kunne ikke lagre", "Could not save"), description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/race-fleet/${id}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] });
      toast({ title: L("Ski slettet", "Ski deleted") });
    },
  });

  // ── Small render helpers ──────────────────────────────────────────────────
  const colorDot = (s: FleetSki) => {
    const c = SKI_COLORS.find((x) => x.id === skiColor(s));
    if (!c || c.id === "none") return null;
    return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", c.dot)} title={c.label} />;
  };

  const historyChips = (s: FleetSki) => (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
        <FlaskConical className="h-3 w-3" />
        {s.testCount > 0
          ? L(`${s.testCount} tester · sist ${s.lastTestDate}`, `${s.testCount} tests · last ${s.lastTestDate}`)
          : L("Aldri testet", "Never tested")}
        {s.bestRank ? L(` · beste plass ${s.bestRank}`, ` · best rank ${s.bestRank}`) : ""}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
        <Trophy className="h-3 w-3" />
        {s.raceCount > 0
          ? L(`${s.raceCount} renn · sist ${s.lastRaceDate}${s.lastRaceLocation ? ` (${s.lastRaceLocation})` : ""}${s.lastRaceResult ? ` · ${s.lastRaceResult}` : ""}`,
              `${s.raceCount} races · last ${s.lastRaceDate}${s.lastRaceLocation ? ` (${s.lastRaceLocation})` : ""}${s.lastRaceResult ? ` · ${s.lastRaceResult}` : ""}`)
          : L("Aldri brukt i renn", "Never raced")}
      </span>
      {(() => {
        const d = daysSince(s.lastGrindDate);
        const stale = d != null && d > 180;
        return (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5",
            stale ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" : "bg-muted text-muted-foreground")}>
            <Wrench className="h-3 w-3" />
            {d == null
              ? L("Ingen slip registrert", "No grind logged")
              : L(`Slipt for ${d} dager siden${s.lastGrindType ? ` · ${s.lastGrindType}` : ""}`,
                  `Ground ${d} days ago${s.lastGrindType ? ` · ${s.lastGrindType}` : ""}`)}
          </span>
        );
      })()}
    </div>
  );

  const skiRow = (s: FleetSki) => (
    <div key={s.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/20" data-testid={`row-fleet-${s.id}`}>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetailSki(s)}>
        <div className="flex flex-wrap items-center gap-2">
          {colorDot(s)}
          <span className="font-semibold text-sm">{s.skiId}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{s.discipline}</span>
          {s.typeOfSki && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">{s.typeOfSki}</span>}
          {s.isSitski === 1 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/30 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:text-fuchsia-300"><Accessibility className="h-3 w-3" />{L("Sitski", "Sit-ski")}</span>
          )}
          {s.isTrainingSki === 1 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">{L("Trening", "Training")}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {([
            [L("Merke", "Brand"), s.brand],
            [L("Slip", "Grind"), s.grind],
            [L("Konstruksjon", "Construction"), s.construction],
            ["Mold", s.mold],
            ["Base", s.base],
            [L("Høyder", "Heights"), s.heights],
            [L("År", "Year"), s.year],
            [L("Lengde", "Length"), s.length],
            [L("Serienr.", "Serial"), s.serialNumber],
          ] as [string, string | null][]).filter(([, v]) => !!v).map(([label, v]) => (
            <span key={label}><span className="font-medium text-foreground">{label}:</span> {v}</span>
          ))}
        </div>
        {historyChips(s)}
        {s.notes && <div className="mt-1 text-[11px] italic text-muted-foreground">{s.notes}</div>}
        <LastEdited record={s} className="mt-1" />
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => openEdit(s)} data-testid={`button-edit-fleet-${s.id}`} title={L("Rediger", "Edit")}><Pencil className="h-4 w-4" /></button>
          <button className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => { if (confirm(L("Slette denne skien?", "Delete this ski?"))) deleteMutation.mutate(s.id); }} data-testid={`button-delete-fleet-${s.id}`} title={L("Slett", "Delete")}><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  const fieldInput = (key: keyof typeof EMPTY, label: string, placeholder?: string) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <Input value={form[key] as string} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className="h-9 text-sm" data-testid={`fleet-input-${key}`} />
    </div>
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl" data-testid="text-racefleet-title">
              <Boxes className="h-6 w-6 text-primary" />{L("Konkurranseski (lag)", "Race fleets")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("Lagets konkurranseski i serier — test seriene mot hverandre og velg dagens serie.", "Your team's competition skis in series — test the series against each other and pick the series of the day.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <AppLink href="/tests/new?source=raceskis&type=Classic&fleet=1">
                <Button variant="outline" data-testid="button-new-group-test">
                  <FlaskConical className="mr-2 h-4 w-4" />{L("Ny gruppetest", "New group test")}
                </Button>
              </AppLink>
            )}
            {canEdit && (
              <Button onClick={openAdd} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600" data-testid="button-add-fleet-ski">
                <Plus className="mr-2 h-4 w-4" />{L("Legg til ski", "Add ski")}
              </Button>
            )}
          </div>
        </div>

        {/* Register | Tests — the Athlete Skis tab pattern */}
        <div className="flex gap-1 border-b border-border">
          {([["register", L("Register", "Register")], ["tests", L("Tester", "Tests")]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPageTab(key)}
              className={cn("border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                pageTab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              data-testid={`fleet-tab-${key}`}>
              {label}
            </button>
          ))}
        </div>

        {pageTab === "tests" && !forbidden && <FleetTestsTab L={L} />}

        {pageTab === "tests" ? null : forbidden ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="fleet-forbidden">
            {L("Race fleets er ikke aktivert for dette laget. En Super Admin må slå på «Para team».", "Race fleets is not enabled for this team. A Super Admin must turn on 'Para team'.")}
          </Card>
        ) : isLoading ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>
        ) : (
          <>
            {/* ── Toolbar: search + every parameter as a filter ── */}
            <Card className="fs-card rounded-2xl p-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder={L("Søk ID, slip, mold, base, notat…", "Search ID, grind, mold, base, note…")}
                    className="h-9 pl-8 text-sm" data-testid="fleet-search" />
                </div>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger className="h-9 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle stilarter", "All disciplines")}</SelectItem>
                    <SelectItem value="Classic">{L("Klassisk", "Classic")}</SelectItem>
                    <SelectItem value="Skating">{L("Skøyting", "Skating")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="h-9 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle serier", "All series")}</SelectItem>
                    {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={grindFilter} onValueChange={setGrindFilter}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle sliper", "All grinds")}</SelectItem>
                    {grinds.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{L("Alle merker", "All brands")}</SelectItem>
                    {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground"
                    onClick={() => { setSearch(""); setDiscipline("all"); setGroupFilter("all"); setGrindFilter("all"); setBrandFilter("all"); }}>
                    <X className="h-3.5 w-3.5" />{L("Nullstill", "Clear")}
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-0.5 rounded-md border border-border p-0.5">
                  <button onClick={() => setViewMode("cards")} title={L("Kort", "Cards")}
                    className={cn("flex h-7 w-7 items-center justify-center rounded", view === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setViewMode("table")} title={L("Tabell", "Table")}
                    className={cn("flex h-7 w-7 items-center justify-center rounded", view === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    <TableIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground">{filtered.length}/{skis.length}</span>
              </div>
            </Card>

            {skis.length === 0 ? (
              <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-fleet">
                {L("Ingen konkurranseski lagt inn ennå.", "No competition skis added yet.")}
              </Card>
            ) : view === "table" ? (
              /* ── Table view: one dense row per pair ── */
              <Card className="fs-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2.5 font-medium">{L("Ski-ID", "Ski ID")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("Serie", "Series")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("Stilart", "Discipline")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("Slip", "Grind")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("Merke", "Brand")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("År", "Year")}</th>
                        <th className="px-3 py-2.5 font-medium">{L("Lengde", "Length")}</th>
                        <th className="px-3 py-2.5 font-medium text-right">{L("Tester", "Tests")}</th>
                        <th className="px-3 py-2.5 font-medium text-right">{L("Seire", "Wins")}</th>
                        <th className="px-3 py-2.5 font-medium text-right">{L("Snittrang", "Avg rank")}</th>
                        <th className="px-3 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {filtered.map((s) => (
                        <tr key={s.id} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => setDetailSki(s)}>
                          <td className="px-3 py-2 text-xs font-semibold"><span className="inline-flex items-center gap-1.5">{colorDot(s)}{s.skiId}</span></td>
                          <td className="px-3 py-2 text-xs">{s.fleetGroup || "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.discipline}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.grind || "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.brand || "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.year || "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{s.length || "—"}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{s.testCount}</td>
                          <td className={cn("px-3 py-2 text-right text-xs tabular-nums", s.winCount > 0 && "font-semibold text-amber-600 dark:text-amber-400")}>{s.winCount}</td>
                          <td className="px-3 py-2 text-right text-xs tabular-nums">{s.avgRank ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            {canEdit && (
                              <button className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil className="h-3.5 w-3.5" /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              /* ── Card view: collapsible series sections ── */
              <div className="flex flex-col gap-3" data-testid="list-fleet">
                {grouped.keys.map((gkey) => {
                  const list = grouped.m.get(gkey)!;
                  const isCollapsed = collapsed.has(gkey || "__none__");
                  return (
                    <Card key={gkey || "__none__"} className="fs-card rounded-2xl overflow-hidden">
                      <div className="flex items-center gap-2 bg-muted/40 px-4 py-2">
                        <button onClick={() => toggleGroup(gkey || "__none__")}
                          className="flex flex-1 items-center gap-2 text-left" data-testid={`fleet-group-header-${gkey || "none"}`}>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
                          <span className="text-sm font-semibold">{gkey || L("Uten serie", "No series")}</span>
                          <span className="text-xs text-muted-foreground">({list.length})</span>
                        </button>
                        {gkey && (
                          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={() => setAnalyticsGroup(gkey)} data-testid={`fleet-group-analytics-${gkey}`}>
                            <BarChart2 className="h-3.5 w-3.5" />Analytics
                          </Button>
                        )}
                      </div>
                      {!isCollapsed && <div className="divide-y divide-border/40">{list.map(skiRow)}</div>}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Add/edit dialog — the Athlete Skis layout, fleet-adapted ── */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>{editId ? L("Rediger konkurranseski", "Edit competition ski") : L("Legg til konkurranseski", "Add competition ski")}</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (form.skiId.trim() && form.discipline.trim()) saveMutation.mutate(); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {fieldInput("skiId", L("Ski-ID *", "Ski ID *"), "e.g. 003")}
                {fieldInput("serialNumber", L("Serienummer", "Serial number"))}
                {fieldInput("grind", L("Slip", "Grind"))}
                {fieldInput("brand", L("Merke", "Brand"), "Madshus")}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Stilart *", "Discipline *")}</label>
                  <Select value={form.discipline} onValueChange={(v) => set("discipline", v)}>
                    <SelectTrigger className="h-9 text-sm" data-testid="fleet-select-discipline"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Classic">{L("Klassisk", "Classic")}</SelectItem>
                      <SelectItem value="Skating">{L("Skøyting", "Skating")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {fieldInput("construction", L("Konstruksjon", "Construction"))}
                {fieldInput("mold", "Mold")}
                {fieldInput("base", "Base")}
                {fieldInput("heights", L("Høyder", "Chamber heights"))}
                {fieldInput("year", L("År", "Year"))}
                {fieldInput("length", L("Lengde", "Length"))}
                {form.discipline === "Classic" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Skitype", "Ski type")}</label>
                    <Select value={form.typeOfSki || "__none__"} onValueChange={(v) => set("typeOfSki", v === "__none__" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm" data-testid="fleet-select-ski-type"><SelectValue placeholder={L("Ingen", "None")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{L("Ingen", "None")}</SelectItem>
                        <SelectItem value="Hard Wax">Hard Wax</SelectItem>
                        <SelectItem value="Klister/Cover">Klister/Cover</SelectItem>
                        <SelectItem value="Klister">Klister</SelectItem>
                        <SelectItem value="Zero">Zero</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : <div />}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Gruppe/serie", "Group/series")}</label>
                <Input value={form.fleetGroup} onChange={(e) => set("fleetGroup", e.target.value)}
                  placeholder={L("f.eks. Serie A", "e.g. Series A")} className="h-9 text-sm" data-testid="fleet-input-group" />
                {(() => {
                  const q = form.fleetGroup.trim().toLowerCase();
                  const shown = groups.filter((g) => g.toLowerCase() !== q && (!q || g.toLowerCase().includes(q)));
                  if (shown.length === 0) return null;
                  return (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {shown.slice(0, 8).map((g) => (
                        <button key={g} type="button" onClick={() => set("fleetGroup", g)}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          data-testid={`fleet-group-suggest-${g}`}>
                          {g}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {fieldInput("whereReceived", L("Mottatt hvor", "Where received"))}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Fargemerke", "Colour tag")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {SKI_COLORS.map((c) => (
                    <button key={c.id} type="button" onClick={() => set("color", c.id)}
                      className={cn("h-7 w-7 rounded-full transition-transform", c.dot,
                        form.color === c.id ? "scale-110 ring-2 ring-primary ring-offset-2" : "hover:scale-105")}
                      title={c.label} aria-pressed={form.color === c.id} data-testid={`fleet-color-${c.id}`} />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">{L("Notat", "Note")}</label>
                <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2}
                  placeholder={L("Vises på skiparet i registeret…", "Shown on the ski pair in the register…")}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" data-testid="fleet-input-notes" />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isSitski} onChange={(e) => set("isSitski", e.target.checked)} className="h-4 w-4 accent-fuchsia-600" />
                  <span className="inline-flex items-center gap-1"><Accessibility className="h-4 w-4 text-fuchsia-500" />{L("Sitski (piggekjelke)", "Sit-ski (sledge)")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isTrainingSki} onChange={(e) => set("isTrainingSki", e.target.checked)} className="h-4 w-4 accent-amber-600" />
                  {L("Treningsski", "Training ski")}
                </label>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saveMutation.isPending || !form.skiId.trim()} className="bg-green-600 text-white hover:bg-green-700" data-testid="button-save-fleet-ski">
                  {saveMutation.isPending ? L("Lagrer…", "Saving…") : L("Lagre", "Save")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Per-ski detail: specs + full test history, like Athlete Skis ── */}
        <SkiDetailDialog ski={detailSki} onClose={() => setDetailSki(null)} L={L} />

        {/* ── Per-series analytics ── */}
        <Dialog open={!!analyticsGroup} onOpenChange={(o) => !o && setAnalyticsGroup(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader><DialogTitle>{analyticsGroup} — Analytics</DialogTitle></DialogHeader>
            {analyticsGroup && <GroupConditions group={analyticsGroup} L={L} />}
            {analyticsGroup && (() => {
              const list = skis.filter((s) => (s.fleetGroup?.trim() || "") === analyticsGroup)
                .sort((a, b) => (a.avgRank ?? 99) - (b.avgRank ?? 99) || b.winCount - a.winCount);
              const tested = list.filter((s) => s.testCount > 0);
              return (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {L(`${list.length} par · ${tested.length} testet · ${list.reduce((a, s) => a + s.testCount, 0)} testoppføringer totalt`,
                       `${list.length} pairs · ${tested.length} tested · ${list.reduce((a, s) => a + s.testCount, 0)} test entries in total`)}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-2 pr-3">{L("Ski", "Ski")}</th>
                          <th className="pb-2 pr-3 text-right">{L("Tester", "Tests")}</th>
                          <th className="pb-2 pr-3 text-right">{L("Seire", "Wins")}</th>
                          <th className="pb-2 pr-3 text-right">{L("Beste", "Best")}</th>
                          <th className="pb-2 text-right">{L("Snittrang", "Avg rank")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {list.map((s, i) => (
                          <tr key={s.id} className={cn(i === 0 && s.testCount > 0 && "bg-amber-50/50 dark:bg-amber-950/10")}>
                            <td className="py-1.5 pr-3 text-xs font-semibold"><span className="inline-flex items-center gap-1.5">{colorDot(s)}{s.skiId}</span></td>
                            <td className="py-1.5 pr-3 text-right text-xs tabular-nums">{s.testCount}</td>
                            <td className={cn("py-1.5 pr-3 text-right text-xs tabular-nums", s.winCount > 0 && "font-semibold text-amber-600 dark:text-amber-400")}>{s.winCount}</td>
                            <td className="py-1.5 pr-3 text-right text-xs tabular-nums">{s.bestRank ?? "—"}</td>
                            <td className="py-1.5 text-right text-xs tabular-nums">{s.avgRank ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {L("Sortert på snittrangering — paret øverst er seriens beste kandidat til gruppetesten.",
                       "Sorted by average rank — the top pair is the series' best candidate for the group test.")}
                  </p>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

// Per-ski test history, fetched when the dialog opens.
function SkiDetailDialog({ ski, onClose, L }: {
  ski: FleetSki | null;
  onClose: () => void;
  L: (no: string, en: string) => string;
}) {
  const { toast } = useToast();
  const { data: tests = [], isLoading } = useQuery<SkiTestRow[]>({
    queryKey: [`/api/race-fleet/${ski?.id}/tests`],
    enabled: !!ski,
  });
  // Quick logging straight from the register — no trip via Race Prep needed.
  const [logMode, setLogMode] = useState<"none" | "race" | "regrind">("none");
  const today = new Date().toISOString().slice(0, 10);
  const [raceForm, setRaceForm] = useState({ date: today, location: "", result: "", notes: "" });
  const [grindForm, setGrindForm] = useState({ date: today, grindType: "", stone: "", pattern: "" });
  const logRace = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/race-skis/${ski!.id}/usages`, {
        date: raceForm.date, location: raceForm.location || null,
        discipline: ski!.discipline, result: raceForm.result || null, notes: raceForm.notes || null,
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] });
      toast({ title: L("Rennbruk registrert", "Race usage logged") });
      setLogMode("none");
      setRaceForm({ date: today, location: "", result: "", notes: "" });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke registrere", "Could not log"), description: e?.message, variant: "destructive" }),
  });
  const logRegrind = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/race-skis/${ski!.id}/regrinds`, {
        date: grindForm.date, grindType: grindForm.grindType,
        stone: grindForm.stone || null, pattern: grindForm.pattern || null,
      });
      if (!res.ok) throw new Error((await res.json())?.message ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/race-fleet"] });
      toast({ title: L("Sliping registrert", "Regrind logged") });
      setLogMode("none");
      setGrindForm({ date: today, grindType: "", stone: "", pattern: "" });
    },
    onError: (e: any) => toast({ title: L("Kunne ikke registrere", "Could not log"), description: e?.message, variant: "destructive" }),
  });
  if (!ski) return null;
  return (
    <Dialog open={!!ski} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ski.skiId}
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">{ski.discipline}</span>
            {ski.fleetGroup && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{ski.fleetGroup}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
            {([
              [L("Merke", "Brand"), ski.brand], [L("Slip", "Grind"), ski.grind], ["Mold", ski.mold],
              ["Base", ski.base], [L("Høyder", "Heights"), ski.heights], [L("År", "Year"), ski.year],
              [L("Lengde", "Length"), ski.length], [L("Skitype", "Ski type"), ski.typeOfSki], [L("Serienr.", "Serial"), ski.serialNumber],
            ] as [string, string | null][]).filter(([, v]) => !!v).map(([k, v]) => (
              <div key={k}><span className="text-muted-foreground">{k}:</span> <span className="font-medium">{v}</span></div>
            ))}
          </div>

          <div>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {L("Testhistorikk", "Test history")} ({tests.length})
            </h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{L("Laster…", "Loading…")}</p>
            ) : tests.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L("Ingen tester med dette paret ennå.", "No tests with this pair yet.")}</p>
            ) : (
              <div className="divide-y divide-border/40 rounded-lg border border-border">
                {tests.map((t) => (
                  <AppLink key={`${t.testId}`} href={`/tests/${t.testId}`}
                    className="flex items-center gap-3 px-3 py-2 text-xs transition-colors hover:bg-muted/30">
                    <span className="w-20 shrink-0 text-muted-foreground">{t.date}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{t.testName || t.location}</span>
                    <span className="shrink-0 text-muted-foreground">{t.testType}</span>
                    <span className={cn("w-8 shrink-0 text-right font-semibold tabular-nums",
                      t.rank === 1 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                      {t.rank ?? "—"}
                    </span>
                    <span className="w-14 shrink-0 text-right font-mono text-muted-foreground">
                      {t.result != null ? `${t.result}${t.resultUnit === "time" ? "s" : ""}` : "—"}
                    </span>
                  </AppLink>
                ))}
              </div>
            )}
          </div>
          {/* Quick logging: race usage and regrind, from right here */}
          <div className="rounded-lg border border-dashed border-border p-2.5">
            <div className="flex flex-wrap gap-2">
              <Button variant={logMode === "race" ? "default" : "outline"} size="sm" className="h-7 text-xs"
                onClick={() => setLogMode(logMode === "race" ? "none" : "race")} data-testid="button-log-race">
                <Trophy className="mr-1.5 h-3.5 w-3.5" />{L("Registrer rennbruk", "Log race usage")}
              </Button>
              <Button variant={logMode === "regrind" ? "default" : "outline"} size="sm" className="h-7 text-xs"
                onClick={() => setLogMode(logMode === "regrind" ? "none" : "regrind")} data-testid="button-log-regrind">
                <Wrench className="mr-1.5 h-3.5 w-3.5" />{L("Registrer sliping", "Log regrind")}
              </Button>
            </div>
            {logMode === "race" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="date" value={raceForm.date} onChange={(e) => setRaceForm((f) => ({ ...f, date: e.target.value }))} className="h-8 text-xs" />
                <Input value={raceForm.location} onChange={(e) => setRaceForm((f) => ({ ...f, location: e.target.value }))} placeholder={L("Sted", "Location")} className="h-8 text-xs" />
                <Input value={raceForm.result} onChange={(e) => setRaceForm((f) => ({ ...f, result: e.target.value }))} placeholder={L("Resultat (valgfritt)", "Result (optional)")} className="h-8 text-xs" />
                <Input value={raceForm.notes} onChange={(e) => setRaceForm((f) => ({ ...f, notes: e.target.value }))} placeholder={L("Notat", "Note")} className="h-8 text-xs" />
                <Button size="sm" className="col-span-2 h-8 bg-green-600 text-white hover:bg-green-700"
                  disabled={logRace.isPending || !raceForm.date} onClick={() => logRace.mutate()} data-testid="button-save-race-usage">
                  {logRace.isPending ? L("Lagrer…", "Saving…") : L("Lagre rennbruk", "Save race usage")}
                </Button>
              </div>
            )}
            {logMode === "regrind" && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="date" value={grindForm.date} onChange={(e) => setGrindForm((f) => ({ ...f, date: e.target.value }))} className="h-8 text-xs" />
                <Input value={grindForm.grindType} onChange={(e) => setGrindForm((f) => ({ ...f, grindType: e.target.value }))} placeholder={L("Slip (f.eks. SF1) *", "Grind (e.g. SF1) *")} className="h-8 text-xs" />
                <Input value={grindForm.stone} onChange={(e) => setGrindForm((f) => ({ ...f, stone: e.target.value }))} placeholder={L("Stein (valgfritt)", "Stone (optional)")} className="h-8 text-xs" />
                <Input value={grindForm.pattern} onChange={(e) => setGrindForm((f) => ({ ...f, pattern: e.target.value }))} placeholder={L("Mønster (valgfritt)", "Pattern (optional)")} className="h-8 text-xs" />
                <Button size="sm" className="col-span-2 h-8 bg-green-600 text-white hover:bg-green-700"
                  disabled={logRegrind.isPending || !grindForm.date || !grindForm.grindType.trim()} onClick={() => logRegrind.mutate()} data-testid="button-save-regrind">
                  {logRegrind.isPending ? L("Lagrer…", "Saving…") : L("Lagre sliping", "Save regrind")}
                </Button>
              </div>
            )}
          </div>

          {tests.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {L("Presterer best i", "Performs best in")}
              </h3>
              <ConditionsSection rows={tests} L={L} />
            </div>
          )}
          <LastEdited record={ski} />
        </div>
      </DialogContent>
    </Dialog>
  );
}


// Condition analysis for a whole series: every pair's test rows with weather,
// aggregated to show which temperatures and snow the SERIES performs in — and
// which pair carries it in each temperature band.
function GroupConditions({ group, L }: { group: string; L: (no: string, en: string) => string }) {
  const { data: rows = [] } = useQuery<GroupTestRow[]>({
    queryKey: [`/api/race-fleet/group-tests?group=${encodeURIComponent(group)}`],
  });
  const bestPerBucket = useMemo(() => {
    // Per temp bucket: the ski with the lowest average rank (min 1 entry).
    const out: { label: string; ski: string; avg: number; n: number }[] = [];
    for (const b of TEMP_BUCKETS) {
      const inBucket = rows.filter((r) => r.rank != null && r.snowTemperatureC != null && b.test(r.snowTemperatureC));
      if (inBucket.length === 0) continue;
      const bySki = new Map<string, { n: number; sum: number }>();
      for (const r of inBucket) {
        const e = bySki.get(r.skiLabel) ?? { n: 0, sum: 0 };
        e.n++; e.sum += r.rank!;
        bySki.set(r.skiLabel, e);
      }
      let best: { ski: string; avg: number; n: number } | null = null;
      for (const [ski, e] of bySki) {
        const avg = e.sum / e.n;
        if (!best || avg < best.avg) best = { ski, avg, n: e.n };
      }
      if (best) out.push({ label: b.label, ...best });
    }
    return out;
  }, [rows]);

  if (rows.length === 0) return null;
  return (
    <div className="space-y-3 border-b border-border pb-3">
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {L("Serien presterer best i", "The series performs best in")}
        </h3>
        <ConditionsSection rows={rows} L={L} />
      </div>
      {bestPerBucket.length > 0 && (
        <div>
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {L("Beste par per temperaturbånd", "Best pair per temperature band")}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {bestPerBucket.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px]">
                <span className="text-muted-foreground">{b.label}:</span>
                <span className="font-semibold">{b.ski}</span>
                <span className="text-muted-foreground">Ø {b.avg.toFixed(2)} · {b.n} {L("t.", "t.")}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// Every test run with fleet skis — the Race fleets equivalent of the Athlete
// Skis Tests tab. Rows link straight into the test.
function FleetTestsTab({ L }: { L: (no: string, en: string) => string }) {
  const { data: rows = [], isLoading } = useQuery<FleetTestRow[]>({ queryKey: ["/api/race-fleet/all-tests"] });
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const types = useMemo(() => Array.from(new Set(rows.map((r) => r.testType))).sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.testType !== typeFilter) return false;
      if (needle) {
        const hay = [r.testName, r.location, r.snowType, r.createdByName,
          ...(r.pairLabels ?? []), ...((r.pairGroups ?? []).filter(Boolean) as string[])].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, typeFilter]);

  if (isLoading) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>;
  return (
    <div className="flex flex-col gap-3">
      <Card className="fs-card rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={L("Søk navn, sted, par, serie…", "Search name, location, pair, series…")}
              className="h-9 pl-8 text-sm" data-testid="fleet-tests-search" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{filtered.length}/{rows.length}</span>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">
          {rows.length === 0
            ? L("Ingen tester med fleet-ski ennå — start en gruppetest fra Register-fanen.", "No tests with fleet skis yet — start a group test from the Register tab.")
            : L("Ingen tester matcher filtrene.", "No tests match the filters.")}
        </Card>
      ) : (
        /* Expandable test cards — the same reading pattern as Athlete Skis. */
        <div className="flex flex-col gap-2">
          {filtered.map((r) => {
            const winner = r.bestRank != null ? r.pairLabels?.[0] : null;
            const winnerGroup = r.bestRank != null ? r.pairGroups?.[0] : null;
            const isOpen = expanded.has(r.testId);
            return (
              <Card key={r.testId} className="fs-card rounded-2xl overflow-hidden">
                <button type="button" onClick={() => toggleExpanded(r.testId)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-muted/20"
                  data-testid={`fleet-test-${r.testId}`}>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{r.date}</span>
                  <span className="min-w-[140px] flex-1 truncate text-sm font-medium">{r.testName || r.location}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{r.testType}</span>
                  {r.resultUnit === "time" && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">{L("tid", "time")}</span>}
                  {(r.snowTemperatureC != null || r.snowType) && (
                    <span className="text-[11px] text-muted-foreground">
                      {r.snowTemperatureC != null ? `${L("Snø", "Snow")} ${r.snowTemperatureC}°` : ""}{r.snowTemperatureC != null && r.snowType ? " · " : ""}{r.snowType ?? ""}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">{r.fleetEntryCount} {L("par", "pairs")}</span>
                  {winner && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400/25 to-yellow-300/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 ring-1 ring-amber-300 dark:text-amber-400 dark:ring-amber-700">
                      <Trophy className="h-3 w-3" />
                      {winner}{winnerGroup ? ` · ${winnerGroup}` : ""}
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t border-border/60 px-4 py-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="pb-1.5 pr-3">{L("Ski-ID (serie)", "Ski ID (series)")}</th>
                          <th className="pb-1.5 pr-3">{L("Slip", "Grind")}</th>
                          <th className="pb-1.5 pr-3 text-right">{r.resultUnit === "time" ? L("Tid (s)", "Time (s)") : "cm"}</th>
                          <th className="pb-1.5 text-right">{L("Rang", "Rank")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {(r.entries ?? []).map((e, i) => (
                          <tr key={i} className={cn(e.rank === 1 && "bg-amber-50/50 dark:bg-amber-950/10")}>
                            <td className="py-1.5 pr-3 text-xs font-semibold">
                              {e.skiLabel}{e.group ? <span className="font-normal text-muted-foreground"> ({e.group})</span> : null}
                            </td>
                            <td className="py-1.5 pr-3 text-xs text-muted-foreground">{e.grind || "—"}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-xs">{e.result ?? "—"}</td>
                            <td className={cn("py-1.5 text-right text-xs font-semibold tabular-nums", e.rank === 1 && "text-amber-600 dark:text-amber-400")}>{e.rank ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-1.5 flex justify-end">
                      <AppLink href={`/tests/${r.testId}`} className="text-xs font-medium text-primary hover:underline">
                        {L("Åpne testen →", "Open the test →")}
                      </AppLink>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
