import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Search, Layers, Snowflake, MapPin, Calendar, Clock, Users, Thermometer, LayoutGrid, List, X, SlidersHorizontal, Eye, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useLocation } from "wouter";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { parseApplication } from "@/lib/parse-application";
import { cn } from "@/lib/utils";

type CTEntry = {
  skiNumber: number;
  productNames: string[];
  methodology: string;
  rounds: { result: number | null; rank: number | null }[];
  feelingRank: number | null;
  kickRank: number | null;
};

type CTWeather = {
  snowType?: string | null;
  snowTemperatureC?: number | null;
  airTemperatureC?: number | null;
  airHumidityPct?: number | null;
  snowHumidityPct?: number | null;
  clouds?: number | null;
  artificialSnow?: string | null;
  naturalSnow?: string | null;
  snowHumidityType?: string | null;
  grainSize?: string | null;
  trackHardness?: string | null;
  precipitation?: string | null;
  wind?: string | null;
  visibility?: string | null;
};

type CrossTeamTest = {
  id: number;
  date: string | null;
  startTime?: string | null;
  location: string;
  testName: string | null;
  testType: string;
  teamId: number;
  teamName: string;
  createdByName?: string | null;
  seriesName?: string | null;
  weather: CTWeather | null;
  distanceLabels?: string[];
  entries?: CTEntry[];
};

const numv = (s: string) => (s.trim() === "" ? null : parseFloat(s));
const swap = (a: number | null, b: number | null): [number | null, number | null] => (a != null && b != null && a > b ? [b, a] : [a, b]);

