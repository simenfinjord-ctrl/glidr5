import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, RotateCcw, Trophy, WifiOff, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { MobileRunsheet } from "./mobile-runsheet";

type Heat = {
  pairA: number | null;
  pairB: number | null;
  distA: string;
  distB: string;
};

export type BracketResult = {
  skiNumber: number;
  diff: number;
  rank: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skiPairs: number[];
  skiLabels?: Record<number, string>;
  loading?: boolean;
  error?: string;
  testId?: number;
  onApplyResults: (results: BracketResult[], bracket: Heat[][]) => void;
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

function rebuildDownstream(bracket: Heat[][], fromRound: number) {
  for (let r = fromRound; r < bracket.length; r++) {
    for (const heat of bracket[r]) {
      heat.pairA = null;
      heat.pairB = null;
      heat.distA = "";
      heat.distB = "";
    }
  }
  for (let r = Math.max(0, fromRound - 1); r < bracket.length - 1; r++) {
    for (let h = 0; h < bracket[r].length; h++) {
      const heat = bracket[r][h];
      const winner = getWinner(heat);
      if (winner === null) continue;

      const nextHeat = Math.floor(h / 2);
      const nextSlot = h % 2 === 0 ? "A" : "B";

      if (!bracket[r + 1]?.[nextHeat]) continue;

      if (nextSlot === "A") {
        bracket[r + 1][nextHeat].pairA = winner;
      } else {
        bracket[r + 1][nextHeat].pairB = winner;
      }
    }
  }
}

function initBracket(pairs: number[]): Heat[][] {
  if (pairs.length < 2) return [];

  const totalRounds = Math.ceil(Math.log2(pairs.length));
  const rounds: Heat[][] = [];

  const firstRound: Heat[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    firstRound.push({
      pairA: pairs[i],
      pairB: i + 1 < pairs.length ? pairs[i + 1] : null,
      distA: "",
      distB: "",
    });
  }
  rounds.push(firstRound);

  let prevCount = firstRound.length;
  for (let r = 1; r < totalRounds; r++) {
    const numHeats = Math.ceil(prevCount / 2);
    const round: Heat[] = [];
    for (let h = 0; h < numHeats; h++) {
      round.push({ pairA: null, pairB: null, distA: "", distB: "" });
    }
    rounds.push(round);
    prevCount = numHeats;
  }

  for (let r = 0; r < rounds.length - 1; r++) {
    for (let h = 0; h < rounds[r].length; h++) {
      const heat = rounds[r][h];
      const byeWinner =
        heat.pairA !== null && heat.pairB === null
          ? heat.pairA
          : heat.pairB !== null && heat.pairA === null
            ? heat.pairB
            : null;

      if (byeWinner !== null) {
        const nextHeat = Math.floor(h / 2);
        const nextSlot = h % 2 === 0 ? "A" : "B";
        if (rounds[r + 1]?.[nextHeat]) {
          if (nextSlot === "A") rounds[r + 1][nextHeat].pairA = byeWinner;
          else rounds[r + 1][nextHeat].pairB = byeWinner;
        }
      }
    }
  }

  return rounds;
}

function calculateDiffs(bracket: Heat[][]): Map<number, number> {
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

  return diffs;
}

function bracketMatchesPairs(bracket: Heat[][], pairs: number[]): boolean {
  if (bracket.length === 0 || pairs.length < 2) return false;
  const firstRound = bracket[0];
  const bracketPairs = new Set<number>();
  for (const h of firstRound) {
    if (h.pairA !== null) bracketPairs.add(h.pairA);
    if (h.pairB !== null) bracketPairs.add(h.pairB);
  }
  if (bracketPairs.size !== pairs.length) return false;
  for (const p of pairs) {
    if (!bracketPairs.has(p)) return false;
  }
  return true;
}

function bracketHasProgress(bracket: Heat[][]): boolean {
  for (const round of bracket) {
    for (const heat of round) {
      if (heat.distA || heat.distB) return true;
    }
  }
  return false;
}

export function RunsheetDialog({
  open,
  onOpenChange,
  skiPairs,
  skiLabels,
  loading,
  error,
  testId,
  onApplyResults,
}: Props) {
  const label = (pair: number | null) => pair !== null && skiLabels?.[pair] ? skiLabels[pair] : pair !== null ? String(pair) : "—";
  const [bracket, setBracket] = useState<Heat[][]>([]);
  const [mobileMode, setMobileMode] = useState(false);
  const [resumed, setResumed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initializedRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveBracketToServer = useCallback((b: Heat[][]) => {
    if (!testId || b.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch(`/api/tests/${testId}/runsheet-progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bracket: b }),
      }).catch(() => {});
    }, 500);
  }, [testId]);

  const clearBracketFromServer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!testId) return;
    fetch(`/api/tests/${testId}/runsheet-progress`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => {});
  }, [testId]);

  const completeBracketOnServer = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (!testId) return;
    fetch(`/api/tests/${testId}/runsheet-progress/complete`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }, [testId]);

  useEffect(() => {
    if (open && skiPairs.length >= 2 && testId) {
      const pairsKey = `${testId}:${skiPairs.join(",")}`;
      if (initializedRef.current === pairsKey) return;
      initializedRef.current = pairsKey;
      setResumed(false);

      fetch(`/api/tests/${testId}/runsheet-progress`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data && data.bracket && Array.isArray(data.bracket) && bracketMatchesPairs(data.bracket, skiPairs) && bracketHasProgress(data.bracket)) {
            setBracket(data.bracket);
            setResumed(true);
          } else {
            setBracket(initBracket(skiPairs));
          }
        })
        .catch(() => {
          setBracket(initBracket(skiPairs));
        });

      setWatchCode(null);
      setWatchActive(false);
    }
    if (!open) {
      initializedRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, skiPairs.join(","), testId]);

  useEffect(() => {
    if (bracket.length > 0 && bracketHasProgress(bracket)) {
      saveBracketToServer(bracket);
    }
  }, [bracket, saveBracketToServer]);

  const handleDistanceChange = useCallback(
    (roundIndex: number, heatIndex: number, slot: "A" | "B", value: string) => {
      setBracket((prev) => {
        const nb = prev.map((round) => round.map((h) => ({ ...h })));
        const heat = nb[roundIndex][heatIndex];

        if (slot === "A") heat.distA = value;
        else heat.distB = value;

        rebuildDownstream(nb, roundIndex + 1);

        return nb;
      });
      setResumed(false);
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (skiPairs.length >= 2) {
      const fresh = initBracket(skiPairs);
      setBracket(fresh);
      clearBracketFromServer();
      setResumed(false);
    }
  }, [skiPairs, clearBracketFromServer]);

  const diffs = useMemo(() => calculateDiffs(bracket), [bracket]);

  const results = useMemo((): BracketResult[] => {
    if (diffs.size === 0) return [];

    const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
    const list: BracketResult[] = [];

    let prevDiff: number | null = null;
    let currentRank = 1;

    for (let i = 0; i < sorted.length; i++) {
      const [skiNumber, diff] = sorted[i];
      if (prevDiff !== null && diff !== prevDiff) {
        currentRank = i + 1;
      }
      list.push({ skiNumber, diff, rank: currentRank });
      prevDiff = diff;
    }

    return list;
  }, [diffs]);

  const hasChampion = useMemo(() => {
    if (bracket.length === 0) return false;
    const finalRound = bracket[bracket.length - 1];
    if (finalRound.length !== 1) return false;
    const finalHeat = finalRound[0];
    return getWinner(finalHeat) !== null;
  }, [bracket]);

  const isComplete = results.length === skiPairs.length && hasChampion;
  const hasProgress = bracketHasProgress(bracket);

  const handleApply = () => {
    if (watchActive) handleStopWatch();
    completeBracketOnServer();
    onApplyResults(results, bracket);
  };

  const handleClose = () => {
    if (watchActive) handleStopWatch();
    onOpenChange(false);
  };

  const handleMobileBracketUpdate = useCallback((updatedBracket: Heat[][]) => {
    setBracket(updatedBracket);
  }, []);

  const totalRounds = bracket.length;

  const showLoading = !error && (loading || bracket.length === 0);

  return (
    <>
    <Dialog open={open && !mobileMode} onOpenChange={(v) => {
      if (!v) {
        if (watchActive) handleStopWatch();
      }
      onOpenChange(v);
    }}>
      <DialogContent className="max-w-[95vw] w-auto max-h-[90vh] overflow-auto p-4 sm:p-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="error-runsheet-bracket">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
              <WifiOff className="h-8 w-8 text-red-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Could not load</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        ) : showLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="loading-runsheet-bracket">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-teal-100 border-t-teal-500 animate-spin" />
              <Trophy className="absolute inset-0 m-auto h-6 w-6 text-teal-500" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-lg">Preparing runsheet…</p>
              <p className="text-sm text-muted-foreground mt-1">Loading ski pairs and building bracket</p>
            </div>
          </div>
        ) : (
        <>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Complete Runsheet
              {hasProgress && !isComplete && (
                <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                  In progress
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileMode(true)}
                data-testid="button-mobile-mode"
                title="Full-screen mobile mode"
              >
                <Smartphone className="mr-1 h-4 w-4" />
                Mobile
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                data-testid="button-reset-runsheet"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </DialogHeader>

        {resumed && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300" data-testid="resumed-banner">
            Resumed from where you left off. Use Reset to start over.
          </div>
        )}

        {isComplete && (
          <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 mb-2">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              <Trophy className="h-3.5 w-3.5" />
              Final Results
            </div>
            <table className="text-sm border-collapse w-auto" data-testid="table-runsheet-final-results">
              <thead>
                <tr>
                  <th className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-left bg-amber-100/50 dark:bg-amber-900/30">Ski pair</th>
                  <th className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-center bg-amber-100/50 dark:bg-amber-900/30">Rank</th>
                  <th className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-center bg-amber-100/50 dark:bg-amber-900/30">Diff</th>
                </tr>
              </thead>
              <tbody>
                {[...results].sort((a, b) => a.rank - b.rank).map((r) => (
                  <tr key={r.skiNumber} className={cn(r.rank === 1 && "bg-amber-50 dark:bg-amber-900/20")} data-testid={`row-final-result-${r.skiNumber}`}>
                    <td className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-center font-medium">{skiLabels?.[r.skiNumber] ?? r.skiNumber}</td>
                    <td className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-center">
                      <span className={cn("inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold", r.rank === 1 && "bg-yellow-400 text-yellow-900", r.rank === 2 && "bg-gray-300 text-gray-800", r.rank === 3 && "bg-amber-600 text-white", r.rank > 3 && "bg-muted text-muted-foreground")}>{r.rank}</span>
                    </td>
                    <td className="border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-center tabular-nums">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-6 overflow-x-auto py-2 min-h-[200px]">
          <div className="shrink-0">
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
              Results
            </h3>
            <table className="text-sm border-collapse" data-testid="table-runsheet-results">
              <thead>
                <tr>
                  <th className="border border-border px-3 py-1.5 text-left bg-muted/50">
                    Ski pair
                  </th>
                  <th className="border border-border px-3 py-1.5 text-center bg-muted/50">
                    Rank
                  </th>
                  <th className="border border-border px-3 py-1.5 text-center bg-muted/50">
                    Diff
                  </th>
                </tr>
              </thead>
              <tbody>
                {skiPairs.map((pair) => {
                  const r = results.find((x) => x.skiNumber === pair);
                  const isWinner = r?.rank === 1;
                  return (
                    <tr
                      key={pair}
                      className={cn(isWinner && "bg-amber-50 dark:bg-amber-900/20")}
                      data-testid={`row-runsheet-result-${pair}`}
                    >
                      <td className="border border-border px-3 py-1.5 text-center font-medium">
                        {skiLabels?.[pair] ?? pair}
                      </td>
                      <td className="border border-border px-3 py-1.5 text-center">
                        {r ? (
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                              r.rank === 1 &&
                                "bg-yellow-400 text-yellow-900",
                              r.rank === 2 &&
                                "bg-gray-300 text-gray-800",
                              r.rank === 3 &&
                                "bg-amber-600 text-white",
                            )}
                          >
                            {r.rank}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border border-border px-3 py-1.5 text-center tabular-nums">
                        {r ? r.diff : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {[...bracket].reverse().map((round, revIdx) => {
            const rIdx = bracket.length - 1 - revIdx;
            const roundSpacing =
              rIdx === 0
                ? "gap-3"
                : rIdx === 1
                  ? "gap-8"
                  : rIdx === 2
                    ? "gap-16"
                    : "gap-24";

            return (
              <div key={rIdx} className="shrink-0 flex flex-col">
                <h3 className="text-xs font-semibold mb-2 text-center uppercase tracking-wide text-muted-foreground">
                  {getRoundName(rIdx, totalRounds)}
                </h3>
                <div
                  className={cn(
                    "flex flex-col justify-around flex-1",
                    roundSpacing,
                  )}
                >
                  {round.map((heat, hIdx) => {
                    const isBye =
                      (heat.pairA !== null && heat.pairB === null) ||
                      (heat.pairB !== null && heat.pairA === null);
                    const winnerPair = getWinner(heat);

                    return (
                      <div
                        key={hIdx}
                        className={cn(
                          "rounded-lg border border-border min-w-[180px]",
                          isBye && "opacity-60",
                        )}
                        data-testid={`heat-r${rIdx}-h${hIdx}`}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 border-b border-border",
                            winnerPair === heat.pairA &&
                              heat.pairA !== null &&
                              "bg-green-50 dark:bg-green-900/20",
                          )}
                        >
                          <span className="text-sm font-medium w-14 truncate">
                            {label(heat.pairA)}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className={cn(
                              "w-20 h-8 text-center text-sm tabular-nums",
                              "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
                              "focus:ring-amber-400",
                            )}
                            value={heat.distA}
                            disabled={heat.pairA === null || isBye || watchActive}
                            onChange={(e) =>
                              handleDistanceChange(
                                rIdx,
                                hIdx,
                                "A",
                                e.target.value,
                              )
                            }
                            data-testid={`input-runsheet-r${rIdx}-h${hIdx}-a`}
                          />
                        </div>

                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-2",
                            winnerPair === heat.pairB &&
                              heat.pairB !== null &&
                              "bg-green-50 dark:bg-green-900/20",
                          )}
                        >
                          <span className="text-sm font-medium w-14 truncate">
                            {label(heat.pairB)}
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className={cn(
                              "w-20 h-8 text-center text-sm tabular-nums",
                              "bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700",
                              "focus:ring-amber-400",
                            )}
                            value={heat.distB}
                            disabled={heat.pairB === null || isBye || watchActive}
                            onChange={(e) =>
                              handleDistanceChange(
                                rIdx,
                                hIdx,
                                "B",
                                e.target.value,
                              )
                            }
                            data-testid={`input-runsheet-r${rIdx}-h${hIdx}-b`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {watchActive
              ? "Watch mode active — results update live from your Garmin."
              : "Enter 0 for the winning pair in each heat. Winners auto-advance."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleClose}
              data-testid="button-cancel-runsheet"
            >
              Close
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isComplete}
              data-testid="button-apply-runsheet"
            >
              <Check className="mr-2 h-4 w-4" />
              Apply Results
            </Button>
          </div>
        </div>
        </>
        )}
      </DialogContent>
    </Dialog>
    <MobileRunsheet
      open={mobileMode}
      onClose={() => setMobileMode(false)}
      skiPairs={skiPairs}
      skiLabels={skiLabels}
      bracket={bracket}
      onBracketChange={handleMobileBracketUpdate}
      onApplyResults={(results, mobileBracket) => {
        completeBracketOnServer();
        onApplyResults(results, mobileBracket || bracket);
        setMobileMode(false);
      }}
    />
    </>
  );
}
