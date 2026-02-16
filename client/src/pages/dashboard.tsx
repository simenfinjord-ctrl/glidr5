import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks, Zap, CloudSun, Trophy, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Test = { id: number; date: string; location: string; testType: string; createdByName: string; groupScope: string; weatherId: number | null; seriesId: number; createdAt: string };
type Product = { id: number; brand: string; name: string; category: string; groupScope: string };
type Weather = { id: number; date: string; location: string; airTemperatureC: number; snowTemperatureC: number; time: string | null };

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
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: weather = [] } = useQuery<Weather[]>({ queryKey: ["/api/weather"] });

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTests = tests.filter((t) => t.date === todayStr);

  const recentTests = [...tests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  const recentWeather = [...weather].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

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
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : t.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure")}>
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {recentTests.length > 0 && (
            <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-tests">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50">
                  <ListChecks className="h-3.5 w-3.5 text-blue-600" />
                </div>
                Recent tests
              </div>
              <div className="space-y-2">
                {recentTests.map((t) => (
                  <AppLink key={t.id} href={`/tests/${t.id}`} testId={`link-recent-test-${t.id}`}>
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2.5 transition hover:bg-white hover:shadow-sm cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", t.testType === "Glide" ? "fs-badge-glide" : t.testType === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" : "fs-badge-structure")}>
                          {t.testType}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{t.location}</span>
                        <span className="text-xs text-gray-400">{t.date}</span>
                      </div>
                      <span className="text-xs text-gray-500">{t.createdByName}</span>
                    </div>
                  </AppLink>
                ))}
              </div>
              <div className="mt-3 text-center">
                <AppLink href="/tests" testId="link-all-tests">
                  <span className="text-xs font-medium text-blue-600 hover:text-blue-700">View all tests</span>
                </AppLink>
              </div>
            </Card>
          )}

          <div className="flex flex-col gap-5">
            {products.length > 0 && (
              <Card className="fs-card rounded-2xl p-4" data-testid="card-products-overview">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-50">
                    <Package className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  Products
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{products.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {products.slice(0, 8).map((p) => (
                    <span key={p.id} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200" data-testid={`badge-product-${p.id}`}>
                      {p.brand} {p.name}
                    </span>
                  ))}
                  {products.length > 8 && (
                    <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">+{products.length - 8} more</span>
                  )}
                </div>
                <div className="mt-3 text-center">
                  <AppLink href="/products" testId="link-all-products">
                    <span className="text-xs font-medium text-amber-600 hover:text-amber-700">View all products</span>
                  </AppLink>
                </div>
              </Card>
            )}

            {recentWeather.length > 0 && (
              <Card className="fs-card rounded-2xl p-4" data-testid="card-recent-weather">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-50">
                    <CloudSun className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  Recent weather
                </div>
                <div className="space-y-2">
                  {recentWeather.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs" data-testid={`weather-row-${w.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{w.location}</span>
                        <span className="text-gray-400">{w.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600">Air {w.airTemperatureC}°C</span>
                        <span className="text-cyan-600">Snow {w.snowTemperatureC}°C</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <AppLink href="/weather" testId="link-all-weather">
                    <span className="text-xs font-medium text-violet-600 hover:text-violet-700">View all weather</span>
                  </AppLink>
                </div>
              </Card>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
