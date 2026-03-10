import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onApplyResults: (results: BracketResult[]) => void;
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

export function RunsheetDialog({
  open,
  onOpenChange,
  skiPairs,
  onApplyResults,
}: Props) {
  const [bracket, setBracket] = useState<Heat[][]>([]);

  useEffect(() => {
    if (open && skiPairs.length >= 2) {
      setBracket(initBracket(skiPairs));
    }
  }, [open, skiPairs.join(",")]);

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
    },
    [],
  );

  const handleReset = useCallback(() => {
    if (skiPairs.length >= 2) {
      setBracket(initBracket(skiPairs));
    }
  }, [skiPairs]);

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

  const handleApply = () => {
    onApplyResults(results);
    onOpenChange(false);
  };

  if (bracket.length === 0) return null;

  const totalRounds = bracket.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-auto max-h-[90vh] overflow-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Complete Runsheet
            </DialogTitle>
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
        </DialogHeader>

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
                        {pair}
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

          {bracket.map((round, rIdx) => {
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
                            {heat.pairA !== null ? `Par ${heat.pairA}` : "—"}
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
                            disabled={heat.pairA === null || isBye}
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
                            {heat.pairB !== null ? `Par ${heat.pairB}` : "—"}
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
                            disabled={heat.pairB === null || isBye}
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
            Enter 0 for the winning pair in each heat. Winners auto-advance.
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-runsheet"
            >
              Cancel
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
      </DialogContent>
    </Dialog>
  );
}
