import { CalendarPlus, PackagePlus, Snowflake, Plus, Zap, CloudSun, Trophy, Package, Activity, ArrowRight, Wind } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Test = { id: number; date: string; location: string; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type Product = { id: number; brand: string; name: string; category: string; groupScope: string };
type Weather = { id: number; date: string; location: string; airTemperatureC: number; snowTemperatureC: number; time: string | null };
type RecentResult = {
  id: number;
  date: string;
  location: string;
  testType: string;
  createdByName: string;
  createdAt: string;
  entryCount: number;
  hasResults: boolean;
  winnerProduct: { id: number; brand: string; name: string } | null;
  winnerSkiNumber: number | null;
};

function testTypeBadgeClass(type: string) {
  switch (type) {
    case "Glide": return "fs-badge-glide";
    case "Grind": return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:ring-indigo-700";
    case "Classic": return "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:ring-teal-700";
    case "Skating": return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-700";
    default: return "fs-badge-structure";
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: tests = [] } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });
  const { data: recentResults = [] } = useQuery<RecentResult[]>({
    queryKey: ["/api/tests/recent-results"],
    refetchInterval: 10000,
  });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTests = tests.filter((t) => t.date === todayStr);
  const recentWeather = [...weather].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const latestResultId = recentResults.length > 0 ? recentResults[0].id : null;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
              <Activity className="w-4 h-4 text-blue-500" />
              <span>Glidr Testing Hub</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight" data-testid="text-dashboard-title">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm" data-testid="text-dashboard-subtitle">
              {user ? `Welcome back, ${user.name}.` : "Quick actions and recent activity."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AppLink href="/tests/new">
              <Button data-testid="button-new-test" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm hover:shadow-md">
                <Plus className="mr-2 h-4 w-4" />
                New Test
              </Button>
            </AppLink>
            <AppLink href="/weather">
              <Button variant="outline" data-testid="button-add-weather" className="rounded-xl">
                <CalendarPlus className="mr-2 h-4 w-4 text-violet-500" />
                Weather
              </Button>
            </AppLink>
            <AppLink href="/products">
              <Button variant="outline" data-testid="button-add-product" className="rounded-xl">
                <PackagePlus className="mr-2 h-4 w-4 text-amber-500" />
                Product
              </Button>
            </AppLink>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 auto-rows-[minmax(160px,auto)]">

          {todayTests.length > 0 && (
            <div className="col-span-1 row-span-1 bg-card/80 backdrop-blur-md border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col" data-testid="card-today-tests">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="font-semibold text-foreground text-lg">Today</h2>
                </div>
                <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-1 rounded-lg text-xs font-bold ring-1 ring-emerald-200 dark:ring-emerald-700">{todayTests.length} tests</span>
              </div>
              <div className="flex-1 space-y-2.5">
                {todayTests.slice(0, 4).map((t) => (
                  <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-today-test-${t.id}`}>
                    <div className="flex flex-col gap-1 cursor-pointer hover:bg-muted/50 rounded-xl px-2 py-1.5 -mx-2 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-foreground">{t.location}</span>
                        <span className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full", testTypeBadgeClass(t.testType))}>
                          {t.testType}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.createdByName}</span>
                      </div>
                    </div>
                  </AppLink>
                ))}
              </div>
            </div>
          )}

          <div className={cn(
            "row-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all flex flex-col relative overflow-hidden",
            todayTests.length > 0 ? "col-span-1 md:col-span-2" : "col-span-1 md:col-span-3 lg:col-span-3"
          )} data-testid="card-recent-results">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 dark:bg-amber-950/20 rounded-full blur-3xl -mr-32 -mt-32 opacity-60 pointer-events-none"></div>

            <div className="flex items-center justify-between mb-5 relative">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-xl">Recent Results</h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Activity className="w-3 h-3 text-emerald-500" /> Auto-updating
                  </p>
                </div>
              </div>
              <AppLink href="/tests" testId="link-all-tests">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </AppLink>
            </div>

            <div className="flex-1 flex flex-col gap-2.5 relative z-10">
              {recentResults.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">No tests yet</div>
              )}
              {recentResults.map((t) => (
                <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-recent-result-${t.id}`}>
                  <div
                    className={cn(
                      "p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer border",
                      t.id === latestResultId
                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-700/40 shadow-sm"
                        : "bg-muted/30 border-transparent hover:bg-muted/60 hover:border-border"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-1.5 w-2 h-2 rounded-full shrink-0", t.id === latestResultId ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/30")}></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-foreground">{t.location}</span>
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-card rounded-md border border-border">{t.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full", testTypeBadgeClass(t.testType))}>
                            {t.testType}
                          </span>
                          <span className="text-xs text-muted-foreground">by {t.createdByName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:justify-end">
                      {t.hasResults && t.winnerProduct ? (
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                          <Trophy className="mr-1 h-2.5 w-2.5" />
                          {t.winnerProduct.brand} {t.winnerProduct.name}
                        </Badge>
                      ) : t.hasResults ? (
                        <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-700">
                          <Trophy className="mr-1 h-2.5 w-2.5" />
                          Pair {t.winnerSkiNumber}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">No results</span>
                      )}
                    </div>
                  </div>
                </AppLink>
              ))}
            </div>
          </div>

          <div className={cn(
            "row-span-1 grid grid-cols-2 gap-3",
            todayTests.length > 0 ? "col-span-1" : "col-span-1"
          )}>
            <AppLink href="/tests/new" testId="card-quick-new-test" className="block">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col items-center justify-center gap-2.5 text-white group h-full">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sm">New Test</span>
              </div>
            </AppLink>
            <AppLink href="/testskis" testId="card-quick-new-series" className="block">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-2.5 group h-full">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                  <Snowflake className="w-5 h-5 text-blue-500" />
                </div>
                <span className="font-semibold text-foreground text-sm">Series</span>
              </div>
            </AppLink>
            <AppLink href="/products" testId="card-quick-add-product" className="block">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-2.5 group h-full">
                <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
                  <PackagePlus className="w-5 h-5 text-amber-500" />
                </div>
                <span className="font-semibold text-foreground text-sm text-center leading-tight">Products</span>
              </div>
            </AppLink>
            <AppLink href="/weather" testId="card-quick-add-weather" className="block">
              <div className="bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col items-center justify-center gap-2.5 group h-full">
                <div className="w-10 h-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center group-hover:bg-violet-100 dark:group-hover:bg-violet-900/50 transition-colors">
                  <CalendarPlus className="w-5 h-5 text-violet-500" />
                </div>
                <span className="font-semibold text-foreground text-sm">Weather</span>
              </div>
            </AppLink>
          </div>

          {recentWeather.length > 0 && (
            <div className="col-span-1 md:col-span-2 row-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 dark:from-indigo-950 dark:to-slate-950 rounded-2xl p-5 shadow-md hover:shadow-lg transition-all flex flex-col relative overflow-hidden text-white" data-testid="card-recent-weather">
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                    <CloudSun className="w-4.5 h-4.5 text-indigo-300" />
                  </div>
                  <h2 className="font-bold text-white text-lg">Recent Weather</h2>
                </div>
                <AppLink href="/weather" testId="link-all-weather">
                  <span className="text-indigo-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1">
                    View all <ArrowRight className="w-4 h-4" />
                  </span>
                </AppLink>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 relative z-10">
                {recentWeather.map((w) => (
                  <div key={w.id} className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-md hover:bg-white/10 transition-colors cursor-pointer" data-testid={`weather-row-${w.id}`}>
                    <div className="font-medium text-indigo-100 mb-0.5 text-sm">{w.location}</div>
                    <div className="text-xs text-indigo-300 mb-2.5">{w.date}</div>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] text-indigo-400 flex items-center gap-1 mb-0.5"><Wind className="w-3 h-3" /> Air</div>
                        <div className="font-bold text-base">{w.airTemperatureC}°</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-indigo-400 flex items-center gap-1 justify-end mb-0.5"><Snowflake className="w-3 h-3" /> Snow</div>
                        <div className="font-bold text-base text-blue-300">{w.snowTemperatureC}°</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {products.length > 0 && (
            <div className="col-span-1 md:col-span-2 row-span-1 bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col" data-testid="card-products-overview">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-muted flex items-center justify-center">
                    <Package className="w-4.5 h-4.5 text-muted-foreground" />
                  </div>
                  <h2 className="font-bold text-foreground text-lg">Products</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-muted text-muted-foreground px-2 py-1 rounded-lg">{products.length} total</span>
                  <AppLink href="/products" testId="link-all-products">
                    <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </AppLink>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto">
                {products.slice(0, 10).map((p) => (
                  <div key={p.id} className="px-3 py-1.5 rounded-xl border border-border bg-muted/30 text-sm hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer flex items-center gap-1.5" data-testid={`badge-product-${p.id}`}>
                    <span className="font-bold text-foreground/80">{p.brand}</span>
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                ))}
                {products.length > 10 && (
                  <AppLink href="/products" testId="link-more-products">
                    <div className="px-3 py-1.5 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground text-sm flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <Plus className="w-4 h-4 mr-1" /> {products.length - 10} more
                    </div>
                  </AppLink>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}
