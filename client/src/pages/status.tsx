// © 2025 Glidr — Proprietary and confidential. All rights reserved.
// Public status page: self-reported health of the API/database, refreshed
// every 30 s. Point an external monitor (e.g. UptimeRobot) at /api/health
// for independent alerting.
import { useEffect, useState } from "react";
import { PublicNav } from "@/components/public-nav";
import { useLanguage } from "@/lib/language";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export default function Status() {
  const { lang } = useLanguage();
  const no = lang === "no";
  const [state, setState] = useState<"loading" | "ok" | "down">("loading");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  async function check() {
    const t0 = performance.now();
    try {
      const res = await fetch("/api/health", { signal: AbortSignal.timeout(8000) });
      setLatencyMs(Math.round(performance.now() - t0));
      setState(res.ok ? "ok" : "down");
    } catch {
      setLatencyMs(null);
      setState("down");
    }
    setCheckedAt(new Date());
  }

  useEffect(() => {
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  const ok = state === "ok";
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-14">
        <h1 className="text-2xl font-bold" data-testid="heading-status">Glidr Status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {no ? "Driftsstatus for glidr.no — oppdateres automatisk hvert 30. sekund." : "Operational status for glidr.no — refreshes automatically every 30 seconds."}
        </p>

        <Card className="mt-6 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            {state === "loading" ? (
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : ok ? (
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            ) : (
              <XCircle className="h-8 w-8 text-red-500" />
            )}
            <div>
              <div className="text-lg font-semibold" data-testid="status-headline">
                {state === "loading" ? (no ? "Sjekker…" : "Checking…")
                  : ok ? (no ? "Alle systemer i drift" : "All systems operational")
                  : (no ? "Problemer med tjenesten" : "Service disruption")}
              </div>
              <div className="text-xs text-muted-foreground">
                {no ? "API og database" : "API and database"}
                {latencyMs != null && ` · ${latencyMs} ms`}
                {checkedAt && ` · ${no ? "sist sjekket" : "last checked"} ${checkedAt.toLocaleTimeString()}`}
              </div>
            </div>
          </div>
        </Card>

        <p className="mt-6 text-xs text-muted-foreground">
          {no
            ? "Opplever du problemer som ikke vises her? Kontakt oss på hei@glidr.no."
            : "Experiencing issues not shown here? Contact us at hei@glidr.no."}
        </p>
      </div>
    </div>
  );
}
