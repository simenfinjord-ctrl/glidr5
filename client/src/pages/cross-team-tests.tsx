import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Layers, Snowflake, MapPin, Calendar, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type CrossTeamTest = {
  id: number;
  date: string | null;
  location: string;
  testName: string | null;
  testType: string;
  testSkiSource: string;
  teamId: number;
  teamName: string;
  weather: {
    snowType?: string | null;
    snowTemperatureC?: number | null;
    airTemperatureC?: number | null;
    location?: string | null;
  } | null;
};

export default function CrossTeamTests() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const { data: tests = [], isLoading } = useQuery<CrossTeamTest[]>({
    queryKey: ["/api/tests/cross-team"],
  });

  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [snowFilter, setSnowFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const teamOptions = useMemo(
    () => Array.from(new Map(tests.map((t) => [t.teamId, t.teamName])).entries()),
    [tests],
  );
  const snowOptions = useMemo(
    () => Array.from(new Set(tests.map((t) => t.weather?.snowType).filter(Boolean) as string[])).sort(),
    [tests],
  );
  const typeOptions = useMemo(
    () => Array.from(new Set(tests.map((t) => t.testType).filter(Boolean))).sort(),
    [tests],
  );

  const q = search.trim().toLowerCase();
  const filtered = tests.filter((t) => {
    if (teamFilter !== "all" && String(t.teamId) !== teamFilter) return false;
    if (snowFilter !== "all" && (t.weather?.snowType ?? "") !== snowFilter) return false;
    if (typeFilter !== "all" && t.testType !== typeFilter) return false;
    if (!q) return true;
    return (
      t.location.toLowerCase().includes(q) ||
      (t.testName ?? "").toLowerCase().includes(q) ||
      t.teamName.toLowerCase().includes(q) ||
      (t.weather?.snowType ?? "").toLowerCase().includes(q)
    );
  });

  const detailHref = (t: CrossTeamTest) => `/tests/${t.id}`;

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-crossteam-title">
            {L("Alle lag – tester", "All teams – tests")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(
              "Søk og filtrer tester på tvers av alle lagene du har tilgang til.",
              "Search and filter tests across every team you can access.",
            )}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={L("Søk sted, navn, lag, snø…", "Search location, name, team, snow…")}
              className="pl-9"
              data-testid="input-crossteam-search"
            />
          </div>
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1 text-xs" data-testid="filter-crossteam-team"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("Alle lag", "All teams")}</SelectItem>
              {teamOptions.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={snowFilter} onValueChange={setSnowFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1 text-xs" data-testid="filter-crossteam-snow"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("All snø", "All snow")}</SelectItem>
              {snowOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[120px] gap-1 text-xs" data-testid="filter-crossteam-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("Alle typer", "All types")}</SelectItem>
              {typeOptions.map((tp) => (
                <SelectItem key={tp} value={tp}>{tp}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>
        ) : filtered.length === 0 ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-crossteam">
            {tests.length === 0
              ? L("Ingen tester å vise på tvers av lagene dine.", "No tests to show across your teams.")
              : L("Ingen tester samsvarer med filtrene.", "No tests match the filters.")}
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{filtered.length} {L("tester", "tests")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filtered.map((t) => (
                <AppLink key={`${t.teamId}-${t.id}`} href={detailHref(t)} testId={`link-crossteam-test-${t.id}`}>
                  <Card className="fs-card rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {t.testName || t.location}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{t.teamName}</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.location}</span>
                          {t.date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(t.date).toLocaleDateString()}</span>}
                        </div>
                        {t.weather && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {t.weather.snowType && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 text-sky-700 dark:text-sky-300">
                                <Snowflake className="h-3 w-3" />{t.weather.snowType}
                              </span>
                            )}
                            {(t.weather.snowTemperatureC != null || t.weather.airTemperatureC != null) && (
                              <span className="text-muted-foreground">
                                {t.weather.airTemperatureC != null && `${L("Luft", "Air")} ${t.weather.airTemperatureC}°`}
                                {t.weather.airTemperatureC != null && t.weather.snowTemperatureC != null && " · "}
                                {t.weather.snowTemperatureC != null && `${L("Snø", "Snow")} ${t.weather.snowTemperatureC}°`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shrink-0">
                        <Layers className="h-3 w-3" />{t.testType}
                      </span>
                    </div>
                  </Card>
                </AppLink>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
