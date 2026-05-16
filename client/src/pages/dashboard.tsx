import { useState, useEffect, useRef } from "react";
import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Zap, CloudSun, Trophy, Package, Watch, Layers, ClipboardList } from "lucide-react";
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

type Test = { id: number; date: string; location: string; testName: string | null; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type Product = { id: number; brand: string; name: string; category: string; groupScope: string; stockQuantity?: number };
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
  seriesName?: string | null;
  winnerProduct: { id: number; brand: string; name: string } | null;
  winnerSkiNumber: number | null;
};

type Series = {
  id: number;
  name: string;
  type: string;
  archivedAt: string | null;
};

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

export default function Dashboard() {
  const { user, isBlindTester, can } = useAuth();
  const { t } = useI18n();
  const hasGarminWatch = can("garmin_watch");
  const [resultLimit, setResultLimit] = useState("10");
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });
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

  // ── Date helpers ────────────────────────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Monday of current week
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - daysFromMonday);
  thisMonday.setHours(0, 0, 0, 0);
  const thisMondayStr = thisMonday.toISOString().slice(0, 10);

  // Monday of previous week
  const prevMonday = new Date(thisMonday);
  prevMonday.setDate(thisMonday.getDate() - 7);
  const prevMondayStr = prevMonday.toISOString().slice(0, 10);

  const testsThisWeek = tests.filter((test) => test.date >= thisMondayStr).length;
  const testsLastWeek = tests.filter((test) => test.date >= prevMondayStr && test.date < thisMondayStr).length;
  const weekDiff = testsThisWeek - testsLastWeek;
  const weekDiffLabel =
    weekDiff >= 0
      ? t("dashboard.vsLastWeek").replace("{n}", String(weekDiff))
      : t("dashboard.vsLastWeekNeg").replace("{n}", String(weekDiff));

  // Active series (non-archived)
  const activeSeries = series.filter((s) => !s.archivedAt);
  const seriesTypeCounts: Record<string, number> = {};
  for (const s of activeSeries) {
    seriesTypeCounts[s.type] = (seriesTypeCounts[s.type] ?? 0) + 1;
  }
  const seriesBreakdown = Object.entries(seriesTypeCounts)
    .map(([type, count]) => `${count} ${type}`)
    .join(" · ");

  // Products stats
  const brandSet = new Set(products.map((p) => p.brand));
  const brandCount = brandSet.size;
  const lowStockProducts = products.filter((p) => (p.stockQuantity ?? 99) < 3);
  const lowStockCount = lowStockProducts.length;

  // Today's tests
  const todayTests = tests.filter((test) => test.date === todayStr);

  // Recent weather (for bottom section)
  const recentWeather = [...weather].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  // Last test location (most recent test)
  const lastTest = [...tests].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
  const lastLocation = lastTest?.location ?? null;

  // Formatted date for subtitle
  const formattedDate = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

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

  const typeBadgeClass = (testType: string) =>
    testType === "Glide"
      ? "fs-badge-glide"
      : testType === "Grind"
      ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
      : testType === "Classic"
      ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
      : testType === "Skating"
      ? "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200"
      : "fs-badge-structure";

  return (
    <AppShell>
      <div className="flex flex-col gap-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {user ? t("dashboard.welcome").replace("{name}", user.name) : t("dashboard.title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
              {t("dashboard.hubSubtitle")}
              {lastLocation ? ` · ${formattedDate}, ${lastLocation}` : ` · ${formattedDate}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AppLink href="/weather">
              <Button variant="outline" data-testid="button-add-weather">
                <CalendarPlus className="mr-2 h-4 w-4 text-violet-600" />
                {t("dashboard.addWeather")}
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="outline" data-testid="button-add-product">
                <PackagePlus className="mr-2 h-4 w-4 text-amber-600" />
                {t("dashboard.addProduct")}
              </Button>
            </AppLink>
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-green-600 hover:bg-green-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("dashboard.newTest")}
              </Button>
            </AppLink>
          </div>
        </div>

        {/* ── Stat cards (non-blind-testers only) ────────────────────────── */}
        {!isBlindTester && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("dashboard.testsThisWeek")}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{testsThisWeek}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{weekDiffLabel}</div>
            </Card>

            <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("dashboard.activeSeries")}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{activeSeries.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{seriesBreakdown || "—"}</div>
            </Card>

            <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("dashboard.products")}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{products.length}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {t("dashboard.brands").replace("{n}", String(brandCount))}
                {lowStockCount > 0 ? ` · ${t("dashboard.lowStockCount").replace("{n}", String(lowStockCount))}` : ""}
              </div>
            </Card>

            <Card className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("dashboard.lowStock")}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{lowStockCount}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("dashboard.basedOnStock")}</div>
            </Card>
          </div>
        )}

        {/* ── Today's tests ───────────────────────────────────────────────── */}
        {todayTests.length > 0 && (
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
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", typeBadgeClass(test.testType))}>
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

        {/* ── Watch Queue (Garmin) ────────────────────────────────────────── */}
        {hasGarminWatch && activeQueue.length > 0 && (
          <Card className="fs-card rounded-2xl border-sky-200 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50">
                  <Watch className="h-3.5 w-3.5 text-sky-600" />
                </div>
                {t("dashboard.watchQueue")}
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-sky-200">
                  {t("dashboard.pendingBadge").replace("{n}", String(activeQueue.length))}
                </span>
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

        {/* ── Recent results table ────────────────────────────────────────── */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-3">{t("dashboard.colType")}</th>
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-3">{t("dashboard.colLocation")}</th>
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-3">{t("dashboard.colDate")}</th>
                    <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pr-3">{t("dashboard.colSeries")}</th>
                    {!isBlindTester && (
                      <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("dashboard.colTopProduct")}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentResults.map((item) => (
                    <AppLink key={item.id} href={`/tests/${item.id}`} testId={`link-recent-result-${item.id}`}>
                      <tr
                        className={cn(
                          "cursor-pointer transition",
                          item.id === highlightId
                            ? "animate-highlight-pulse"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <td className="py-2.5 pr-3">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap", typeBadgeClass(item.testType))}>
                            {item.testType}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-sm font-medium text-foreground truncate max-w-[140px]">
                          {item.testName || item.location}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                          {fmtDate(item.date)}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground truncate max-w-[120px]">
                          {item.seriesName ?? "—"}
                        </td>
                        {!isBlindTester && (
                          <td className="py-2.5">
                            {item.hasResults && item.winnerProduct ? (
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
                          </td>
                        )}
                      </tr>
                    </AppLink>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-center">
            <AppLink href="/tests" testId="link-all-tests">
              <span className="text-xs font-medium text-green-600 hover:text-green-700">{t("dashboard.viewAllTests")}</span>
            </AppLink>
          </div>
        </Card>

        {/* ── Quick actions 2×3 grid ──────────────────────────────────────── */}
        {!isBlindTester && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <QuickCard title={t("dashboard.newTest")} description={t("dashboard.newTestDesc")} href="/tests/new" icon={ListChecks} iconColor="text-emerald-600" testId="card-quick-new-test" />
            <QuickCard title={t("dashboard.newTestSeries")} description={t("dashboard.newTestSeriesDesc")} href="/testskis" icon={Snowflake} iconColor="text-sky-600" testId="card-quick-new-series" />
            <QuickCard title={t("dashboard.addProduct")} description={t("dashboard.addProductDesc")} href="/products" icon={PackagePlus} iconColor="text-amber-600" testId="card-quick-add-product" />
            <QuickCard title={t("dashboard.addWeather")} description={t("dashboard.addWeatherDesc")} href="/weather" icon={CalendarPlus} iconColor="text-violet-600" testId="card-quick-add-weather" />
            <QuickCard title={t("dashboard.logGrind")} description={t("dashboard.logGrindDesc")} href="/grinding" icon={Layers} iconColor="text-rose-600" testId="card-quick-log-grind" />
            <QuickCard title={t("dashboard.liveRunsheet")} description={t("dashboard.liveRunsheetDesc")} href="/live-runsheets" icon={ClipboardList} iconColor="text-teal-600" testId="card-quick-live-runsheet" />
          </div>
        )}

        {/* ── Bottom row: weather + products ─────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {recentWeather.length > 0 && (
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

          {products.length > 0 && !isBlindTester && (
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

      </div>
    </AppShell>
  );
}
