import { useMemo } from "react";
import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Trophy, TrendingUp, CloudSun, BarChart3, Zap, Award } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Test = { id: number; date: string; location: string; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type TestEntry = { id: number; testId: number; skiNumber: number; productId: number | null; rank0km: number | null; result0kmCmBehind: number | null; methodology: string; resultXkmCmBehind: number | null; rankXkm: number | null };
type Product = { id: number; category: string; brand: string; name: string; createdByName: string; createdAt: string };
type Weather = { id: number; date: string; time: string; location: string; airTemperatureC: number; snowTemperatureC: number; snowType: string | null; airHumidityPct: number; snowHumidityPct: number; artificialSnow: string | null; naturalSnow: string | null; snowHumidityType: string | null; testQuality: number | null; createdByName: string };
type Series = { id: number; name: string; type: string; numberOfSkis: number; createdByName: string };

function StatCard({ label, value, icon: Icon, accent, testId }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent: string; testId: string }) {
  return (
    <Card className={cn("fs-card rounded-2xl p-4", accent)} data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50">
          <Icon className="h-5 w-5 text-gray-500" />
        </div>
      </div>
    </Card>
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
      className="group block rounded-2xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-gray-900">{title}</div>
          <div className="mt-1 text-xs text-gray-500">{description}</div>
        </div>
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-50", iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </AppLink>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: series = [] } = useQuery<Series[]>({ queryKey: ["/api/series"] });

  const allTestIds = tests.map((t) => t.id);
  const { data: allEntries = [] } = useQuery<TestEntry[]>({
    queryKey: ["/api/tests/entries/all-dashboard", allTestIds],
    queryFn: async () => {
      if (allTestIds.length === 0) return [];
      const results = await Promise.all(
        allTestIds.map((id) =>
          fetch(`/api/tests/${id}/entries`, { credentials: "include" }).then((r) => r.ok ? r.json() : [])
        )
      );
      return results.flat();
    },
    enabled: allTestIds.length > 0,
  });

  const productsById = new Map(products.map((p) => [p.id, p] as const));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayWeather = weather.filter((w) => w.date === todayStr);
  const todayTests = tests.filter((t) => t.date === todayStr);

  const topProducts = useMemo(() => {
    const wins = new Map<number, number>();
    for (const t of tests) {
      const entries = allEntries.filter((e) => e.testId === t.id);
      const winner = entries.find((e) => e.rank0km === 1);
      if (winner?.productId) {
        wins.set(winner.productId, (wins.get(winner.productId) || 0) + 1);
      }
    }
    return Array.from(wins.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, count]) => ({ product: productsById.get(pid), count }));
  }, [tests, allEntries, productsById]);

  const recentTests = [...tests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const glideCount = tests.filter((t) => t.testType === "Glide").length;
  const structureCount = tests.filter((t) => t.testType === "Structure").length;

  const medalColors = ["text-emerald-700", "text-sky-700", "text-amber-700", "text-violet-700", "text-rose-700"];
  const medalBgs = ["bg-emerald-50 ring-emerald-200", "bg-sky-50 ring-sky-200", "bg-amber-50 ring-amber-200", "bg-violet-50 ring-violet-200", "bg-rose-50 ring-rose-200"];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500" data-testid="text-dashboard-subtitle">
              {user ? `Welcome back, ${user.name}.` : "Quick actions and recent activity."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <Plus className="mr-2 h-4 w-4" />
                New test
              </Button>
            </AppLink>
            <AppLink href="/weather">
              <Button variant="outline" data-testid="button-add-weather">
                <CalendarPlus className="mr-2 h-4 w-4 text-violet-600" />
                Weather
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="outline" data-testid="button-add-product">
                <PackagePlus className="mr-2 h-4 w-4 text-amber-600" />
                Product
              </Button>
            </AppLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total tests" value={tests.length} icon={ListChecks} accent="fs-stat-blue" testId="stat-total-tests" />
          <StatCard label="Products" value={products.length} icon={PackagePlus} accent="fs-stat-amber" testId="stat-total-products" />
          <StatCard label="Ski series" value={series.length} icon={Snowflake} accent="fs-stat-emerald" testId="stat-total-series" />
          <StatCard label="Weather logs" value={weather.length} icon={CloudSun} accent="fs-stat-violet" testId="stat-total-weather" />
        </div>

        {todayTests.length > 0 && (
          <Card className="fs-card rounded-2xl border-emerald-200 p-4" data-testid="card-today-tests">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Today's tests
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">{todayTests.length}</span>
            </div>
            <div className="mt-3 space-y-2">
              {todayTests.map((t) => (
                <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-today-test-${t.id}`}>
                  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 transition hover:bg-white hover:shadow-sm cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                        {t.testType}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{t.location}</span>
                    </div>
                    <span className="text-xs text-gray-500">{t.createdByName}</span>
                  </div>
                </AppLink>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickCard title="New test" description="Table-first entry with live ranking" href="/tests/new" icon={ListChecks} iconColor="text-emerald-600" testId="card-quick-new-test" />
          <QuickCard title="New test series" description="Track test ski series and regrinds" href="/testskis" icon={Snowflake} iconColor="text-sky-600" testId="card-quick-new-series" />
          <QuickCard title="Add product" description="Glide, topping, and structure tools" href="/products" icon={PackagePlus} iconColor="text-amber-600" testId="card-quick-add-product" />
          <QuickCard title="Add weather" description="One entry per date + location" href="/weather" icon={CalendarPlus} iconColor="text-violet-600" testId="card-quick-add-weather" />
        </div>

        <div className="h-px bg-gray-100" />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="fs-card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50">
                <Trophy className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Top winning products
            </div>
            <div className="mt-3 space-y-2">
              {topProducts.length === 0 ? (
                <div className="text-sm text-gray-400" data-testid="empty-top-products">No test results yet.</div>
              ) : (
                topProducts.map(({ product, count }, idx) => (
                  <div
                    key={product?.id ?? idx}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5"
                    data-testid={`row-top-product-${idx}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-1", medalBgs[idx] ?? medalBgs[4], medalColors[idx] ?? medalColors[4])}>
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{product ? `${product.brand} ${product.name}` : "Unknown"}</span>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{count} {count === 1 ? "win" : "wins"}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                <Award className="h-3.5 w-3.5 text-blue-600" />
              </div>
              Recent tests
            </div>
            <div className="mt-3 space-y-2">
              {recentTests.length === 0 ? (
                <div className="text-sm text-gray-400" data-testid="empty-tests">
                  No tests yet.
                </div>
              ) : (
                recentTests.map((t) => (
                  <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-recent-test-${t.id}`}>
                    <div
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 transition hover:bg-white hover:shadow-sm cursor-pointer"
                      data-testid={`row-test-${t.id}`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : "fs-badge-structure")}>
                            {t.testType}
                          </span>
                          <span className="truncate text-sm font-medium text-gray-900">{t.location}</span>
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{t.date}</div>
                      </div>
                      <span className="text-xs text-gray-500">{t.createdByName}</span>
                    </div>
                  </AppLink>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
                <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
              </div>
              Test breakdown
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5" data-testid="row-breakdown-glide">
                <div className="flex items-center gap-2">
                  <span className="fs-badge-glide rounded-full px-2 py-0.5 text-[10px] font-semibold">Glide</span>
                  <span className="text-sm text-gray-600">tests</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{glideCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5" data-testid="row-breakdown-structure">
                <div className="flex items-center gap-2">
                  <span className="fs-badge-structure rounded-full px-2 py-0.5 text-[10px] font-semibold">Structure</span>
                  <span className="text-sm text-gray-600">tests</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{structureCount}</span>
              </div>
              {todayWeather.length > 0 && (
                <>
                  <div className="pt-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Today's conditions</div>
                  {todayWeather.map((w) => (
                    <div key={w.id} className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5" data-testid={`row-today-weather-${w.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-gray-900">{w.location}</span>
                        <span className="text-xs text-gray-400">{w.time}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">Air {w.airTemperatureC}°C</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Snow {w.snowTemperatureC}°C</span>
                        {w.artificialSnow && <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-medium text-pink-700">Art: {w.artificialSnow}</span>}
                        {w.naturalSnow && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">Nat: {w.naturalSnow}</span>}
                        {w.snowHumidityType && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">{w.snowHumidityType}</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
