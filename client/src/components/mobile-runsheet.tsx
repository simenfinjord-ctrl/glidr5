import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Trophy, X, ChevronUp, ChevronDown, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Heat = {
  pairA: number | null;
  pairB: number | null;
  distA: string;
  distB: string;
};

type BracketResult = {
  skiNumber: number;
  diff: number;
  rank: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
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
      if (nextSlot === "A") bracket[r + 1][nextHeat].pairA = winner;
      else bracket[r + 1][nextHeat].pairB = winner;
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

function findCurrentHeat(bracket: Heat[][]): { roundIndex: number; heatIndex: number; heat: Heat; roundName: string } | null {
  for (let r = 0; r < bracket.length; r++) {
    for (let h = 0; h < bracket[r].length; h++) {
      const heat = bracket[r][h];
      if (heat.pairA !== null && heat.pairB !== null && !getWinner(heat)) {
        return { roundIndex: r, heatIndex: h, heat, roundName: getRoundName(r, bracket.length) };
      }
    }
  }
  return null;
}

export function MobileRunsheet({ open, onClose, skiPairs, onApplyResults }: Props) {
  const [bracket, setBracket] = useState<Heat[][]>([]);
  const [phase, setPhase] = useState<"select" | "distance" | "done" | "results">("select");
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [distance, setDistance] = useState(10);
  const distRef = useRef(10);

  useEffect(() => {
    if (open && skiPairs.length >= 2) {
      setBracket(initBracket(skiPairs));
      setPhase("select");
      setSelectedWinner(null);
      setDistance(10);
      distRef.current = 10;
    }
  }, [open, skiPairs.join(",")]);

  const currentHeat = useMemo(() => findCurrentHeat(bracket), [bracket]);

  useEffect(() => {
    if (!currentHeat && bracket.length > 0) {
      const diffs = calculateDiffs(bracket);
      const finalRound = bracket[bracket.length - 1];
      if (finalRound?.length === 1 && getWinner(finalRound[0])) {
        setPhase("done");
      }
    }
  }, [currentHeat, bracket]);

  const handleSelectWinner = useCallback((pair: number) => {
    setSelectedWinner(pair);
    setDistance(10);
    distRef.current = 10;
    setPhase("distance");
  }, []);

  const handleDistanceChange = useCallback((delta: number) => {
    setDistance(prev => {
      const next = Math.max(10, Math.min(990, prev + delta));
      distRef.current = next;
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!currentHeat || selectedWinner === null) return;
    setBracket(prev => {
      const nb = prev.map(round => round.map(h => ({ ...h })));
      const heat = nb[currentHeat.roundIndex][currentHeat.heatIndex];
      if (heat.pairA === selectedWinner) {
        heat.distA = "0";
        heat.distB = String(distRef.current);
      } else {
        heat.distB = "0";
        heat.distA = String(distRef.current);
      }
      rebuildDownstream(nb, currentHeat.roundIndex + 1);
      return nb;
    });
    setPhase("select");
    setSelectedWinner(null);
  }, [currentHeat, selectedWinner]);

  const handleBack = useCallback(() => {
    if (phase === "distance") {
      setPhase("select");
      setSelectedWinner(null);
    }
  }, [phase]);

  const diffs = useMemo(() => calculateDiffs(bracket), [bracket]);

  const results = useMemo((): BracketResult[] => {
    if (diffs.size === 0) return [];
    const sorted = [...diffs.entries()].sort((a, b) => a[1] - b[1]);
    const list: BracketResult[] = [];
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

  const hasChampion = useMemo(() => {
    if (bracket.length === 0) return false;
    const finalRound = bracket[bracket.length - 1];
    if (finalRound.length !== 1) return false;
    return getWinner(finalRound[0]) !== null;
  }, [bracket]);

  const isComplete = results.length === skiPairs.length && hasChampion;

  if (!open) return null;

  const loserPair = currentHeat && selectedWinner !== null
    ? (selectedWinner === currentHeat.heat.pairA ? currentHeat.heat.pairB : currentHeat.heat.pairA)
    : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none" style={{ touchAction: "manipulation" }} data-testid="mobile-runsheet">
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <span className="font-bold text-lg">Runsheet</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-zinc-800 active:bg-zinc-700"
          data-testid="button-close-mobile-runsheet"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {currentHeat && phase === "select" && (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-3 bg-zinc-900/50">
            <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {currentHeat.roundName}
            </span>
          </div>

          <button
            onClick={() => handleSelectWinner(currentHeat.heat.pairA!)}
            className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-900 active:bg-emerald-900/50 transition-colors border-b border-zinc-700"
            data-testid="button-select-pair-a"
          >
            <span className="text-zinc-400 text-lg">Winner</span>
            <span className="text-7xl font-black text-amber-500">
              Par {currentHeat.heat.pairA}
            </span>
            <ChevronUp className="h-10 w-10 text-zinc-600 mt-2" />
          </button>

          <div className="flex items-center justify-center py-3 bg-zinc-800">
            <span className="text-2xl font-bold text-zinc-500">VS</span>
          </div>

          <button
            onClick={() => handleSelectWinner(currentHeat.heat.pairB!)}
            className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-900 active:bg-emerald-900/50 transition-colors"
            data-testid="button-select-pair-b"
          >
            <ChevronDown className="h-10 w-10 text-zinc-600 mb-2" />
            <span className="text-7xl font-black text-amber-500">
              Par {currentHeat.heat.pairB}
            </span>
            <span className="text-zinc-400 text-lg">Winner</span>
          </button>
        </div>
      )}

      {phase === "distance" && selectedWinner !== null && (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-4 bg-emerald-900/30">
            <span className="text-emerald-400 text-xl font-bold">
              Par {selectedWinner} wins!
            </span>
          </div>

          <div className="text-center py-3">
            <span className="text-zinc-400 text-lg">
              Par {loserPair} behind:
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <button
              onClick={() => handleDistanceChange(10)}
              className="w-32 h-32 rounded-full bg-zinc-800 active:bg-zinc-700 flex items-center justify-center border-2 border-zinc-600"
              data-testid="button-distance-up"
            >
              <ChevronUp className="h-16 w-16 text-white" />
            </button>

            <div className="flex items-baseline gap-2">
              <span className="text-8xl font-black text-amber-500 tabular-nums" data-testid="text-distance-value">
                {distance}
              </span>
              <span className="text-3xl text-zinc-500 font-medium">cm</span>
            </div>

            <button
              onClick={() => handleDistanceChange(-10)}
              className="w-32 h-32 rounded-full bg-zinc-800 active:bg-zinc-700 flex items-center justify-center border-2 border-zinc-600"
              data-testid="button-distance-down"
            >
              <ChevronDown className="h-16 w-16 text-white" />
            </button>
          </div>

          <div className="flex gap-3 p-4 pb-8">
            <button
              onClick={handleBack}
              className="flex-1 py-5 rounded-2xl bg-zinc-800 active:bg-zinc-700 text-xl font-bold text-zinc-300 flex items-center justify-center gap-2"
              data-testid="button-distance-back"
            >
              <RotateCcw className="h-6 w-6" />
              Back
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] py-5 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-xl font-bold text-white flex items-center justify-center gap-2"
              data-testid="button-distance-confirm"
            >
              <Check className="h-6 w-6" />
              Confirm
            </button>
          </div>
        </div>
      )}

      {(phase === "done" || phase === "results") && (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-6 bg-emerald-900/20">
            <Trophy className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <span className="text-2xl font-bold text-emerald-400">All heats complete!</span>
          </div>

          <div className="flex-1 overflow-auto px-4 py-4">
            <table className="w-full text-lg" data-testid="table-mobile-results">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-700">
                  <th className="py-3 text-left font-medium">Rank</th>
                  <th className="py-3 text-left font-medium">Ski pair</th>
                  <th className="py-3 text-right font-medium">Diff (cm)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.skiNumber} className="border-b border-zinc-800">
                    <td className="py-4">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-bold",
                          r.rank === 1 && "bg-yellow-500 text-yellow-900",
                          r.rank === 2 && "bg-gray-400 text-gray-900",
                          r.rank === 3 && "bg-amber-700 text-white",
                          r.rank > 3 && "bg-zinc-700 text-zinc-300"
                        )}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className="py-4 text-xl font-bold">Par {r.skiNumber}</td>
                    <td className="py-4 text-right text-xl tabular-nums text-zinc-300">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 pb-8">
            <button
              onClick={() => {
                if (isComplete) onApplyResults(results);
                onClose();
              }}
              className="w-full py-5 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-xl font-bold text-white flex items-center justify-center gap-2"
              data-testid="button-apply-mobile-results"
            >
              <Check className="h-6 w-6" />
              {isComplete ? "Apply Results" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
