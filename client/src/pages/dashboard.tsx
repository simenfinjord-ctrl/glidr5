import { useMemo } from "react";
import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Trophy, TrendingUp, CloudSun, BarChart3, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth";

type Test = { id: number; date: string; location: string; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type TestEntry = { id: number; testId: number; skiNumber: number; productId: number | null; rank0km: number | null; result0kmCmBehind: number | null; methodology: string; resultXkmCmBehind: number | null; rankXkm: number | null };
type Product = { id: number; category: string; brand: string; name: string; createdByName: string; createdAt: string };
type Weather = { id: number; date: string; time: string; location: string; airTemperatureC: number; snowTemperatureC: number; snowType: string; airHumidityPct: number; snowHumidityPct: number; createdByName: string };
type Series = { id: number; name: string; type: string; numberOfSkis: number; createdByName: string };

function StatCard({ label, value, icon: Icon, testId }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; testId: string }) {
  return (
    <Card className="fs-card rounded-2xl p-4" data-testid={testId}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
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
  testId,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}) {
  return (
    <AppLink
      href={href}
      testId={testId}
      className="group block rounded-2xl border bg-card/60 p-4 transition hover:bg-card/90"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
              {user ? `Welcome back, ${user.name}.` : "Quick actions and recent activity."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test">
                <Plus className="mr-2 h-4 w-4" />
                New test
              </Button>
            </AppLink>
            <AppLink href="/weather">
              <Button variant="secondary" data-testid="button-add-weather">
                <CalendarPlus className="mr-2 h-4 w-4" />
                Add weather
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="secondary" data-testid="button-add-product">
                <PackagePlus className="mr-2 h-4 w-4" />
                Add product
              </Button>
            </AppLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total tests" value={tests.length} icon={ListChecks} testId="stat-total-tests" />
          <StatCard label="Products" value={products.length} icon={PackagePlus} testId="stat-total-products" />
          <StatCard label="Ski series" value={series.length} icon={Snowflake} testId="stat-total-series" />
          <StatCard label="Weather logs" value={weather.length} icon={CloudSun} testId="stat-total-weather" />
        </div>

        {todayTests.length > 0 && (
          <Card className="fs-card rounded-2xl border-primary/30 p-4" data-testid="card-today-tests">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="h-4 w-4 text-primary" />
              Today's tests ({todayTests.length})
            </div>
            <div className="mt-2 space-y-2">
              {todayTests.map((t) => (
                <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-today-test-${t.id}`}>
                  <div className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2 transition hover:bg-card/80 cursor-pointer">
                    <div>
                      <span className="text-sm font-medium">{t.location}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{t.testType}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.createdByName}</span>
                  </div>
                </AppLink>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickCard
            title="New test"
            description="Table-first entry with live ranking"
            href="/tests/new"
            icon={ListChecks}
            testId="card-quick-new-test"
          />
          <QuickCard
            title="New test series"
            description="Track test ski series and regrinds"
            href="/testskis"
            icon={Snowflake}
            testId="card-quick-new-series"
          />
          <QuickCard
            title="Add product"
            description="Glide, topping, and structure tools"
            href="/products"
            icon={PackagePlus}
            testId="card-quick-add-product"
          />
          <QuickCard
            title="Add weather"
            description="One entry per date + location"
            href="/weather"
            icon={CalendarPlus}
            testId="card-quick-add-weather"
          />
        </div>

        <Separator />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="fs-card rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="h-4 w-4 text-emerald-400" />
              Top winning products
            </div>
            <div className="mt-3 space-y-2">
              {topProducts.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-top-products">No test results yet.</div>
              ) : (
                topProducts.map(({ product, count }, idx) => (
                  <div
                    key={product?.id ?? idx}
                    className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2"
                    data-testid={`row-top-product-${idx}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400">{idx + 1}</span>
                      <span className="text-sm font-medium">{product ? `${product.brand} ${product.name}` : "Unknown"}</span>
                    </div>
                    <span className="rounded-full bg-card/70 border px-2 py-0.5 text-xs text-muted-foreground">{count} {count === 1 ? "win" : "wins"}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="text-sm font-semibold">Recent tests</div>
            <div className="mt-3 space-y-2">
              {recentTests.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-tests">
                  No tests yet.
                </div>
              ) : (
                recentTests.map((t) => (
                  <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-recent-test-${t.id}`}>
                    <div
                      className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2 transition hover:bg-card/80 cursor-pointer"
                      data-testid={`row-test-${t.id}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.location}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.date} · {t.testType}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{t.createdByName}</span>
                    </div>
                  </AppLink>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="text-sm font-semibold">Test breakdown</div>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2">
                <span className="text-sm">Glide tests</span>
                <span className="text-sm font-bold">{glideCount}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2">
                <span className="text-sm">Structure tests</span>
                <span className="text-sm font-bold">{structureCount}</span>
              </div>
              {todayWeather.length > 0 && (
                <>
                  <div className="pt-1 text-xs text-muted-foreground">Today's conditions</div>
                  {todayWeather.map((w) => (
                    <div key={w.id} className="rounded-xl border bg-background/50 px-3 py-2" data-testid={`row-today-weather-${w.id}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{w.location}</span>
                        <span className="text-xs text-muted-foreground">{w.time}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Air {w.airTemperatureC}°C / {w.airHumidityPct}% · Snow {w.snowTemperatureC}°C / {w.snowHumidityPct}% · {w.snowType}
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
