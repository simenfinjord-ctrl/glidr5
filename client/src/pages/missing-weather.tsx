// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Lists every test with no weather log and lets the user attach weather or skip
// (mark "no weather") per test — reached from the dashboard "missing weather" card.
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CloudSun, MapPin, Check, X, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ManualWeatherDialog } from "@/components/manual-weather-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Test = {
  id: number;
  date: string;
  location: string;
  testName: string | null;
  testType: string;
  weatherId: number | null;
  noWeather?: number;
  groupScope: string;
};

export default function MissingWeather() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const { toast } = useToast();
  const { data: tests = [], isLoading } = useQuery<Test[]>({ queryKey: ["/api/tests"] });
  const [dialogFor, setDialogFor] = useState<Test | null>(null);

  // Tests with no weather attached and not explicitly marked "no weather".
  const missing = useMemo(
    () => tests.filter((t) => !t.weatherId && !t.noWeather).sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [tests],
  );

  const attach = useMutation({
    mutationFn: async ({ testId, weatherId }: { testId: number; weatherId: number }) =>
      apiRequest("PATCH", `/api/tests/${testId}/weather`, { weatherId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tests"] }); toast({ title: L("Vær lagt til", "Weather added") }); },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });
  const skip = useMutation({
    mutationFn: async (testId: number) => apiRequest("PATCH", `/api/tests/${testId}/weather`, { noWeather: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tests"] }); toast({ title: L("Markert uten vær", "Marked as no weather") }); },
    onError: (e: any) => toast({ title: L("Feil", "Error"), description: e?.message, variant: "destructive" }),
  });

  const badgeClass = (type: string) =>
    type === "Glide" ? "fs-badge-glide"
      : type === "Grind" ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300"
      : type === "Classic" || type === "Skating" || type === "Double Poling" ? "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-300"
      : "fs-badge-structure";

  return (
    <AppShell activeNav="/weather">
      <div className="space-y-5 p-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20">
            <CloudSun className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{L("Mangler vær", "Missing weather")}</h1>
            <p className="text-sm text-muted-foreground">
              {L("Tester uten værlogg. Legg til vær eller marker som uten vær.", "Tests without a weather log. Add weather or mark as no weather.")}
            </p>
          </div>
        </div>

        {isLoading ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground">{L("Laster…", "Loading…")}</Card>
        ) : missing.length === 0 ? (
          <Card className="fs-card rounded-2xl p-8 text-center">
            <Check className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm font-medium">{L("Alle tester har vær eller er markert uten vær.", "All tests have weather or are marked as no weather.")}</p>
            <AppLink href="/dashboard"><Button variant="outline" size="sm" className="mt-3">{L("Til dashbordet", "Back to dashboard")}</Button></AppLink>
          </Card>
        ) : (
          <Card className="fs-card rounded-2xl divide-y">
            {missing.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badgeClass(t.testType))}>{t.testType}</span>
                <AppLink href={`/tests/${t.id}`} className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate hover:underline">{t.testName || t.location || L("Uten navn", "Untitled")}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                      <span>{t.date}</span>
                      {t.location && <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{t.location}</span>}
                    </div>
                  </div>
                </AppLink>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" onClick={() => setDialogFor(t)} data-testid={`button-add-weather-${t.id}`} disabled={attach.isPending}>
                    <Plus className="mr-1 h-3.5 w-3.5" />{L("Legg til vær", "Add weather")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => skip.mutate(t.id)} disabled={skip.isPending} data-testid={`button-skip-weather-${t.id}`}>
                    <X className="mr-1 h-3.5 w-3.5" />{L("La være", "Skip")}
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ManualWeatherDialog
        open={!!dialogFor}
        onClose={() => setDialogFor(null)}
        onCreated={(weatherId) => {
          if (dialogFor) attach.mutate({ testId: dialogFor.id, weatherId });
          setDialogFor(null);
        }}
        defaults={dialogFor ? { date: dialogFor.date, location: dialogFor.location, groupScope: dialogFor.groupScope } : undefined}
      />
    </AppShell>
  );
}
