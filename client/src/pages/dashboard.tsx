import { CalendarPlus, PackagePlus, Snowflake, Plus, ListChecks } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/mock-auth";
import { listTests, listWeather, listProducts, listSeries } from "@/lib/mock-db";

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
  const user = getCurrentUser();
  const tests = user ? listTests(user).slice(0, 5) : [];
  const weather = user ? listWeather(user).slice(0, 4) : [];
  const products = user ? listProducts(user).slice(0, 4) : [];
  const series = user ? listSeries(user).slice(0, 4) : [];

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-dashboard-subtitle">
              Quick actions and recent activity for your group.
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
            <div className="text-sm font-semibold">Recent tests</div>
            <div className="mt-3 space-y-2">
              {tests.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-tests">
                  No tests yet.
                </div>
              ) : (
                tests.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2"
                    data-testid={`row-test-${t.id}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.location}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.date} · {t.testType} · {t.lane}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{t.createdBy.name}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="text-sm font-semibold">Today’s weather</div>
            <div className="mt-3 space-y-2">
              {weather.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="empty-weather">
                  No weather logged.
                </div>
              ) : (
                weather.map((w) => (
                  <div
                    key={w.id}
                    className="rounded-xl border bg-background/50 px-3 py-2"
                    data-testid={`row-weather-${w.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium">{w.location}</div>
                      <div className="text-xs text-muted-foreground">{w.time}</div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Air {w.airTemperatureC}°C · Snow {w.snowTemperatureC}°C · {w.snowType}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="fs-card rounded-2xl p-4">
            <div className="text-sm font-semibold">Recently added</div>
            <div className="mt-3 space-y-2">
              <div className="text-xs text-muted-foreground">Products</div>
              <div className="space-y-2">
                {products.length === 0 ? (
                  <div className="text-sm text-muted-foreground" data-testid="empty-products">
                    No products yet.
                  </div>
                ) : (
                  products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2"
                      data-testid={`row-product-${p.id}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {p.brand} — {p.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.category}</div>
                      </div>
                      <span className="text-xs text-muted-foreground">{p.createdBy.name}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 text-xs text-muted-foreground">Series</div>
              <div className="space-y-2">
                {series.length === 0 ? (
                  <div className="text-sm text-muted-foreground" data-testid="empty-series">
                    No series yet.
                  </div>
                ) : (
                  series.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-xl border bg-background/50 px-3 py-2"
                      data-testid={`row-series-${s.id}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.type} · {s.numberOfSkis} skis
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{s.createdBy.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
