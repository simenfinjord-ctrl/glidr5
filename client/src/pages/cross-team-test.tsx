// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Read-only view of a test owned by ANOTHER of your teams. The All teams page
// lists such tests, so it must be possible to open them — but editing belongs
// to the owning team's context, so this view is deliberately read-only.
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AppLink } from "@/components/app-link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft, Users, MapPin, Calendar, Thermometer, Snowflake } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fmtT } from "@/lib/temperature";
import { cn } from "@/lib/utils";

type Row = {
  skiNumber: number;
  rank0km: number | null; rankXkm: number | null;
  result0km: number | null; resultXkm: number | null;
  feelingRank: number | null; feelingNote: string | null;
  kickRank: number | null; kickSolution: string | null;
  methodology: string | null; freeTextProduct: string | null; grindType: string | null;
  brand: string | null; productName: string | null; category: string | null;
};

export default function CrossTeamTest() {
  const { id } = useParams<{ id: string }>();
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);

  const { data, isLoading, error } = useQuery<any>({
    queryKey: [`/api/tests/${id}/cross-team`],
  });

  if (isLoading) {
    return <AppShell><div className="flex justify-center py-20"><Spinner /></div></AppShell>;
  }
  if (error || !data?.test) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-sm text-muted-foreground">{L("Du har ikke tilgang til denne testen.", "You don't have access to this test.")}</p>
          <AppLink href="/all-teams-tests"><Button variant="outline" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />{L("Tilbake til Alle lag", "Back to All teams")}</Button></AppLink>
        </div>
      </AppShell>
    );
  }

  const t = data.test;
  const rows: Row[] = data.entries ?? [];
  const w = data.weather;
  const label = (r: Row) =>
    r.grindType || (r.brand || r.productName
      ? [r.brand, r.productName, r.category].filter(Boolean).join(" ")
      : r.freeTextProduct || "—");

  return (
    <AppShell>
      <div className="flex flex-col gap-5">
        <div>
          <AppLink href="/all-teams-tests">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-2 h-4 w-4" />{L("Alle lag", "All teams")}</Button>
          </AppLink>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold">{t.testName || t.location}</h1>
            <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Users className="mr-1.5 h-3 w-3" />{data.teamName} · {L("kun lesetilgang", "read-only")}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t.date}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{t.location}</span>
            <span>{t.testType}</span>
            {t.createdByName && <span>· {t.createdByName}</span>}
          </p>
        </div>

        {w && (
          <Card className="fs-card rounded-2xl p-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="inline-flex items-center gap-1.5"><Thermometer className="h-4 w-4 text-sky-500" />{L("Luft", "Air")} {fmtT(w.airTemperatureC)}</span>
              <span className="inline-flex items-center gap-1.5"><Snowflake className="h-4 w-4 text-emerald-500" />{L("Snø", "Snow")} {fmtT(w.snowTemperatureC)}</span>
              {w.snowType && <span className="text-muted-foreground">{w.snowType}</span>}
            </div>
          </Card>
        )}

        <Card className="fs-card rounded-2xl p-4">
          <h2 className="mb-3 text-sm font-semibold">{L("Resultater", "Results")} <span className="text-muted-foreground">({rows.length})</span></h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{L("Ingen resultater registrert.", "No results recorded.")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-3">{L("Ski", "Ski")}</th>
                    <th className="pb-2 pr-3">{L("Produkt / slip", "Product / grind")}</th>
                    <th className="pb-2 pr-3">{L("Resultat", "Result")}</th>
                    <th className="pb-2 pr-3">{L("Rangering", "Rank")}</th>
                    <th className="pb-2">{L("Følelse", "Feel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.skiNumber} className={cn("border-b border-border/30", r.rank0km === 1 && "bg-emerald-50/60 dark:bg-emerald-950/20")}>
                      <td className="py-1.5 pr-3 font-medium">{r.skiNumber}</td>
                      <td className="py-1.5 pr-3">{label(r)}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{r.result0km ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{r.rank0km ?? "—"}</td>
                      <td className="py-1.5">{r.feelingRank ?? "—"}{r.feelingNote ? <span className="ml-1 text-xs text-muted-foreground">({r.feelingNote})</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {t.notes && (
          <Card className="fs-card rounded-2xl p-4">
            <h2 className="mb-1 text-sm font-semibold">{L("Notater", "Notes")}</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.notes}</p>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          {L(`Denne testen tilhører ${data.teamName}. Bytt til laget i lagvelgeren for å redigere den.`,
             `This test belongs to ${data.teamName}. Switch to that team in the team picker to edit it.`)}
        </p>
      </div>
    </AppShell>
  );
}
