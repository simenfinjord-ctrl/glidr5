import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Radio, Trophy, User, Calendar, MapPin, Snowflake, LayoutGrid, LayoutList, Filter, Watch, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Heat = {
  pairA: number | null;
  pairB: number | null;
  distA: string;
  distB: string;
};

type LiveRunsheet = {
  id: number;
  testId: number;
  userId: number;
  userName: string;
  operatorName?: string | null;
  testDate: string;
  testLocation: string;
  testName: string | null;
  testType: string;
  seriesName: string | null;
  testSkiSource: string;
  pairLabels: Record<string, string> | null;
  bracket: Heat[][] | null;
  updatedAt: string;
  completedAt: string | null;
  isWatchSession?: boolean;
};

function getRoundName(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - 1 - roundIndex;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-final";
  if (fromEnd === 2) return "Quarter-final";
  return `Round ${roundIndex + 1}`;
}

function getWinner(heat: Heat): number | null {
  if (heat.pairA !== null && heat.pairB === null) return heat.pairA;
  if (heat.pairB !== null && heat.pairA === null) return heat.pairB;
  if (heat.pairA === null || heat.pairB === null) return null;
  const dA = parseFloat(heat.distA);
  const dB = parseFloat(heat.distB);
  if (isNaN(dA) || isNaN(dB)) return null;
  if (dA === 0 && dB > 0) return heat.pairA;
  if (dB === 0 && dA > 0) return heat.pairB;
  return null;
}

function calculateResults(bracket: Heat[][]): { pair: number; rank: number; diff: number }[] {
  const diffs = new Map<number, number>();
  for (let r = bracket.length - 1; r >= 0; r--) {
    for (const heat of bracket[r]) {
      if (heat.pairA === null || heat.pairB === null) continue;
      const dA = parseFloat(heat.distA);
      const dB = parseFloat(heat.distB);
      if (isNaN(dA) || isNaN(dB)) continue;
      if (dA === 0 && dB > 0) {
        if (!diffs.has(heat.pairA)) diffs.set(heat.pairA, 0);
        diffs.set(heat.pairB, dB + (diffs.get(heat.pairA) ?? 0));
      } else if (dB === 0 && dA > 0) {
        if (!diffs.has(heat.pairB)) diffs.set(heat.pairB, 0);
        diffs.set(heat.pairA, dA + (diffs.get(heat.pairB) ?? 0));
      }
    }
  }
  const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
  const list: { pair: number; rank: number; diff: number }[] = [];
  let prevDiff: number | null = null;
  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const [pair, diff] = sorted[i];
    if (prevDiff !== null && diff !== prevDiff) currentRank = i + 1;
    list.push({ pair, rank: currentRank, diff });
    prevDiff = diff;
  }
  return list;
}

