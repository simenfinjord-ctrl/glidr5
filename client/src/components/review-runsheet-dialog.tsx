import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type Heat = {
  pairA: number | null;
  pairB: number | null;
  distA: string;
  distB: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bracketJson: string;
  skiLabels?: Record<number, string>;
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

export function ReviewRunsheetDialog({ open, onOpenChange, bracketJson, skiLabels }: Props) {
  const label = (pair: number | null) =>
    pair !== null && skiLabels?.[pair] ? skiLabels[pair] : pair !== null ? `Par ${pair}` : "—";

  const bracket: Heat[][] = useMemo(() => {
    try {
      const parsed = JSON.parse(bracketJson);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }, [bracketJson]);

  const diffs = useMemo(() => calculateDiffs(bracket), [bracket]);

  const results = useMemo(() => {
    if (diffs.size === 0) return [];
    const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
    const list: { skiNumber: number; diff: number; rank: number }[] = [];
    let prevDiff: number | null = null;
    let currentRank = 1;
    for (let i = 0; i < sorted.length; i++) {
      const [skiNumber, diff] = sorted[i];
      if (prevDiff !== null && diff !== prevDiff) currentRank = i + 1;
      list.push({ skiNumber, diff, rank: currentRank });
      prevDiff = diff;
    }
    return list;
  }, [diffs]);

  const totalRounds = bracket.length;

  if (bracket.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-auto max-h-[90vh] overflow-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-500" />
            Review runsheet
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 overflow-x-auto py-2 min-h-[200px]">
          <div className="shrink-0">
            <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
              Results
            </h3>
            <table className="text-sm border-collapse" data-testid="table-review-runsheet-results">
              <thead>
                <tr>
                  <th className="border border-border px-3 py-1.5 text-left bg-muted/50">Ski pair</th>
                  <th className="border border-border px-3 py-1.5 text-center bg-muted/50">Rank</th>
                  <th className="border border-border px-3 py-1.5 text-center bg-muted/50">Diff</th>
                </tr>
              </thead>
              <tbody>
                {[...results].sort((a, b) => a.skiNumber - b.skiNumber).map((r) => (
                  <tr
                    key={r.skiNumber}
                    className={cn(r.rank === 1 && "bg-amber-50 dark:bg-amber-900/20")}
                    data-testid={`row-review-result-${r.skiNumber}`}
                  >
                    <td className="border border-border px-3 py-1.5 text-center font-medium">
                      {label(r.skiNumber)}
                    </td>
                    <td className="border border-border px-3 py-1.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                          r.rank === 1 && "bg-yellow-400 text-yellow-900",
                          r.rank === 2 && "bg-gray-300 text-gray-800",
                          r.rank === 3 && "bg-amber-600 text-white",
                        )}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className="border border-border px-3 py-1.5 text-center tabular-nums">
                      {r.diff}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {bracket.map((round, rIdx) => {
            const roundSpacing =
              rIdx === 0 ? "gap-3" : rIdx === 1 ? "gap-8" : rIdx === 2 ? "gap-16" : "gap-24";

            return (
              <div key={rIdx} className="shrink-0 flex flex-col">
                <h3 className="text-xs font-semibold mb-2 text-center uppercase tracking-wide text-muted-foreground">
                  {getRoundName(rIdx, totalRounds)}
                </h3>
                <div className={cn("flex flex-col justify-around flex-1", roundSpacing)}>
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
                        data-testid={`review-heat-r${rIdx}-h${hIdx}`}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2 border-b border-border",
                            winnerPair === heat.pairA && heat.pairA !== null && "bg-green-50 dark:bg-green-900/20",
                          )}
                        >
                          <span className="text-sm font-medium truncate">
                            {label(heat.pairA)}
                          </span>
                          <span className={cn(
                            "text-sm tabular-nums font-mono min-w-[3rem] text-center rounded px-1.5 py-0.5",
                            heat.distA === "0" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-bold" : "text-muted-foreground"
                          )}>
                            {heat.distA || "—"}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex items-center justify-between gap-2 px-3 py-2",
                            winnerPair === heat.pairB && heat.pairB !== null && "bg-green-50 dark:bg-green-900/20",
                          )}
                        >
                          <span className="text-sm font-medium truncate">
                            {label(heat.pairB)}
                          </span>
                          <span className={cn(
                            "text-sm tabular-nums font-mono min-w-[3rem] text-center rounded px-1.5 py-0.5",
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

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Read-only view of the completed runsheet bracket.
          </p>
          <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="button-close-review-runsheet">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
