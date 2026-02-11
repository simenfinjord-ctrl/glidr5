import { Link } from "wouter";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/mock-auth";
import { listTests, listSeries } from "@/lib/mock-db";

export default function Tests() {
  const user = getCurrentUser();
  const tests = user ? listTests(user) : [];
  const series = user ? listSeries(user) : [];

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  const seriesById = new Map(series.map((s) => [s.id, s.name] as const));

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Tests</h1>
            <p className="mt-1 text-sm text-muted-foreground" data-testid="text-tests-subtitle">
              Table logs grouped by date and location.
            </p>
          </div>
          <Link href="/tests/new">
            <Button data-testid="button-new-test">
              <Plus className="mr-2 h-4 w-4" />
              New test
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {tests.length === 0 ? (
            <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="empty-tests">
              No tests yet.
            </Card>
          ) : (
            tests.map((t) => (
              <Card key={t.id} className="fs-card rounded-2xl p-4" data-testid={`card-test-${t.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{t.location}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t.date} · {t.testType} · {t.lane} · {seriesById.get(t.seriesId) ?? "Series"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Created by <span className="text-foreground">{t.createdBy.name}</span>
                      {` · Group ${t.groupScope}`}
                    </div>
                  </div>
                  <div className="inline-flex rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString()}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
