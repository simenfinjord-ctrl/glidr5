import { useQuery } from "@tanstack/react-query";
import { Users, FlaskConical, Package, Building2, Activity, LogIn, Eye, Clock } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { cn, fmtDate } from "@/lib/utils";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Redirect } from "wouter";
import { Spinner } from "@/components/ui/spinner";
import { useI18n } from "@/lib/i18n";

type OverviewData = {
  teams: {
    id: number;
    name: string;
    isPaused: boolean;
    userCount: number;
    testCount: number;
    lastActivity: string | null;
  }[];
  recentTests: {
    id: number;
    teamName: string;
    date: string;
    location: string;
    testType: string;
    createdByName: string;
  }[];
  recentLogins: {
    userId: number;
    name: string;
    teamName: string;
    loggedInAt: string;
  }[];
  activeSessions: {
    userId: number;
    name: string;
    teamName: string;
    lastActive: string;
  }[];
  stats: {
    totalTeams: number;
    totalUsers: number;
    totalTests: number;
    totalProducts: number;
  };
};

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-200 dark:ring-blue-800" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-200 dark:ring-emerald-800" },
    amber: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", ring: "ring-amber-200 dark:ring-amber-800" },
    violet: { bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-600 dark:text-violet-400", ring: "ring-violet-200 dark:ring-violet-800" },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <Card className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 text-3xl font-bold text-foreground">{value.toLocaleString()}</div>
        </div>
        <div className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1", c.bg, c.ring)}>
          <Icon className={cn("h-6 w-6", c.text)} />
        </div>
      </div>
    </Card>
  );
}

function timeAgo(
  dateStr: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (!dateStr) return t("overview.never");
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("overview.justNow");
  if (mins < 60) return t("overview.mAgo", { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("overview.hAgo", { n: hrs });
  const days = Math.floor(hrs / 24);
  if (days < 30) return t("overview.dAgo", { n: days });
  return date.toLocaleDateString();
}

export default function Overview() {
  const { isSuperAdmin, isLoading: authLoading } = useAuth();
  const { t } = useI18n();

  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/admin/overview"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 30000,
    enabled: isSuperAdmin,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t("overview.saTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("overview.subtitle")}
          </p>
        </div>

        {isLoading || !data ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="h-8 w-8" />
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t("overview.totalTeams")} value={data.stats.totalTeams} icon={Building2} color="blue" />
              <StatCard label={t("overview.totalUsers")} value={data.stats.totalUsers} icon={Users} color="emerald" />
              <StatCard label={t("overview.totalTests")} value={data.stats.totalTests} icon={FlaskConical} color="amber" />
              <StatCard label={t("overview.totalProducts")} value={data.stats.totalProducts} icon={Package} color="violet" />
            </div>

            {/* Teams table */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 pb-3">
                <Building2 className="h-4 w-4 text-blue-500" />
                <span className="font-semibold text-foreground">{t("overview.teams")} ({data.teams.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-y border-border">
                      <th className="text-left px-5 py-2.5 font-medium text-foreground/80 text-xs">{t("common.team")}</th>
                      <th className="text-right px-5 py-2.5 font-medium text-foreground/80 text-xs">{t("common.users")}</th>
                      <th className="text-right px-5 py-2.5 font-medium text-foreground/80 text-xs">{t("analytics.testCount")}</th>
                      <th className="text-left px-5 py-2.5 font-medium text-foreground/80 text-xs">{t("overview.lastActivity")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.teams.map((team) => (
                      <tr
                        key={team.id}
                        className={cn(
                          "transition-colors",
                          team.isPaused ? "bg-red-50/60 dark:bg-red-900/10" : "hover:bg-muted/30"
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{team.name}</span>
                            {team.isPaused && (
                              <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                                {t("overview.suspended")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{team.userCount}</td>
                        <td className="px-5 py-3 text-right text-muted-foreground">{team.testCount}</td>
                        <td className="px-5 py-3 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {timeAgo(team.lastActivity, t)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Recent Tests */}
              <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 p-5 pb-3">
                  <FlaskConical className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold text-foreground">{t("overview.recentTests")}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ml-auto">
                    {t("overview.last20")}
                  </span>
                </div>
                {data.recentTests.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-muted-foreground">{t("overview.noTests")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-y border-border">
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.date")}</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.team")}</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.location")}</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("overview.by")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {data.recentTests.map((test) => (
                          <tr key={test.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(test.date) || "—"}</td>
                            <td className="px-4 py-2.5 font-medium text-foreground text-xs">{test.teamName || "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{test.location || "—"}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{test.createdByName || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {/* Current Sessions */}
              <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 p-5 pb-3">
                  <Eye className="h-4 w-4 text-violet-500" />
                  <span className="font-semibold text-foreground">{t("overview.currentSessions")}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ml-auto">
                    {(data.activeSessions ?? []).length} {t("overview.active")}
                  </span>
                </div>
                {(data.activeSessions ?? []).length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-muted-foreground">{t("overview.noSessions")}</p>
                ) : (
                  <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/40 border-y border-border">
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.user")}</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.team")}</th>
                          <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("overview.expires")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {(data.activeSessions ?? []).map((s, i) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground text-xs">{s.name}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{s.teamName}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(s.lastActive, t)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            {/* Recent Logins */}
            <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 p-5 pb-3">
                <LogIn className="h-4 w-4 text-emerald-500" />
                <span className="font-semibold text-foreground">{t("overview.recentLogins")}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ml-auto">
                  {t("overview.lastN", { n: data.recentLogins.length })}
                </span>
              </div>
              {data.recentLogins.length === 0 ? (
                <p className="px-5 pb-4 text-sm text-muted-foreground">{t("overview.noLogins")}</p>
              ) : (
                <div className="overflow-x-auto" style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-y border-border">
                        <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.user")}</th>
                        <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("common.team")}</th>
                        <th className="text-left px-4 py-2 font-medium text-foreground/80 text-xs">{t("overview.when")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {data.recentLogins.map((login, i) => (
                        <tr key={i} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-foreground text-xs">{login.name || t("common.unknown")}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground">{login.teamName || "—"}</td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(login.loggedInAt, t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
