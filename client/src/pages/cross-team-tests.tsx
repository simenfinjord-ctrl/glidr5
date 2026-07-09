import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Search, Layers, Snowflake, MapPin, Calendar, Users, Thermometer, LayoutGrid, List, Trophy, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CTWeather = {
  snowType?: string | null;
  snowTemperatureC?: number | null;
  airTemperatureC?: number | null;
  airHumidityPct?: number | null;
  snowHumidityPct?: number | null;
  artificialSnow?: string | null;
  naturalSnow?: string | null;
  snowHumidityType?: string | null;
  grainSize?: string | null;
  trackHardness?: string | null;
};

type CrossTeamTest = {
  id: number;
  date: string | null;
  location: string;
  testName: string | null;
  testType: string;
  teamId: number;
  teamName: string;
  createdByName?: string | null;
  seriesName?: string | null;
  weather: CTWeather | null;
};

const num = (s: string) => (s.trim() === "" ? null : parseFloat(s));

export default function CrossTeamTests() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const { data: tests = [], isLoading, error } = useQuery<CrossTeamTest[]>({
    queryKey: ["/api/tests/cross-team"],
    queryFn: getQueryFn({ on401: "returnNull" }) as any,
    retry: false,
  });

  const [viewMode, setViewMode] = useState<"cards" | "list">(() => {
    try { const s = localStorage.getItem("glidr-allteams-view"); if (s === "list" || s === "cards") return s; } catch {}
    return "cards";
  });
  const setView = (m: "cards" | "list") => { setViewMode(m); try { localStorage.setItem("glidr-allteams-view", m); } catch {} };

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [snowFilter, setSnowFilter] = useState("all");
  const [location, setLocation] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [airMin, setAirMin] = useState("");
  const [airMax, setAirMax] = useState("");
  const [snowMin, setSnowMin] = useState("");
  const [snowMax, setSnowMax] = useState("");
  const [sort, setSort] = useState("date-desc");

  const teamOptions = useMemo(() => Array.from(new Map(tests.map((t) => [t.teamId, t.teamName])).entries()), [tests]);
  const typeOptions = useMemo(() => Array.from(new Set(tests.map((t) => t.testType).filter(Boolean))).sort(), [tests]);
  const snowOptions = useMemo(() => Array.from(new Set(tests.map((t) => t.weather?.snowType).filter(Boolean) as string[])).sort(), [tests]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const [aMin, aMax] = (() => { const a = num(airMin), b = num(airMax); return a != null && b != null && a > b ? [b, a] : [a, b]; })();
    const [sMin, sMax] = (() => { const a = num(snowMin), b = num(snowMax); return a != null && b != null && a > b ? [b, a] : [a, b]; })();
    const list = tests.filter((t) => {
      if (teamFilter !== "all" && String(t.teamId) !== teamFilter) return false;
      if (typeFilter !== "all" && t.testType !== typeFilter) return false;
      if (snowFilter !== "all" && (t.weather?.snowType ?? "") !== snowFilter) return false;
      if (location && !t.location.toLowerCase().includes(location.toLowerCase())) return false;
      if (dateFrom && (t.date ?? "") < dateFrom) return false;
      if (dateTo && (t.date ?? "") > dateTo) return false;
      const w = t.weather;
      if (aMin != null && (!w || w.airTemperatureC == null || w.airTemperatureC < aMin)) return false;
      if (aMax != null && (!w || w.airTemperatureC == null || w.airTemperatureC > aMax)) return false;
      if (sMin != null && (!w || w.snowTemperatureC == null || w.snowTemperatureC < sMin)) return false;
      if (sMax != null && (!w || w.snowTemperatureC == null || w.snowTemperatureC > sMax)) return false;
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
  }, [tests, teamFilter, typeFilter, snowFilter, location, dateFrom, dateTo, airMin, airMax, snowMin, snowMax, q, sort]);

  const hasFilters = !!(q || teamFilter !== "all" || typeFilter !== "all" || snowFilter !== "all" || location || dateFrom || dateTo || airMin || airMax || snowMin || snowMax);
  const clearFilters = () => { setSearch(""); setTeamFilter("all"); setTypeFilter("all"); setSnowFilter("all"); setLocation(""); setDateFrom(""); setDateTo(""); setAirMin(""); setAirMax(""); setSnowMin(""); setSnowMax(""); };

  const isForbidden = (error as any)?.message?.includes("403") || (error as any)?.status === 403;

  const weatherChips = (t: CrossTeamTest) => (
    t.weather ? (
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
        {t.weather.snowType && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-sky-700 dark:text-sky-300"><Snowflake className="h-3 w-3" />{t.weather.snowType}</span>
        )}
        {t.weather.airTemperatureC != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Thermometer className="h-3 w-3" />{L("Luft", "Air")} {t.weather.airTemperatureC}°</span>
        )}
        {t.weather.snowTemperatureC != null && (
          <span className="inline-flex items-center gap-1 text-muted-foreground"><Thermometer className="h-3 w-3" />{L("Snø", "Snow")} {t.weather.snowTemperatureC}°</span>
        )}
      </div>
    ) : null
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-crossteam-title">
              {L("Alle lag – glidtester", "All teams – glide tests")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {L("Søk og filtrer glidtester på tvers av alle lagene du har tilgang til.", "Search and filter glide tests across every team you can access.")}
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-border bg-background/60 p-0.5">
            <button onClick={() => setView("cards")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors", viewMode === "cards" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} data-testid="allteams-view-cards"><LayoutGrid className="h-3.5 w-3.5" />{L("Kort", "Cards")}</button>
            <button onClick={() => setView("list")} className={cn("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} data-testid="allteams-view-list"><List className="h-3.5 w-3.5" />{L("Liste", "List")}</button>
          </div>
        </div>

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
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground" onClick={clearFilters} data-testid="allteams-clear"><X className="h-3.5 w-3.5" />{L("Nullstill", "Clear")}</Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-9 gap-1 text-xs" data-testid="filter-crossteam-team"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{L("Alle lag", "All teams")}</SelectItem>
                  {teamOptions.map(([id, name]) => (<SelectItem key={id} value={String(id)}>{name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 gap-1 text-xs" data-testid="filter-crossteam-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
                  {typeOptions.map((tp) => (<SelectItem key={tp} value={tp}>{tp}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={snowFilter} onValueChange={setSnowFilter}>
                <SelectTrigger className="h-9 gap-1 text-xs" data-testid="filter-crossteam-snow"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{L("All snø", "All snow")}</SelectItem>
                  {snowOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={L("Sted", "Location")} className="h-9 text-xs" data-testid="filter-crossteam-location" />
              <div className="flex items-center gap-1">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs" title={L("Fra dato", "Date from")} />
                <span className="text-muted-foreground">–</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs" title={L("Til dato", "Date to")} />
              </div>
              <div className="flex items-center gap-1">
                <Input value={airMin} onChange={(e) => setAirMin(e.target.value)} placeholder={L("Luft min", "Air min")} className="h-9 text-xs" inputMode="numeric" />
                <span className="text-muted-foreground">–</span>
                <Input value={airMax} onChange={(e) => setAirMax(e.target.value)} placeholder={L("Luft max", "Air max")} className="h-9 text-xs" inputMode="numeric" />
              </div>
              <div className="flex items-center gap-1">
                <Input value={snowMin} onChange={(e) => setSnowMin(e.target.value)} placeholder={L("Snø min", "Snow min")} className="h-9 text-xs" inputMode="numeric" />
                <span className="text-muted-foreground">–</span>
                <Input value={snowMax} onChange={(e) => setSnowMax(e.target.value)} placeholder={L("Snø max", "Snow max")} className="h-9 text-xs" inputMode="numeric" />
              </div>
            </div>
          </div>
        </Card>

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
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{filtered.length} {L("tester", "tests")}</p>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filtered.map((t) => (
                  <AppLink key={`${t.teamId}-${t.id}`} href={`/tests/${t.id}`} testId={`link-crossteam-test-${t.id}`}>
                    <Card className="fs-card rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{t.testName || t.location}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{t.teamName}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</span>
                            {t.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(t.date).toLocaleDateString()}</span>}
                            {t.createdByName && <span>{t.createdByName}</span>}
                          </div>
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
                        <tr key={`${t.teamId}-${t.id}`} className="cursor-pointer transition-colors hover:bg-muted/20" onClick={() => { window.location.href = `/tests/${t.id}`; }} data-testid={`row-crossteam-${t.id}`}>
                          <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{t.date ? new Date(t.date).toLocaleDateString() : "—"}</td>
                          <td className="px-3 py-2 text-xs">{t.teamName}</td>
                          <td className="px-3 py-2 text-xs font-medium">{t.testName || t.location}</td>
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
          </>
        )}
      </div>
    </AppShell>
  );
}