export default function CrossTeamTests() {
  const { language } = useI18n();
  const { user } = useAuth();
  const activeTeamId = (user as any)?.activeTeamId ?? user?.teamId;
  // A test from ANOTHER team opens in the read-only cross-team view — editing
  // requires switching to the owning team.
  const testHref = (tt: { id: number; teamId: number }) =>
    tt.teamId === activeTeamId ? `/tests/${tt.id}` : `/tests/cross/${tt.id}`;
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, navigate] = useLocation();

  // View: compact cards / list, or the expanded "Show all" day-view grid.
  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    try { const s = localStorage.getItem("glidr-allteams-view"); if (s === "list" || s === "cards") return s; } catch {}
    return "cards";
  });
  const setView = (m: "cards" | "list") => { setViewMode(m); try { localStorage.setItem("glidr-allteams-view", m); } catch {} };
  const [showAll, setShowAll] = useState(false);
  // Tests list, or the cross-team engines built on the same data.
  const [tab, setTab] = useState<"tests" | "analytics" | "suggestions">("tests");

  // "Show all" and both engines need the full result rows resolved server-side.
  const needEntries = showAll || tab !== "tests";
  const { data: tests = [], isLoading, error } = useQuery<CrossTeamTest[]>({
    queryKey: [`/api/tests/cross-team${needEntries ? "?withEntries=1" : ""}`],
    queryFn: getQueryFn({ on401: "returnNull" }) as any,
    retry: false,
  });

  // Your active team's product catalog — only these product names can be analysed
  // (Analytics works on your own team's data), so only they get a clickable link.
  const { data: myProducts = [] } = useQuery<{ id: number; brand: string | null; name: string | null }[]>({
    queryKey: ["/api/products"],
  });
  const analysableNames = useMemo(
    () => new Set(myProducts.map((p) => `${p.brand ?? ""} ${p.name ?? ""}`.trim().toLowerCase())),
    [myProducts],
  );

  const [cols, setCols] = useState<1 | 2 | 3>(() => {
    try { const s = parseInt(localStorage.getItem("glidr-allteams-cols") || "2"); if (s === 1 || s === 2 || s === 3) return s as any; } catch {}
    return 2;
  });
  const setColumns = (n: 1 | 2 | 3) => { setCols(n); try { localStorage.setItem("glidr-allteams-cols", String(n)); } catch {} };
  const [weatherOpen, setWeatherOpen] = useState(false);

  // Filters — mirrors the regular Tests page.
  const [search, setSearch] = useState("");
  // Multi-select: every team is ON by default; unchecking hides its tests.
  const [excludedTeams, setExcludedTeams] = useState<Set<number>>(new Set());
  const [typeFilter, setTypeFilter] = useState("all");
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [airMin, setAirMin] = useState(""); const [airMax, setAirMax] = useState("");
  const [snowMin, setSnowMin] = useState(""); const [snowMax, setSnowMax] = useState("");
  const [airHumMin, setAirHumMin] = useState(""); const [airHumMax, setAirHumMax] = useState("");
  const [snowHumMin, setSnowHumMin] = useState(""); const [snowHumMax, setSnowHumMax] = useState("");
  const [cloudMin, setCloudMin] = useState(""); const [cloudMax, setCloudMax] = useState("");
  const [artSnow, setArtSnow] = useState("all");
  const [natSnow, setNatSnow] = useState("all");
  const [snowHumType, setSnowHumType] = useState("all");
  const [grainSize, setGrainSize] = useState("all");
  const [trackHardness, setTrackHardness] = useState("all");
  const [precipitation, setPrecipitation] = useState("");
  const [wind, setWind] = useState("");
  const [visibility, setVisibility] = useState("");
  const [sort, setSort] = useState("date-desc");

  const teamOptions = useMemo(() => Array.from(new Map(tests.map((t) => [t.teamId, t.teamName])).entries()), [tests]);
  const typeOptions = useMemo(() => Array.from(new Set(tests.map((t) => t.testType).filter(Boolean))).sort(), [tests]);
  const locationOptions = useMemo(() => Array.from(new Set(tests.map((t) => t.location).filter(Boolean))).sort(), [tests]);
  const distinct = (get: (w: CTWeather) => string | null | undefined) =>
    Array.from(new Set(tests.map((t) => t.weather ? get(t.weather) : null).filter(Boolean) as string[])).sort();
  const artOptions = useMemo(() => distinct((w) => w.artificialSnow), [tests]);
  const natOptions = useMemo(() => distinct((w) => w.naturalSnow), [tests]);
  const humTypeOptions = useMemo(() => distinct((w) => w.snowHumidityType), [tests]);
  const grainOptions = useMemo(() => distinct((w) => w.grainSize), [tests]);
  const trackOptions = useMemo(() => distinct((w) => w.trackHardness), [tests]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const [aMin, aMax] = swap(numv(airMin), numv(airMax));
    const [sMin, sMax] = swap(numv(snowMin), numv(snowMax));
    const [ahMin, ahMax] = swap(numv(airHumMin), numv(airHumMax));
    const [shMin, shMax] = swap(numv(snowHumMin), numv(snowHumMax));
    const [cMin, cMax] = swap(numv(cloudMin), numv(cloudMax));
    const txt = (val: string, field?: string | null) => !val || (field ?? "").toLowerCase().includes(val.toLowerCase());
    const list = tests.filter((t) => {
      if (excludedTeams.has(t.teamId)) return false;
      if (typeFilter !== "all" && t.testType !== typeFilter) return false;
      if (location && !t.location.toLowerCase().includes(location.toLowerCase())) return false;
      if (dateFrom && (t.date ?? "") < dateFrom) return false;
      if (dateTo && (t.date ?? "") > dateTo) return false;
      const w = t.weather;
      if (aMin != null && (!w || w.airTemperatureC == null || w.airTemperatureC < aMin)) return false;
      if (aMax != null && (!w || w.airTemperatureC == null || w.airTemperatureC > aMax)) return false;
      if (sMin != null && (!w || w.snowTemperatureC == null || w.snowTemperatureC < sMin)) return false;
      if (sMax != null && (!w || w.snowTemperatureC == null || w.snowTemperatureC > sMax)) return false;
      if (ahMin != null && (!w || w.airHumidityPct == null || w.airHumidityPct < ahMin)) return false;
      if (ahMax != null && (!w || w.airHumidityPct == null || w.airHumidityPct > ahMax)) return false;
      if (shMin != null && (!w || w.snowHumidityPct == null || w.snowHumidityPct < shMin)) return false;
      if (shMax != null && (!w || w.snowHumidityPct == null || w.snowHumidityPct > shMax)) return false;
      if (cMin != null && (!w || (w.clouds ?? 999) < cMin)) return false;
      if (cMax != null && (!w || (w.clouds ?? -999) > cMax)) return false;
      if (artSnow !== "all" && (w?.artificialSnow ?? "") !== artSnow) return false;
      if (natSnow !== "all" && (w?.naturalSnow ?? "") !== natSnow) return false;
      if (snowHumType !== "all" && (w?.snowHumidityType ?? "") !== snowHumType) return false;
      if (grainSize !== "all" && (w?.grainSize ?? "") !== grainSize) return false;
      if (trackHardness !== "all" && (w?.trackHardness ?? "") !== trackHardness) return false;
      if (!txt(precipitation, w?.precipitation)) return false;
      if (!txt(wind, w?.wind)) return false;
      if (!txt(visibility, w?.visibility)) return false;
      if (q && !(
        t.location.toLowerCase().includes(q) ||
        (t.testName ?? "").toLowerCase().includes(q) ||
        t.teamName.toLowerCase().includes(q) ||
        (t.weather?.snowType ?? "").toLowerCase().includes(q) ||
        (t.createdByName ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case "date-asc": return (a.date ?? "").localeCompare(b.date ?? "");
        case "location-az": return a.location.localeCompare(b.location);
        case "location-za": return b.location.localeCompare(a.location);
        default: return (b.date ?? "").localeCompare(a.date ?? "");
      }
    });
    return list;
  }, [tests, excludedTeams, typeFilter, location, dateFrom, dateTo, airMin, airMax, snowMin, snowMax, airHumMin, airHumMax, snowHumMin, snowHumMax, cloudMin, cloudMax, artSnow, natSnow, snowHumType, grainSize, trackHardness, precipitation, wind, visibility, q, sort]);

  const hasFilters = !!(q || excludedTeams.size > 0 || typeFilter !== "all" || location || dateFrom || dateTo || airMin || airMax || snowMin || snowMax || airHumMin || airHumMax || snowHumMin || snowHumMax || cloudMin || cloudMax || artSnow !== "all" || natSnow !== "all" || snowHumType !== "all" || grainSize !== "all" || trackHardness !== "all" || precipitation || wind || visibility);
  const clearFilters = () => { setSearch(""); setExcludedTeams(new Set()); setTypeFilter("all"); setLocation(""); setDateFrom(""); setDateTo(""); setAirMin(""); setAirMax(""); setSnowMin(""); setSnowMax(""); setAirHumMin(""); setAirHumMax(""); setSnowHumMin(""); setSnowHumMax(""); setCloudMin(""); setCloudMax(""); setArtSnow("all"); setNatSnow("all"); setSnowHumType("all"); setGrainSize("all"); setTrackHardness("all"); setPrecipitation(""); setWind(""); setVisibility(""); };

  const isForbidden = (error as any)?.message?.includes("403");

  const range = (lblMin: string, lblMax: string, minV: string, setMin: (v: string) => void, maxV: string, setMax: (v: string) => void, label: string, dot: string) => (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />{label}</label>
      <div className="flex items-center gap-1">
        <Input className="h-8 text-xs" placeholder={lblMin} value={minV} onChange={(e) => setMin(e.target.value)} inputMode="numeric" />
        <span className="text-muted-foreground">–</span>
        <Input className="h-8 text-xs" placeholder={lblMax} value={maxV} onChange={(e) => setMax(e.target.value)} inputMode="numeric" />
      </div>
    </div>
  );
  const drop = (label: string, val: string, setVal: (v: string) => void, opts: string[], dot: string) => (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />{label}</label>
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{L("— Alle —", "— Any —")}</SelectItem>
          {opts.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
  const txtField = (label: string, val: string, setVal: (v: string) => void, ph: string, dot: string) => (
    <div>
      <label className="mb-1 flex items-center gap-1 text-xs text-muted-foreground"><span className={cn("inline-block h-1.5 w-1.5 rounded-full", dot)} />{label}</label>
      <Input className="h-8 text-xs" placeholder={ph} value={val} onChange={(e) => setVal(e.target.value)} />
    </div>
  );

  const weatherChips = (t: CrossTeamTest, big = false) => {
    const w = t.weather; if (!w) return null;
    const items: string[] = [];
    if (w.airTemperatureC != null) items.push(`${L("Luft", "Air")} ${w.airTemperatureC}°`);
    if (w.snowTemperatureC != null) items.push(`${L("Snø", "Snow")} ${w.snowTemperatureC}°`);
    if (w.airHumidityPct != null) items.push(`${L("Luftfukt", "Air hum")} ${w.airHumidityPct}%`);
    if (w.snowHumidityPct != null) items.push(`${L("Snøfukt", "Snow hum")} ${w.snowHumidityPct}%`);
    if (w.trackHardness) items.push(`${L("Spor", "Track")}: ${w.trackHardness}`);
    if (w.wind) items.push(`${L("Vind", "Wind")}: ${w.wind}`);
    return (
      <div className={cn("mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1", big ? "text-[11px]" : "text-[11px]")}>
        {w.snowType && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-sky-700 dark:text-sky-300"><Snowflake className="h-3 w-3" />{w.snowType}</span>}
        {items.length > 0 && <span className="text-muted-foreground">{items.join(" · ")}</span>}
      </div>
    );
  };

  const headerLine = (t: CrossTeamTest) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{t.teamName}</span>
      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</span>
      {t.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(t.date).toLocaleDateString()}</span>}
      {t.startTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.startTime}</span>}
    </div>
  );

  const rankBadge = (rank: number | null) => (
    <span className={cn("inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
      rank === 1 ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400" :
      rank === 2 ? "bg-slate-300/15 text-slate-500 dark:text-slate-300" :
      rank === 3 ? "bg-amber-700/15 text-amber-700 dark:text-amber-600" :
      rank != null ? "bg-muted/70 text-foreground" : "text-muted-foreground")}>{rank ?? "—"}</span>
  );

  // Full result table for a test (used in "Show all"), mirroring the day view.
  const entryTable = (t: CrossTeamTest) => {
    const labels = t.distanceLabels ?? [];
    const entries = t.entries ?? [];
    if (entries.length === 0) return <div className="mt-2 text-[11px] text-muted-foreground">{L("Ingen resultater", "No results")}</div>;
    const hasKick = entries.some((e) => e.kickRank != null);
    return (
      <div className="mt-2 overflow-x-auto border-t border-border/40 pt-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-1.5 pr-2">Ski</th>
              <th className="pb-1.5 pr-2">{L("Produkt", "Product")}</th>
              {labels.map((lbl, i) => (<th key={i} className="pb-1.5 pr-2">{lbl?.trim() || `R${i + 1}`}</th>))}
              <th className="pb-1.5 pr-2">Rank</th>
              <th className="pb-1.5 pr-2">{L("Følelse", "Feel")}</th>
              {hasKick && <th className="pb-1.5">Kick</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((e, idx) => {
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
                          const analysable = analysableNames.has(name.trim().toLowerCase());
                          return <span key={i} className="flex items-baseline gap-1">
                            {analysable ? (
                              <button type="button" onClick={(ev) => { ev.stopPropagation(); navigate(`/analytics?tab=products&productName=${encodeURIComponent(name)}`); }} className="font-medium text-left text-sky-600 dark:text-sky-400 underline decoration-sky-400/60 decoration-1 underline-offset-2 hover:decoration-sky-500 transition-colors" title={L("Se analyse for produktet", "See product analytics")}>{name}</button>
                            ) : (
                              <span className="font-medium" title={L("Ikke i ditt lags produkter — kan ikke analyseres", "Not in your team's products — can't be analysed")}>{name}</span>
                            )}
                            {app && <span className="text-muted-foreground">{app}</span>}
                          </span>;
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-crossteam-title">{L("Alle lag – glidtester", "All teams – glide tests")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{L("Søk og filtrer glidtester på tvers av alle lagene du har tilgang til.", "Search and filter glide tests across every team you can access.")}</p>
          </div>
        </div>

        {/* Tabs: the list, and the two engines running on every accessible team */}
        <div className="flex gap-1 border-b border-border">
          {([
            ["tests", L("Tester", "Tests")],
            ["analytics", "Analytics"],
            ["suggestions", L("Forslag", "Suggestions")],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              data-testid={`crossteam-tab-${key}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "analytics" && (
          <CrossTeamAnalytics tests={tests} loading={isLoading} L={L} testHref={testHref} />
        )}
        {tab === "suggestions" && (
          <CrossTeamSuggestions tests={tests} loading={isLoading} L={L} testHref={testHref} />
        )}

        {tab === "tests" && (<>
        {/* Filters */}
        <Card className="fs-card rounded-2xl p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={L("Søk sted, navn, lag, snø, smører…", "Search location, name, team, snow, tester…")} className="pl-9" data-testid="input-crossteam-search" />
              </div>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">{L("Nyeste først", "Newest first")}</SelectItem>
                  <SelectItem value="date-asc">{L("Eldste først", "Oldest first")}</SelectItem>
                  <SelectItem value="location-az">{L("Sted A–Å", "Location A–Z")}</SelectItem>
                  <SelectItem value="location-za">{L("Sted Å–A", "Location Z–A")}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-9 gap-1 text-xs" onClick={() => setWeatherOpen((v) => !v)} data-testid="allteams-toggle-weather">
                <SlidersHorizontal className="h-3.5 w-3.5" />{L("Værforhold", "Weather conditions")}
              </Button>
              {hasFilters && <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground" onClick={clearFilters} data-testid="allteams-clear"><X className="h-3.5 w-3.5" />{L("Nullstill", "Clear")}</Button>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9 justify-between gap-1 text-xs font-normal" data-testid="filter-crossteam-team">
                    <span className="truncate">
                      {excludedTeams.size === 0
                        ? L("Alle lag", "All teams")
                        : L(`${teamOptions.length - excludedTeams.size} av ${teamOptions.length} lag`, `${teamOptions.length - excludedTeams.size} of ${teamOptions.length} teams`)}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-[50vh] overflow-y-auto">
                  {teamOptions.map(([id, name]) => (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={!excludedTeams.has(id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(on) => setExcludedTeams((prev) => {
                        const next = new Set(prev);
                        on ? next.delete(id) : next.add(id);
                        return next;
                      })}
                      data-testid={`filter-team-${id}`}
                    >
                      {name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 gap-1 text-xs" data-testid="filter-crossteam-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
                  {typeOptions.map((tp) => (<SelectItem key={tp} value={tp}>{tp}</SelectItem>))}
                </SelectContent>
              </Select>
              <LocationAutocomplete value={location} onChange={setLocation} placeholder={L("Sted", "Location")} inputClassName="h-9 text-xs" data-testid="filter-crossteam-location" options={locationOptions} />
              <div className="flex items-center gap-1 col-span-2 sm:col-span-1">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" title={L("Fra dato", "Date from")} />
                <span className="text-muted-foreground">–</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" title={L("Til dato", "Date to")} />
              </div>
            </div>

            {weatherOpen && (
              <div className="mt-1 border-t border-border pt-3" data-testid="allteams-weather-block">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Temperatur og fuktighet", "Temperature & humidity")}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {range(L("Min", "Min"), L("Max", "Max"), airMin, setAirMin, airMax, setAirMax, L("Lufttemp (°C)", "Air temp (°C)"), "bg-blue-400")}
                  {range(L("Min", "Min"), L("Max", "Max"), snowMin, setSnowMin, snowMax, setSnowMax, L("Snøtemp (°C)", "Snow temp (°C)"), "bg-emerald-400")}
                  {range(L("Min", "Min"), L("Max", "Max"), airHumMin, setAirHumMin, airHumMax, setAirHumMax, L("Luftfukt (%rH)", "Air humidity (%rH)"), "bg-purple-400")}
                  {range(L("Min", "Min"), L("Max", "Max"), snowHumMin, setSnowHumMin, snowHumMax, setSnowHumMax, L("Snøfukt (%)", "Snow humidity (%)"), "bg-yellow-400")}
                  {range(L("Min", "Min"), L("Max", "Max"), cloudMin, setCloudMin, cloudMax, setCloudMax, L("Skydekke (%)", "Cloud cover (%)"), "bg-gray-400")}
                </div>
                <div className="mt-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Snøtype", "Snow type")}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {drop(L("Kunstsnø", "Artificial snow"), artSnow, setArtSnow, artOptions, "bg-indigo-400")}
                  {drop(L("Natursnø", "Natural snow"), natSnow, setNatSnow, natOptions, "bg-teal-400")}
                  {drop(L("Snøfukt-type", "Snow humidity type"), snowHumType, setSnowHumType, humTypeOptions, "bg-cyan-400")}
                  {drop(L("Kornstørrelse", "Grain size"), grainSize, setGrainSize, grainOptions, "bg-lime-400")}
                </div>
                <div className="mt-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Snø og spor", "Snow & track")}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {drop(L("Sporhardhet", "Track hardness"), trackHardness, setTrackHardness, trackOptions, "bg-orange-400")}
                  {txtField(L("Nedbør", "Precipitation"), precipitation, setPrecipitation, L("f.eks. Lett snø", "e.g. Light snow"), "bg-blue-400")}
                  {txtField(L("Vind", "Wind"), wind, setWind, "e.g. Light NW", "bg-purple-400")}
                  {txtField(L("Sikt", "Visibility"), visibility, setVisibility, "e.g. Good", "bg-pink-400")}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Results toolbar */}
        {!isForbidden && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{filtered.length} {L("tester", "tests")}</span>
            <div className="flex items-center gap-2">
              {showAll && (
                <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5" data-testid="allteams-cols">
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setColumns(n as 1 | 2 | 3)} className={cn("rounded-md px-2.5 py-1 text-xs transition-colors", cols === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`allteams-col-${n}`}>{n} {L("kol", "col")}</button>
                  ))}
                </div>
              )}
              {!showAll && (
                <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5">
                  <button onClick={() => setView("cards")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs", viewMode === "cards" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><LayoutGrid className="h-3.5 w-3.5" />{L("Kort", "Cards")}</button>
                  <button onClick={() => setView("list")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}><List className="h-3.5 w-3.5" />{L("Liste", "List")}</button>
                </div>
              )}
              <Button size="sm" variant={showAll ? "default" : "outline"} className="h-8 gap-1 text-xs" onClick={() => setShowAll((v) => !v)} data-testid="allteams-show-all">
                <Eye className="h-3.5 w-3.5" />{showAll ? L("Lukk", "Close") : L("Vis alle", "Show all")}
              </Button>
            </div>
          </div>
        )}

        {isForbidden ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="crossteam-forbidden">
            {L("Du har ikke tilgang til «Alle lag». Be en lagadmin om tilgang.", "You don't have access to All teams. Ask a team admin to grant it.")}
          </Card>
        ) : isLoading ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>
        ) : filtered.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-crossteam">
            {tests.length === 0 ? L("Ingen glidtester å vise på tvers av lagene dine.", "No glide tests to show across your teams.") : L("Ingen tester samsvarer med filtrene.", "No tests match the filters.")}
          </Card>
        ) : showAll ? (
          /* Show all — expanded day-view-style cards, column count selectable */
          <div className={cn("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")} data-testid="allteams-showall">
            {filtered.map((t) => (
              <Card key={`${t.teamId}-${t.id}`} className="fs-card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t.testName || t.location}</div>
                    <div className="mt-1">{headerLine(t)}</div>
                    {weatherChips(t, true)}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"><Layers className="h-3 w-3" />{t.testType}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate(`/tests/${t.id}`)} data-testid={`open-crossteam-${t.id}`}>{L("Åpne", "Open")}</Button>
                  </div>
                </div>
                {entryTable(t)}
              </Card>
            ))}
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((t) => (
              <AppLink key={`${t.teamId}-${t.id}`} href={testHref(t)} testId={`link-crossteam-test-${t.id}`}>
                <Card className="fs-card rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-foreground">{t.testName || t.location}</div>
                      <div className="mt-1">{headerLine(t)}</div>
                      {weatherChips(t)}
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shrink-0"><Layers className="h-3 w-3" />{t.testType}</span>
                  </div>
                </Card>
              </AppLink>
            ))}
          </div>
        ) : (
          <Card className="fs-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2.5 font-medium">{L("Dato", "Date")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Tid", "Time")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Lag", "Team")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Sted", "Location")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Type", "Type")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Snø", "Snow")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Luft °", "Air °")}</th>
                    <th className="px-3 py-2.5 font-medium">{L("Snø °", "Snow °")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((t) => (
                    <tr key={`${t.teamId}-${t.id}`} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => navigate(`/tests/${t.id}`)} data-testid={`row-crossteam-${t.id}`}>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{t.date ? new Date(t.date).toLocaleDateString() : "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{t.startTime || "—"}</td>
                      <td className="px-3 py-2 text-xs">{t.teamName}</td>
                      <td className="px-3 py-2 text-xs font-medium">{t.location || "—"}</td>
                      <td className="px-3 py-2 text-xs"><span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{t.testType}</span></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.weather?.snowType || "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.weather?.airTemperatureC != null ? `${t.weather.airTemperatureC}°` : "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.weather?.snowTemperatureC != null ? `${t.weather.snowTemperatureC}°` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
        </>)}
      </div>
    </AppShell>
  );
}

// ── Shared engine plumbing ───────────────────────────────────────────────────
// Both engines run on the SAME dataset the list shows: every test the caller
// may read, from every team they belong to — per-team access resolved on the
// server. Ranks are unit-agnostic (cm and photocell time tests both store a
// primary rank), so cross-team aggregation never mixes units.

type ProductAgg = {
  name: string;
  tests: number;
  wins: number;
  podiums: number;
  rankSum: number;
  ranked: number;
  teams: Set<string>;
  lastDate: string | null;
};

function aggregateProducts(tests: CrossTeamTest[]): Map<string, ProductAgg> {
  const map = new Map<string, ProductAgg>();
  for (const t of tests) {
    for (const e of t.entries ?? []) {
      const rank = e.rounds?.[0]?.rank ?? null;
      for (const name of e.productNames ?? []) {
        const key = name.toLowerCase();
        let agg = map.get(key);
        if (!agg) {
          agg = { name, tests: 0, wins: 0, podiums: 0, rankSum: 0, ranked: 0, teams: new Set(), lastDate: null };
          map.set(key, agg);
        }
        agg.tests++;
        agg.teams.add(t.teamName);
        if (t.date && (!agg.lastDate || t.date > agg.lastDate)) agg.lastDate = t.date;
        if (rank != null) {
          agg.ranked++;
          agg.rankSum += rank;
          if (rank === 1) agg.wins++;
          if (rank <= 3) agg.podiums++;
        }
      }
    }
  }
  return map;
}

function seasonOf(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const y = d.getMonth() >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}/${String(y + 1).slice(2)}`;
}

function CrossTeamAnalytics({ tests, loading, L, testHref }: {
  tests: CrossTeamTest[];
  loading: boolean;
  L: (no: string, en: string) => string;
  testHref: (t: { id: number; teamId: number }) => string;
}) {
  const [season, setSeason] = useState("All");
  const [type, setType] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");

  const seasons = useMemo(() => Array.from(new Set(tests.map((t) => seasonOf(t.date)))).filter((x) => x !== "—").sort().reverse(), [tests]);
  const teams = useMemo(() => Array.from(new Set(tests.map((t) => t.teamName))).sort(), [tests]);

  const scoped = useMemo(() => tests.filter((t) =>
    (season === "All" || seasonOf(t.date) === season) &&
    (type === "all" || t.testType === type) &&
    (teamFilter === "all" || t.teamName === teamFilter)
  ), [tests, season, type, teamFilter]);

  const rows = useMemo(() => {
    const list = Array.from(aggregateProducts(scoped).values());
    list.sort((a, b) => b.wins - a.wins || (a.ranked ? a.rankSum / a.ranked : 99) - (b.ranked ? b.rankSum / b.ranked : 99) || b.tests - a.tests);
    return list;
  }, [scoped]);

  const venues = useMemo(() => new Set(scoped.map((t) => t.location)).size, [scoped]);

  if (loading) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="fs-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{L("Alle sesonger", "All seasons")}</SelectItem>
              {seasons.map((se) => <SelectItem key={se} value={se}>{se}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
              <SelectItem value="Glide">Glide</SelectItem>
              <SelectItem value="Structure">Structure</SelectItem>
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("Alle lag", "All teams")}</SelectItem>
              {teams.map((tn) => <SelectItem key={tn} value={tn}>{tn}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground">
            {L(`${scoped.length} tester · ${teams.length} lag · ${venues} steder`, `${scoped.length} tests · ${teams.length} teams · ${venues} venues`)}
          </span>
        </div>
      </Card>

      <Card className="fs-card rounded-2xl overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{L("Produkter på tvers av lagene", "Products across the teams")}</h2>
          <p className="text-xs text-muted-foreground">{L("Rangeringsbasert — seire, pallplasser og snittrangering fra alle tilgjengelige tester.", "Rank-based — wins, podiums and average rank from every accessible test.")}</p>
        </div>
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{L("Ingen resultater i utvalget.", "No results in this scope.")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">{L("Produkt", "Product")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Tester", "Tests")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Seire", "Wins")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Pall", "Podium")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Snittrang", "Avg rank")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Lag", "Teams")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Sist testet", "Last tested")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={r.name} className={cn(i === 0 && "bg-amber-50/50 dark:bg-amber-950/10")}>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{r.tests}</td>
                    <td className={cn("px-3 py-2 text-xs text-right tabular-nums", r.wins > 0 && "font-semibold text-amber-600 dark:text-amber-400")}>{r.wins}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{r.podiums}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{r.ranked ? (r.rankSum / r.ranked).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{Array.from(r.teams).join(", ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.lastDate ? new Date(r.lastDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 50 && <p className="px-4 py-2 text-[11px] text-muted-foreground">{L(`Viser topp 50 av ${rows.length} produkter.`, `Showing top 50 of ${rows.length} products.`)}</p>}
      </Card>
    </div>
  );
}

function CrossTeamSuggestions({ tests, loading, L, testHref }: {
  tests: CrossTeamTest[];
  loading: boolean;
  L: (no: string, en: string) => string;
  testHref: (t: { id: number; teamId: number }) => string;
}) {
  const [air, setAir] = useState("");
  const [snow, setSnow] = useState("");
  const [tol, setTol] = useState("3");
  const [snowType, setSnowType] = useState("");

  const airN = numv(air), snowN = numv(snow), tolN = numv(tol) ?? 3;

  // Tests under similar conditions, from every team the caller can read.
  const matching = useMemo(() => {
    if (airN == null && snowN == null && !snowType.trim()) return [];
    return tests.filter((t) => {
      const w = t.weather;
      if (!w) return false;
      if (airN != null && (w.airTemperatureC == null || Math.abs(w.airTemperatureC - airN) > tolN)) return false;
      if (snowN != null && (w.snowTemperatureC == null || Math.abs(w.snowTemperatureC - snowN) > tolN)) return false;
      if (snowType.trim()) {
        const label = [w.snowType, w.artificialSnow, w.naturalSnow].filter(Boolean).join(" ").toLowerCase();
        if (!label.includes(snowType.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [tests, airN, snowN, tolN, snowType]);

  const rows = useMemo(() => {
    const list = Array.from(aggregateProducts(matching).values());
    // Suggestion order: win rate first (with enough evidence), then avg rank.
    list.sort((a, b) => {
      const wa = a.ranked ? a.wins / a.ranked : 0;
      const wb = b.ranked ? b.wins / b.ranked : 0;
      return wb - wa || (a.ranked ? a.rankSum / a.ranked : 99) - (b.ranked ? b.rankSum / b.ranked : 99);
    });
    return list;
  }, [matching]);

  if (loading) return <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>;

  return (
    <div className="flex flex-col gap-4">
      <Card className="fs-card rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{L("Hva har vunnet under lignende forhold?", "What has won in similar conditions?")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {L("Skriv inn dagens forhold — forslagene bygger på alle tester fra alle lagene du har tilgang til.",
             "Enter today's conditions — suggestions draw on every test from every team you can access.")}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L("Luft °C", "Air °C")}</label>
            <Input value={air} onChange={(e) => setAir(e.target.value)} inputMode="decimal" placeholder="-4" className="h-8 w-20 text-xs" data-testid="ct-sug-air" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{L("Snø °C", "Snow °C")}</label>
            <Input value={snow} onChange={(e) => setSnow(e.target.value)} inputMode="decimal" placeholder="-8" className="h-8 w-20 text-xs" data-testid="ct-sug-snow" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">± {L("toleranse", "tolerance")}</label>
            <Input value={tol} onChange={(e) => setTol(e.target.value)} inputMode="decimal" className="h-8 w-16 text-xs" />
          </div>
          <div className="min-w-[140px]">
            <label className="mb-1 block text-xs text-muted-foreground">{L("Snøtype (valgfritt)", "Snow type (optional)")}</label>
            <Input value={snowType} onChange={(e) => setSnowType(e.target.value)} placeholder={L("f.eks. omdannet", "e.g. transformed")} className="h-8 text-xs" />
          </div>
          <span className="pb-1.5 text-xs text-muted-foreground">
            {airN == null && snowN == null && !snowType.trim()
              ? L("Fyll inn minst ett felt.", "Fill in at least one field.")
              : L(`${matching.length} tester matcher`, `${matching.length} matching tests`)}
          </span>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="fs-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">{L("Produkt", "Product")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Seiersrate", "Win rate")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Snittrang", "Avg rank")}</th>
                  <th className="px-3 py-2.5 font-medium text-right">{L("Tester", "Tests")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Lag", "Teams")}</th>
                  <th className="px-3 py-2.5 font-medium">{L("Sist", "Last")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={r.name} className={cn(i === 0 && "bg-amber-50/50 dark:bg-amber-950/10")}>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-xs font-medium">{r.name}</td>
                    <td className={cn("px-3 py-2 text-xs text-right tabular-nums", i === 0 && "font-semibold text-amber-600 dark:text-amber-400")}>
                      {r.ranked ? `${Math.round((r.wins / r.ranked) * 100)}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{r.ranked ? (r.rankSum / r.ranked).toFixed(2) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">{r.tests}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{Array.from(r.teams).join(", ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.lastDate ? new Date(r.lastDate).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {matching.length > 0 && (
        <Card className="fs-card rounded-2xl p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{L("Testene bak forslagene", "The tests behind the suggestions")}</h3>
          <div className="flex flex-wrap gap-1.5">
            {matching.slice(0, 12).map((t) => (
              <AppLink key={`${t.teamId}-${t.id}`} href={testHref(t)}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted/70 hover:text-foreground">
                {t.teamName} · {t.location} · {t.date ? new Date(t.date).toLocaleDateString() : ""}
              </AppLink>
            ))}
            {matching.length > 12 && <span className="px-1 py-1 text-[11px] text-muted-foreground">+{matching.length - 12}</span>}
          </div>
        </Card>
      )}
    </div>
  );
}
