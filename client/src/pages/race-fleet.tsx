// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Race fleets IS an athlete: a hidden per-team "Race fleets" athlete owns the
// competition-ski series, and this route simply resolves it and opens the
// standard Athlete Skis page — identical layout, functions and test views,
// plus the fleet extras (series field, sit-ski) that page shows for it.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Boxes } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";

export default function RaceFleet() {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  const [, navigate] = useLocation();

  const { data, error, isLoading } = useQuery<{ athleteId: number }>({
    queryKey: ["/api/race-fleet/athlete"],
    retry: false,
  });
  const forbidden = (error as any)?.message?.includes("403");

  useEffect(() => {
    if (data?.athleteId) {
      // Preserve ?tab=tests etc. from deep links.
      let search = "";
      try { search = window.location.search || ""; } catch {}
      navigate(`/raceskis/${data.athleteId}${search}`, { replace: true });
    }
  }, [data?.athleteId, navigate]);

  return (
    <AppShell activeNav="/race-fleet">
      <div className="flex flex-col gap-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl" data-testid="text-racefleet-title">
          <Boxes className="h-6 w-6 text-primary" />{L("Konkurranseski (lag)", "Race fleets")}
        </h1>
        {forbidden ? (
          <Card className="fs-card rounded-2xl p-6 text-sm text-muted-foreground" data-testid="fleet-forbidden">
            {L("Race fleets er ikke aktivert for dette laget. En Super Admin må slå på «Para team».", "Race fleets is not enabled for this team. A Super Admin must turn on 'Para team'.")}
          </Card>
        ) : (
          <Card className="fs-card flex items-center gap-3 rounded-2xl p-6 text-sm text-muted-foreground">
            <Spinner />{isLoading ? L("Åpner lagets skiregister…", "Opening the team's ski register…") : null}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
