import { useState, useEffect, useRef } from "react";
import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Zap, CloudSun, Trophy, Package, Watch, MapPin, Settings2, Award, Activity, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { cn, fmtDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { loadWidgetPrefs, saveWidgetPrefs, WIDGET_REGISTRY, type WidgetId } from "@/lib/dashboard-widgets";

type Test = { id: number; date: string; location: string; testName: string | null; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type Product = { id: number; brand: string; name: string; category: string; groupScope: string };
type Weather = { id: number; date: string; location: string; airTemperatureC: number; snowTemperatureC: number; time: string | null };
type RecentResult = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  createdByName: string;
  createdAt: string;
  lastResultAt: string;
  entryCount: number;
  hasResults: boolean;
  winnerProduct: { id: number; brand: string; name: string } | null;
  winnerSkiNumber: number | null;
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  delta,
  barColor,
  barPct,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  delta?: string;
  barColor?: string;
  barPct?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-1 transition-all hover:border-border/80 hover:shadow-md">
      <div className={cn("flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.05em] text-muted-foreground", iconColor)}>
        <Icon className="h-[11px] w-[11px]" />
        {label}
      </div>
      <div className="text-[23px] font-bold text-foreground tracking-[-0.5px] leading-tight mt-0.5">{value}</div>
      {delta && <div className="text-[11px] font-medium text-muted-foreground">{delta}</div>}
      {barPct !== undefined && barColor && (
        <div className="mt-2 h-[2px] rounded-full bg-border overflow-hidden">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, barPct)}%` }} />
        </div>
      )}
    </div>
  );
}

function QuickCard({
  title,
  description,
  href,
  icon: Icon,
  iconColor,
  testId,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  testId: string;
}) {
  return (
    <AppLink
      href={href}
      testId={testId}
      className="group block rounded-2xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-border"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-foreground">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </AppLink>
  );
}

type WatchQueueItem = { id: number; test_name: string | null; series_name: string | null; added_by_name: string; session_code: string | null; status: string };

// ── Widget: Top Products ──────────────────────────────────────────────────────
function TopProductsWidget({ recentResults }: { recentResults: RecentResult[] }) {
  const winCounts: Record<number, { brand: string; name: string; count: number }> = {};
  for (const r of recentResults) {
    if (r.hasResults && r.winnerProduct) {
      const pid = r.winnerProduct.id;
      if (!winCounts[pid]) winCounts[pid] = { brand: r.winnerProduct.brand, name: r.winnerProduct.name, count: 0 };
      winCounts[pid].count++;
    }
  }
  const top = Object.values(winCounts).sort((a, b) => b.count - a.count).slice(0, 5);
  const maxCount = top[0]?.count ?? 1;

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-50">
          <Award className="h-3.5 w-3.5 text-yellow-600" />
        </div>
        Top Products
      </div>
      {top.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No results data yet.</p>
      ) : (
        <div className="space-y-2">
          {top.map((p, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{p.brand} {p.name}</div>
                <div className="mt-0.5 h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-yellow-500" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                </div>
              </div>
              <span className="text-xs font-bold text-yellow-700 shrink-0">{p.count}W</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Widget: Athlete Top Ski ───────────────────────────────────────────────────
function AthleteTopSkiWidget() {
  const { data: athletes = [], isError } = useQuery<any[]>({
    queryKey: ["/api/athletes"],
    retry: false,
  });

  if (isError) {
    return (
      <Card className="fs-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50">
            <Snowflake className="h-3.5 w-3.5 text-sky-600" />
          </div>
          Athlete Top Ski
        </div>
        <p className="text-sm text-muted-foreground italic">Coming soon</p>
      </Card>
    );
  }

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50">
          <Snowflake className="h-3.5 w-3.5 text-sky-600" />
        </div>
        Athlete Top Ski
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{athletes.length}</span>
      </div>
      {athletes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No athletes registered yet.</p>
      ) : (
        <div className="space-y-2">
          {athletes.slice(0, 6).map((a: any) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
              <span className="font-medium text-foreground">{a.name || a.fullName || `Athlete #${a.id}`}</span>
              <span className="text-muted-foreground italic">best ski data coming soon</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Widget: Recent Activity (admin only) ──────────────────────────────────────
function RecentActivityWidget() {
  const { data: activityLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/activity"],
    queryFn: async () => {
      const res = await fetch("/api/activity?limit=10", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    retry: false,
  });

  function formatTime(ts: string) {
    const d = new Date(ts);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <Card className="fs-card rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
          <Activity className="h-3.5 w-3.5 text-violet-600" />
        </div>
        Team Activity
      </div>
      {activityLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No recent activity.</p>
      ) : (
        <div className="space-y-1.5">
          {activityLogs.slice(0, 10).map((log: any, i: number) => (
            <div key={log.id ?? i} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-foreground shrink-0">{log.userName || log.user_name || "Unknown"}</span>
                <span className="text-muted-foreground truncate">{log.action} {log.entityType || log.entity_type || ""}</span>
              </div>
              <span className="text-muted-foreground shrink-0 ml-2">{formatTime(log.createdAt || log.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Dashboard() {
  const { user, isBlindTester, can, canManage } = useAuth();
  const { t } = useI18n();
  const hasGarminWatch = can("garmin_watch");
  const [resultLimit, setResultLimit] = useState("10");
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: watchQueue = [] } = useQuery<WatchQueueItem[]>({
    queryKey: ["/api/watch/queue"],
    enabled: hasGarminWatch,
  });
  const activeQueue = watchQueue.filter((q) => q.status === "active");
  const { data: recentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/tests/recent-results", resultLimit],
    queryFn: async () => {
      const res = await fetch(`/api/tests/recent-results?limit=${resultLimit}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
  });
  const { data: allRecentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/tests/recent-results", "100"],
    queryFn: async () => {
      const res = await fetch("/api/tests/recent-results?limit=100", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTests = tests.filter((test) => test.date === todayStr);

  const recentWeather = [...weather].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const lastSeenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (recentResults.length === 0) {
      lastSeenRef.current = null;
      setHighlightId(null);
      return;
    }
    const top = recentResults[0];
    const key = `${top.id}:${top.lastResultAt}`;
    if (lastSeenRef.current !== null && lastSeenRef.current !== key) {
      setHighlightId(top.id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHighlightId(null), 20000);
    }
    lastSeenRef.current = key;
  }, [recentResults]);

  // Widget preferences
  const [widgetPrefs, setWidgetPrefs] = useState(() => loadWidgetPrefs());
  const [editingWidgets, setEditingWidgets] = useState(false);

  function toggleWidget(id: WidgetId) {
    const next = widgetPrefs.map((p) => p.id === id ? { ...p, enabled: !p.enabled } : p);
    setWidgetPrefs(next);
    saveWidgetPrefs(next);
  }

  function resetWidgets() {
    const defaults = WIDGET_REGISTRY.map(w => ({ id: w.id, enabled: w.defaultEnabled }));
    setWidgetPrefs(defaults);
    saveWidgetPrefs(defaults);
  }

  // Visible widgets filtered by feature flags and admin status
  const availableWidgets = WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag === "garmin_watch" && !hasGarminWatch) return false;
    if (w.adminOnly && !canManage) return false;
    return true;
  });

  const enabledWidgetIds = new Set(widgetPrefs.filter((p) => p.enabled).map((p) => p.id));

  function isWidgetEnabled(id: WidgetId) {
    const pref = widgetPrefs.find((p) => p.id === id);
    return pref ? pref.enabled : WIDGET_REGISTRY.find((w) => w.id === id)?.defaultEnabled ?? false;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("dashboard.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
              {user ? t("dashboard.welcome", { name: user.name }) : t("dashboard.subtitle")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingWidgets((v) => !v)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="button-customise-dashboard"
            >
              <Settings2 className="h-4 w-4" />
              Customise
            </Button>
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.newTest")}
              </Button>
            </AppLink>
            <AppLink href="/weather">
              <Button variant="outline" data-testid="button-add-weather">
                <CalendarPlus className="mr-2 h-4 w-4 text-violet-600" />
                {t("nav.weather")}
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="outline" data-testid="button-add-product">
                <PackagePlus className="mr-2 h-4 w-4 text-amber-600" />
                {t("nav.products")}
              </Button>
            </AppLink>
          </div>
        </div>

        {/* Widget customiser panel */}
        {editingWidgets && (
          <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Customise Dashboard</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetWidgets}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset to defaults
                </button>
                <button
                  type="button"
                  onClick={() => setEditingWidgets(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {availableWidgets.map((w) => {
                const pref = widgetPrefs.find((p) => p.id === w.id);
                const enabled = pref ? pref.enabled : w.defaultEnabled;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWidget(w.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                      enabled
                        ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
                        : "border-border bg-muted/20 hover:bg-muted/40"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                      enabled ? "border-green-600 bg-green-600" : "border-muted-foreground/40"
                    )}>
                      {enabled && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-foreground">{w.label}</div>
                      <div className="text-[11px] text-muted-foreground">{w.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Stats row — 4 summary cards */}
        {isWidgetEnabled("stats") && !isBlindTester && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t("dashboard.statsTests")}
              value={tests.length}
              icon={ListChecks}
              iconColor="text-emerald-600"
              delta={todayTests.length > 0 ? `${todayTests.length} today` : undefined}
              barColor="bg-green-500"
              barPct={Math.min(100, (tests.length / Math.max(tests.length, 50)) * 100)}
            />
            <StatCard
              label={t("dashboard.statsProducts")}
              value={products.length}
              icon={Package}
              iconColor="text-blue-600"
              delta={products.length > 0 ? `${[...new Set(products.map((p) => p.brand))].length} brands` : undefined}
              barColor="bg-blue-500"
              barPct={Math.min(100, (products.length / Math.max(products.length, 40)) * 100)}
            />
            <StatCard
              label={t("dashboard.statsWatchQueue")}
              value={activeQueue.length}
              icon={Watch}
              iconColor="text-sky-600"
              delta={activeQueue.length > 0 ? "Active" : "No items"}
              barColor="bg-sky-500"
              barPct={activeQueue.length > 0 ? 100 : 0}
            />
            <StatCard
              label={t("dashboard.statsVenues")}
              value={[...new Set(tests.map((t) => t.location))].length}
              icon={MapPin}
              iconColor="text-amber-600"
              delta={weather.length > 0 ? `${weather.length} weather logs` : undefined}
              barColor="bg-amber-500"
              barPct={Math.min(100, ([...new Set(tests.map((t) => t.location))].length / Math.max([...new Set(tests.map((t) => t.location))].length, 10)) * 100)}
            />
          </div>
        )}

        {isWidgetEnabled("today-tests") && todayTests.length > 0 && (
          <Card className="fs-card rounded-2xl border-emerald-200 p-4" data-testid="card-today-tests">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              {t("dashboard.todayTests")}
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">{todayTests.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {todayTests.map((test) => (
                <AppLink key={test.id} href={`/tests/${test.id}`} testId={`link-today-test-${test.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 transition hover:bg-card hover:shadow-sm cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", test.testType === "Glide" ? "fs-badge-glide" : test.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure")}>
                        {test.testType}
                      </span>
                      <span className="text-sm font-medium text-foreground">{test.testName || test.location}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{test.createdByName}</span>
                  </div>
                </AppLink>
              ))}
            </div>
          </Card>
        )}

        {isWidgetEnabled("watch-queue") && hasGarminWatch && activeQueue.length > 0 && (
          <Card className="fs-card rounded-2xl border-sky-200 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50">
                  <Watch className="h-3.5 w-3.5 text-sky-600" />
                </div>
                {t("dashboard.watchQueue")}
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200">{activeQueue.length}</span>
              </div>
              <AppLink href="/watch-queue">
                <span className="text-xs font-medium text-sky-600 hover:text-sky-700">{t("dashboard.watchQueueManage")}</span>
              </AppLink>
            </div>
            <div className="space-y-1.5">
              {activeQueue.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground truncate">{item.test_name || item.series_name || `Test #${item.id}`}</span>
                  <span className="ml-2 text-muted-foreground shrink-0">{item.added_by_name}</span>
                </div>
              ))}
              {activeQueue.length > 4 && (
                <p className="text-center text-xs text-muted-foreground pt-1">+{activeQueue.length - 4} {t("common.more")}</p>
              )}
            </div>
          </Card>
        )}

        {isWidgetEnabled("quick-actions") && (
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isBlindTester ? "" : "lg:grid-cols-4"}`}>
            {!isBlindTester && <QuickCard title={t("dashboard.newTest")} description={t("dashboard.newTestDesc")} href="/tests/new" icon={ListChecks} iconColor="text-emerald-600" testId="card-quick-new-test" />}
            {!isBlindTester && <QuickCard title={t("dashboard.newTestSeries")} description={t("dashboard.newTestSeriesDesc")} href="/testskis" icon={Snowflake} iconColor="text-sky-600" testId="card-quick-new-series" />}
            {!isBlindTester && <QuickCard title={t("dashboard.addProduct")} description={t("dashboard.addProductDesc")} href="/products" icon={PackagePlus} iconColor="text-amber-600" testId="card-quick-add-product" />}
            <QuickCard title={t("dashboard.addWeather")} description={t("dashboard.addWeatherDesc")} href="/weather" icon={CalendarPlus} iconColor="text-violet-600" testId="card-quick-add-weather" />
          </div>
        )}

        {isWidgetEnabled("recent-results") && (
          <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-results">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-yellow-50">
                <Trophy className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              {t("dashboard.recentResults")}
              <span className="text-[10px] text-muted-foreground font-normal ml-1">{t("dashboard.recentResultsAuto")}</span>
              <div className="ml-auto">
                <Select value={resultLimit} onValueChange={setResultLimit}>
                  <SelectTrigger className="h-7 w-[72px] text-xs" data-testid="select-result-limit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {recentResults.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground italic">{t("dashboard.noResults")}</div>
            ) : (
              <div className="space-y-2">
                {recentResults.map((item) => (
                  <AppLink key={item.id} href={`/tests/${item.id}`} testId={`link-recent-result-${item.id}`}>
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5 transition hover:shadow-sm cursor-pointer",
                        item.id === highlightId
                          ? "animate-highlight-pulse"
                          : "border-border bg-muted/30 hover:bg-card"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0",
                          item.testType === "Glide" ? "fs-badge-glide"
                            : item.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                            : item.testType === "Classic" ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
                            : item.testType === "Skating" ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"
                            : "fs-badge-structure"
                        )}>
                          {item.testType}
                        </span>
                        <span className="text-sm font-medium text-foreground truncate">{item.testName || item.location}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtDate(item.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isBlindTester ? (
                          item.hasResults ? (
                            <span className="text-[10px] text-muted-foreground italic">{t("dashboard.resultsAvailable")}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">{t("dashboard.noResultsYet")}</span>
                          )
                        ) : item.hasResults && item.winnerProduct ? (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                            <Trophy className="mr-1 h-2.5 w-2.5" />
                            {item.winnerProduct.brand} {item.winnerProduct.name}
                          </Badge>
                        ) : item.hasResults ? (
                          <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                            <Trophy className="mr-1 h-2.5 w-2.5" />
                            {t("dashboard.pair")} {item.winnerSkiNumber}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">{t("dashboard.noResultsYet")}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{item.createdByName}</span>
                      </div>
                    </div>
                  </AppLink>
                ))}
              </div>
            )}
            <div className="mt-3 text-center">
              <AppLink href="/tests" testId="link-all-tests">
                <span className="text-xs font-medium text-green-600 hover:text-green-700">{t("dashboard.viewAllTests")}</span>
              </AppLink>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {isWidgetEnabled("recent-weather") && recentWeather.length > 0 && (
            <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-weather">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
                  <CloudSun className="h-3.5 w-3.5 text-violet-600" />
                </div>
                {t("dashboard.recentWeather")}
              </div>
              <div className="space-y-2">
                {recentWeather.map((w) => (
                  <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs" data-testid={`weather-row-${w.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{w.location}</span>
                      <span className="text-muted-foreground">{fmtDate(w.date)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-600">{t("dashboard.air")} {w.airTemperatureC}°C</span>
                      <span className="text-cyan-600">{t("dashboard.snow")} {w.snowTemperatureC}°C</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-center">
                <AppLink href="/weather" testId="link-all-weather">
                  <span className="text-xs font-medium text-violet-600 hover:text-violet-700">{t("dashboard.viewAllWeather")}</span>
                </AppLink>
              </div>
            </Card>
          )}

          {isWidgetEnabled("products-overview") && products.length > 0 && !isBlindTester && (
            <Card className="fs-card rounded-2xl p-4" data-testid="card-products-overview">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
                  <Package className="h-3.5 w-3.5 text-amber-600" />
                </div>
                {t("nav.products")}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{products.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {products.slice(0, 8).map((p) => (
                  <span key={p.id} className="rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground/80 ring-1 ring-border" data-testid={`badge-product-${p.id}`}>
                    {p.brand} {p.name}
                  </span>
                ))}
                {products.length > 8 && (
                  <span className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">+{products.length - 8} {t("common.more")}</span>
                )}
              </div>
              <div className="mt-3 text-center">
                <AppLink href="/products" testId="link-all-products">
                  <span className="text-xs font-medium text-amber-600 hover:text-amber-700">{t("dashboard.viewAllProducts")}</span>
                </AppLink>
              </div>
            </Card>
          )}
        </div>

        {/* Optional widgets row */}
        {(isWidgetEnabled("top-products") || isWidgetEnabled("athlete-top-ski") || isWidgetEnabled("recent-activity")) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {isWidgetEnabled("top-products") && !isBlindTester && (
              <TopProductsWidget recentResults={allRecentResults} />
            )}
            {isWidgetEnabled("athlete-top-ski") && (
              <AthleteTopSkiWidget />
            )}
            {isWidgetEnabled("recent-activity") && canManage && (
              <RecentActivityWidget />
            )}
          </div>
        )}

      </div>
    </AppShell>
  );
}
