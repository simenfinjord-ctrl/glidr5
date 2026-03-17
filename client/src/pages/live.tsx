import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MonitorPlay, Trophy, Timer, User, MapPin, Calendar, Snowflake } from "lucide-react";

type WatchHeat = {
  pairA: number | null;
  pairB: number | null;
  distA: string;
  distB: string;
};

type LiveSession = {
  code: string;
  userName: string;
  testId: number | null;
  testInfo: { date: string; location: string; testType: string } | null;
  bracket: WatchHeat[][];
  currentHeat: {
    roundIndex: number;
    heatIndex: number;
    roundName: string;
    pairA: number;
    pairB: number;
  } | null;
  results: { skiNumber: number; diff: number; rank: number }[];
  totalHeats: number;
  completedHeats: number;
  isComplete: boolean;
  createdAt: number;
};

function getRoundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-final";
  if (fromEnd === 2) return "Quarter-final";
  return `Round ${roundIndex + 1}`;
}

function getWinner(heat: WatchHeat): number | null {
  if (heat.pairA !== null && heat.pairB === null) return heat.pairA;
  if (heat.pairB !== null && heat.pairA === null) return heat.pairB;
  if (heat.pairA === null || heat.pairB === null) return null;
  const dA = parseFloat(heat.distA), dB = parseFloat(heat.distB);
  if (isNaN(dA) || isNaN(dB)) return null;
  if (dA === 0 && dB > 0) return heat.pairA;
  if (dB === 0 && dA > 0) return heat.pairB;
  return null;
}

function LiveBracket({ session }: { session: LiveSession }) {
  const { bracket, currentHeat } = session;
  const totalRounds = bracket.length;

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {bracket.map((round, ri) => (
        <div key={ri} className="flex flex-col gap-2 min-w-[180px]">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-1">
            {getRoundName(ri, totalRounds)}
          </div>
          {round.map((heat, hi) => {
            const isActive =
              currentHeat?.roundIndex === ri && currentHeat?.heatIndex === hi;
            const winner = getWinner(heat);
            return (
              <div
                key={hi}
                className={cn(
                  "rounded-lg border p-2 text-sm transition-all",
                  isActive
                    ? "border-red-400 bg-red-50 dark:bg-red-950/30 ring-2 ring-red-400 animate-pulse"
                    : winner
                      ? "border-green-200 bg-green-50/50 dark:bg-green-950/20"
                      : "border-border bg-card"
                )}
              >
                <div
                  className={cn(
                    "flex justify-between items-center py-0.5",
                    winner === heat.pairA && "font-bold text-green-700 dark:text-green-400"
                  )}
                >
                  <span>{heat.pairA !== null ? `Pair ${heat.pairA}` : "—"}</span>
                  <span className="tabular-nums text-xs">{heat.distA || ""}</span>
                </div>
                <div className="border-t border-dashed my-0.5" />
                <div
                  className={cn(
                    "flex justify-between items-center py-0.5",
                    winner === heat.pairB && "font-bold text-green-700 dark:text-green-400"
                  )}
                >
                  <span>{heat.pairB !== null ? `Pair ${heat.pairB}` : "—"}</span>
                  <span className="tabular-nums text-xs">{heat.distB || ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LiveResults({ results }: { results: LiveSession["results"] }) {
  if (results.length === 0) return null;
  const medalColors = ["bg-yellow-400", "bg-gray-300", "bg-amber-600"];
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {results.map((r) => (
        <div
          key={r.skiNumber}
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
            r.rank <= 3
              ? `${medalColors[r.rank - 1]} text-white`
              : "bg-muted text-muted-foreground"
          )}
        >
          <span className="font-bold">#{r.rank}</span>
          <span>Pair {r.skiNumber}</span>
          {r.diff > 0 && (
            <span className="text-xs opacity-80">+{r.diff.toFixed(1)}cm</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SessionCard({ session }: { session: LiveSession }) {
  return (
    <Card
      className={cn(
        "fs-card rounded-2xl p-5 transition-all",
        !session.isComplete && "border-l-4 border-l-red-500"
      )}
      data-testid={`live-session-${session.code}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {session.isComplete ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Trophy className="mr-1 h-3 w-3" />
                Complete
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 animate-pulse">
                <span className="mr-1.5 h-2 w-2 rounded-full bg-red-500 inline-block" />
                LIVE
              </Badge>
            )}
            <span className="text-xs text-muted-foreground font-mono">
              #{session.code}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {session.userName}
            </span>
            {session.testInfo?.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {session.testInfo.location}
              </span>
            )}
            {session.testInfo?.date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {session.testInfo.date}
              </span>
            )}
            {session.testInfo?.testType && (
              <Badge variant="outline" className="text-xs">
                {session.testInfo.testType}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Progress</div>
          <div className="text-lg font-bold tabular-nums">
            {session.completedHeats}/{session.totalHeats}
          </div>
          <div className="w-24 h-1.5 bg-muted rounded-full mt-1">
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{
                width: `${session.totalHeats > 0 ? (session.completedHeats / session.totalHeats) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>

      {session.currentHeat && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
          <div className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
            Now playing — {session.currentHeat.roundName}
          </div>
          <div className="flex items-center justify-center gap-6 text-lg font-bold">
            <span>Pair {session.currentHeat.pairA}</span>
            <span className="text-red-400 text-sm">vs</span>
            <span>Pair {session.currentHeat.pairB}</span>
          </div>
        </div>
      )}

      <LiveBracket session={session} />
      <LiveResults results={session.results} />
    </Card>
  );
}

export default function Live() {
  const { data: sessions = [], isLoading } = useQuery<LiveSession[]>({
    queryKey: ["/api/live/runsheets"],
    refetchInterval: 3000,
  });

  const activeSessions = sessions.filter((s) => !s.isComplete);
  const completedSessions = sessions.filter((s) => s.isComplete);

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto" data-testid="live-page">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40">
              <MonitorPlay className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold" data-testid="text-page-title">
                Live Board
              </h1>
              <p className="text-sm text-muted-foreground">
                Active runsheet sessions — auto-refreshes every 3 seconds
              </p>
            </div>
          </div>
          {activeSessions.length > 0 && (
            <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 text-sm animate-pulse">
              <span className="mr-1.5 h-2 w-2 rounded-full bg-red-500 inline-block" />
              {activeSessions.length} active
            </Badge>
          )}
        </div>

        {isLoading ? (
          <Card className="fs-card rounded-2xl p-10 text-center text-muted-foreground">
            <Timer className="h-8 w-8 mx-auto mb-2 animate-spin" />
            Loading...
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="fs-card rounded-2xl p-10 text-center" data-testid="empty-live">
            <MonitorPlay className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold mb-1">No active runsheets</h2>
            <p className="text-sm text-muted-foreground">
              Start a runsheet from a test detail page to see it appear here in real-time.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {activeSessions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  Active
                </h2>
                {activeSessions.map((s) => (
                  <SessionCard key={s.code} session={s} />
                ))}
              </div>
            )}
            {completedSessions.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5" />
                  Completed
                </h2>
                {completedSessions.map((s) => (
                  <SessionCard key={s.code} session={s} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