function getProgress(bracket: Heat[][]): { completed: number; total: number } {
  let completed = 0;
  let total = 0;
  for (const round of bracket) {
    for (const heat of round) {
      if (heat.pairA === null && heat.pairB === null) continue;
      if (heat.pairA !== null && heat.pairB === null) continue;
      if (heat.pairB !== null && heat.pairA === null) continue;
      total++;
      if (getWinner(heat)) completed++;
    }
  }
  return { completed, total };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ago`;
}

function LiveBracket({ session }: { session: LiveRunsheet }) {
  const [, navigate] = useLocation();
  const bracket = session.bracket;
  if (!bracket || bracket.length === 0) return null;

  const pl = session.pairLabels;
  const label = (pair: number | null) => {
    if (pair === null) return "—";
    if (pl && pl[String(pair)]) return pl[String(pair)];
    return String(pair);
  };

  const progress = getProgress(bracket);
  const totalRounds = bracket.length;
  const isCompleted = !!session.completedAt;

  return (
    <Card className="p-4 sm:p-5" data-testid={`card-live-runsheet-${session.id}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold truncate" data-testid={`text-live-title-${session.id}`}>
              {session.testName || session.testLocation}
            </h3>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Trophy className="h-3 w-3" />
                Finished
              </span>
            )}
            {!isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 animate-pulse">
                <Radio className="h-3 w-3" />
                Live
              </span>
            )}
            {session.isWatchSession && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
                <Watch className="h-3 w-3" />
                {session.operatorName ? `Watch-${session.operatorName}` : "Watch"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {session.userName}
            </span>
            {session.seriesName && (
              <span className="flex items-center gap-1">
                <Snowflake className="h-3.5 w-3.5" />
                {session.seriesName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {session.testDate}
            </span>
            {session.testLocation && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {session.testLocation}
              </span>
            )}
            <span className="text-xs text-muted-foreground/60">
              {session.testType} &middot; Updated {timeAgo(session.updatedAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Heats</div>
            <div className="text-sm font-bold tabular-nums">{progress.completed}/{progress.total}</div>
          </div>
          <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.completed === progress.total ? "bg-amber-500" : "bg-green-500"
              )}
              style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {(() => {
          const res = calculateResults(bracket);
          const resMap = new Map(res.map((r) => [r.pair, r]));
          const firstRound = bracket[0];
          if (res.length === 0 || !firstRound) return null;
          const roundSpacing = "gap-2";
          return (
            <div className="shrink-0 flex flex-col">
              <div className="text-[10px] font-semibold mb-1.5 text-center uppercase tracking-wider text-muted-foreground">
                Results
              </div>
              <div className={cn("flex flex-col justify-around flex-1", roundSpacing)}>
                {firstRound.map((heat, hIdx) => (
                  <div key={hIdx} className="min-w-[120px] text-xs">
                    {[heat.pairA, heat.pairB].filter((p) => p !== null).map((pair) => {
                      const r = resMap.get(pair!);
                      return (
                        <div
                          key={pair}
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-1.5",
                            r?.rank === 1 && "bg-amber-50 dark:bg-amber-900/20 rounded",
                          )}
                        >
                          {r ? (
                            <>
                              <span className={cn(
                                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold shrink-0",
                                r.rank === 1 && "bg-yellow-400 text-yellow-900",
                                r.rank === 2 && "bg-gray-300 text-gray-800",
                                r.rank === 3 && "bg-amber-600 text-white",
                                r.rank > 3 && "bg-muted text-muted-foreground",
                              )}>
                                {r.rank}
                              </span>
                              <span className="font-medium">{label(pair)}</span>
                              <span className="text-muted-foreground tabular-nums ml-auto">
                                {r.diff > 0 ? `+${r.diff}` : "0"}cm
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground">{label(pair)} —</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {bracket.map((round, rIdx) => {
          const roundSpacing =
            rIdx === 0 ? "gap-2" : rIdx === 1 ? "gap-6" : rIdx === 2 ? "gap-12" : "gap-20";

          return (
            <div key={rIdx} className="shrink-0 flex flex-col">
              <div className="text-[10px] font-semibold mb-1.5 text-center uppercase tracking-wider text-muted-foreground">
                {getRoundName(rIdx, totalRounds)}
              </div>
              <div className={cn("flex flex-col justify-around flex-1", roundSpacing)}>
                {round.map((heat, hIdx) => {
                  const isBye =
                    (heat.pairA !== null && heat.pairB === null) ||
                    (heat.pairB !== null && heat.pairA === null);
                  const winnerPair = getWinner(heat);
                  const isActive = heat.pairA !== null && heat.pairB !== null && !winnerPair;

                  return (
                    <div
                      key={hIdx}
                      className={cn(
                        "rounded-lg border min-w-[140px] text-xs",
                        isBye && "opacity-50",
                        isActive && "border-green-400 dark:border-green-600 ring-1 ring-green-400/30",
                        !isActive && "border-border",
                      )}
                      data-testid={`live-heat-r${rIdx}-h${hIdx}-${session.id}`}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-between gap-1.5 px-2.5 py-1.5 border-b border-border",
                          winnerPair === heat.pairA && heat.pairA !== null && "bg-green-50 dark:bg-green-900/20",
                        )}
                      >
                        <span className="font-medium truncate">
                          {label(heat.pairA)}
                        </span>
                        <span className={cn(
                          "tabular-nums font-mono min-w-[2.5rem] text-center rounded px-1 py-0.5",
                          heat.distA === "0" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold" : "text-muted-foreground"
                        )}>
                          {heat.distA || "—"}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "flex items-center justify-between gap-1.5 px-2.5 py-1.5",
                          winnerPair === heat.pairB && heat.pairB !== null && "bg-green-50 dark:bg-green-900/20",
                        )}
                      >
                        <span className="font-medium truncate">
                          {label(heat.pairB)}
                        </span>
                        <span className={cn(
                          "tabular-nums font-mono min-w-[2.5rem] text-center rounded px-1 py-0.5",
                          heat.distB === "0" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold" : "text-muted-foreground"
                        )}>
                          {heat.distB || "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {session.testId && (
        <div className="mt-3 pt-3 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => navigate(`/tests/${session.testId}`)}
            data-testid={`button-open-test-${session.id}`}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open test
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function LiveRunsheets() {
  const { data: sessions = [], isLoading } = useQuery<LiveRunsheet[]>({
    queryKey: ["/api/live-runsheets"],
    refetchInterval: 3000,
  });
  const [twoCol, setTwoCol] = useState(() => localStorage.getItem("glidr-live-twocol") === "true");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  const testTypes = useMemo(() => {
    const types = new Set(sessions.map(s => s.testType));
    return [...types].sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = [...sessions];
    if (typeFilter !== "all") list = list.filter(s => s.testType === typeFilter);
    if (sourceFilter !== "all") list = list.filter(s => s.testSkiSource === sourceFilter);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [sessions, typeFilter, sourceFilter]);

  const activeFilters = (typeFilter !== "all" ? 1 : 0) + (sourceFilter !== "all" ? 1 : 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl flex items-center gap-3" data-testid="text-live-runsheets-title">
            <Radio className="h-7 w-7 text-green-500" />
            Live Runsheets
          </h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => { const next = !twoCol; setTwoCol(next); localStorage.setItem("glidr-live-twocol", String(next)); }}
              data-testid="button-toggle-live-layout"
              title={twoCol ? "Single column" : "Two columns"}
            >
              {twoCol ? <LayoutList className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <span className="text-sm text-muted-foreground">
              Auto-updates every 3s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilters > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold">{activeFilters}</span>
            )}
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px] h-9" data-testid="select-live-type-filter">
              <SelectValue placeholder="Test type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {testTypes.map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[150px] h-9" data-testid="select-live-source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="series">Test skis</SelectItem>
              <SelectItem value="raceskis">Race skis</SelectItem>
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setTypeFilter("all"); setSourceFilter("all"); }} data-testid="button-clear-live-filters">
              Clear filters
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20 text-muted-foreground" data-testid="loading-live-runsheets">
            <div className="w-8 h-8 border-4 border-muted border-t-green-500 rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="p-8 text-center" data-testid="empty-live-runsheets">
            <Radio className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {activeFilters > 0 ? "No runsheets match your filters" : "No active runsheets right now"}
            </p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              {activeFilters > 0
                ? "Try adjusting the filters to see more results."
                : "When someone starts a Complete Runsheet, it will appear here in real time."}
            </p>
          </Card>
        )}

        <div className={cn("grid gap-4", twoCol ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
          {filtered.map((session) => (
            <LiveBracket key={session.id} session={session} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
