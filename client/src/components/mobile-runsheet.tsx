import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Trophy, X, ChevronUp, ChevronDown, Check, Undo2 } from "lucide-react";
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
  skiLabels?: Record<number, string>;
  bracket?: Heat[][];
  onBracketChange?: (bracket: Heat[][]) => void;
  onApplyResults: (results: BracketResult[], bracket?: Heat[][]) => void;
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

function findLastCompletedHeat(bracket: Heat[][]): { roundIndex: number; heatIndex: number } | null {
  let last: { roundIndex: number; heatIndex: number } | null = null;
  for (let r = 0; r < bracket.length; r++) {
    for (let h = 0; h < bracket[r].length; h++) {
      const heat = bracket[r][h];
      if (heat.pairA !== null && heat.pairB !== null && getWinner(heat)) {
        last = { roundIndex: r, heatIndex: h };
      }
    }
  }
  return last;
}

export function MobileRunsheet({ open, onClose, skiPairs, skiLabels, bracket: externalBracket, onBracketChange, onApplyResults }: Props) {
  const label = (pair: number | null) => pair !== null && skiLabels?.[pair] ? skiLabels[pair] : pair !== null ? `Par ${pair}` : "—";
  const [bracket, setBracketInternal] = useState<Heat[][]>([]);
  const [phase, setPhase] = useState<"loading" | "select" | "distance" | "done">("loading");
  const [selectedWinner, setSelectedWinner] = useState<number | null>(null);
  const [distance, setDistance] = useState(10);
  const distRef = useRef(10);

  const setBracket = useCallback((updater: Heat[][] | ((prev: Heat[][]) => Heat[][])) => {
    setBracketInternal(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (onBracketChange) onBracketChange(next);
      return next;
    });
  }, [onBracketChange]);

  useEffect(() => {
    if (open) {
      setSelectedWinner(null);
      setDistance(10);
      distRef.current = 10;

      if (externalBracket && externalBracket.length > 0) {
        setBracketInternal(externalBracket);
        const hasCurrentHeat = findCurrentHeat(externalBracket);
        const finalRound = externalBracket[externalBracket.length - 1];
        const isDone = finalRound?.length === 1 && getWinner(finalRound[0]);
        if (isDone) {
          setPhase("done");
        } else if (hasCurrentHeat) {
          setPhase("select");
        } else {
          setPhase("select");
        }
      } else if (skiPairs.length >= 2) {
        setPhase("loading");
        const timer = setTimeout(() => {
          const fresh = initBracket(skiPairs);
          setBracketInternal(fresh);
          if (onBracketChange) onBracketChange(fresh);
          setPhase("select");
        }, 50);
        return () => clearTimeout(timer);
      }
    }
  }, [open, skiPairs.join(",")]);

  const currentHeat = useMemo(() => findCurrentHeat(bracket), [bracket]);

  useEffect(() => {
    if (!currentHeat && bracket.length > 0) {
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
      const next = Math.max(5, Math.min(995, prev + delta));
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
  }, [currentHeat, selectedWinner, setBracket]);

  const handleBackFromDistance = useCallback(() => {
    if (phase === "distance") {
      setPhase("select");
      setSelectedWinner(null);
    }
  }, [phase]);

  const handleUndo = useCallback(() => {
    const last = findLastCompletedHeat(bracket);
    if (!last) return;
    setBracket(prev => {
      const nb = prev.map(round => round.map(h => ({ ...h })));
      const heat = nb[last.roundIndex][last.heatIndex];
      heat.distA = "";
      heat.distB = "";
      rebuildDownstream(nb, last.roundIndex + 1);
      return nb;
    });
    setPhase("select");
    setSelectedWinner(null);
  }, [bracket, setBracket]);

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
  const canUndo = !!findLastCompletedHeat(bracket);

  if (!open) return null;

  const loserPair = currentHeat && selectedWinner !== null
    ? (selectedWinner === currentHeat.heat.pairA ? currentHeat.heat.pairB : currentHeat.heat.pairA)
    : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col select-none" style={{ touchAction: "manipulation", height: "100dvh", maxHeight: "100dvh" }} data-testid="mobile-runsheet">
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-zinc-900">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <span className="font-bold text-lg">Runsheet</span>
        </div>
        <div className="flex items-center gap-2">
          {canUndo && phase === "select" && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-2 px-6 py-4 rounded-xl bg-zinc-800 active:bg-zinc-700 text-lg font-bold text-zinc-300"
              data-testid="button-undo-heat"
            >
              <Undo2 className="h-6 w-6" />
              Undo
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 active:bg-zinc-700"
            data-testid="button-close-mobile-runsheet"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      {phase === "loading" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-xl font-bold text-zinc-400">Setting up bracket...</span>
          <span className="text-sm text-zinc-600">{skiPairs.length} ski pairs</span>
        </div>
      )}

      {currentHeat && phase === "select" && (
        <div className="flex-1 flex flex-col">
          <div className="text-center py-3 bg-zinc-900/50">
            <span className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
              {currentHeat.roundName}
            </span>
          </div>

          <button
            onTouchEnd={(e) => { e.preventDefault(); handleSelectWinner(currentHeat.heat.pairA!); }}
            onClick={() => handleSelectWinner(currentHeat.heat.pairA!)}
            className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-900 active:bg-emerald-900/50 transition-colors border-b border-zinc-700 cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            data-testid="button-select-pair-a"
          >
            <span className="text-zinc-400 text-lg">Winner</span>
            <span className="text-7xl font-black text-amber-500">
              {label(currentHeat.heat.pairA)}
            </span>
            <ChevronUp className="h-10 w-10 text-zinc-600 mt-2" />
          </button>

          <div className="flex items-center justify-center py-3 bg-zinc-800">
            <span className="text-2xl font-bold text-zinc-500">VS</span>
          </div>

          <button
            onTouchEnd={(e) => { e.preventDefault(); handleSelectWinner(currentHeat.heat.pairB!); }}
            onClick={() => handleSelectWinner(currentHeat.heat.pairB!)}
            className="flex-1 flex flex-col items-center justify-center gap-2 bg-zinc-900 active:bg-emerald-900/50 transition-colors cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
            data-testid="button-select-pair-b"
          >
            <ChevronDown className="h-10 w-10 text-zinc-600 mb-2" />
            <span className="text-7xl font-black text-amber-500">
              {label(currentHeat.heat.pairB)}
            </span>
            <span className="text-zinc-400 text-lg">Winner</span>
          </button>
        </div>
      )}

      {phase === "distance" && selectedWinner !== null && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-none text-center py-3 bg-emerald-900/30">
            <span className="text-emerald-400 text-lg font-bold">
              {label(selectedWinner)} wins!
            </span>
            <span className="block text-zinc-400 text-sm mt-0.5">
              {label(loserPair)} behind:
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 overflow-auto py-2">
            <div className="flex items-center gap-10">
              <button
                onTouchEnd={(e) => { e.preventDefault(); handleDistanceChange(5); }}
                onClick={() => handleDistanceChange(5)}
                className="w-20 h-20 rounded-full bg-zinc-800 active:bg-zinc-700 flex flex-col items-center justify-center border-2 border-zinc-600 cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                data-testid="button-distance-up-5"
              >
                <ChevronUp className="h-8 w-8 text-zinc-300" />
                <span className="text-xs font-bold text-zinc-400">+5</span>
              </button>
              <button
                onTouchEnd={(e) => { e.preventDefault(); handleDistanceChange(10); }}
                onClick={() => handleDistanceChange(10)}
                className="w-24 h-24 rounded-full bg-zinc-700 active:bg-zinc-600 flex flex-col items-center justify-center border-2 border-amber-600 cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                data-testid="button-distance-up-10"
              >
                <ChevronUp className="h-10 w-10 text-amber-500" />
                <span className="text-sm font-bold text-amber-400">+10</span>
              </button>
            </div>

            <div className="flex items-baseline gap-2 py-1">
              <span className="text-7xl font-black text-amber-500 tabular-nums" data-testid="text-distance-value">
                {distance}
              </span>
              <span className="text-2xl text-zinc-500 font-medium">cm</span>
            </div>

            <div className="flex items-center gap-10">
              <button
                onTouchEnd={(e) => { e.preventDefault(); handleDistanceChange(-5); }}
                onClick={() => handleDistanceChange(-5)}
                className="w-20 h-20 rounded-full bg-zinc-800 active:bg-zinc-700 flex flex-col items-center justify-center border-2 border-zinc-600 cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                data-testid="button-distance-down-5"
              >
                <span className="text-xs font-bold text-zinc-400">-5</span>
                <ChevronDown className="h-8 w-8 text-zinc-300" />
              </button>
              <button
                onTouchEnd={(e) => { e.preventDefault(); handleDistanceChange(-10); }}
                onClick={() => handleDistanceChange(-10)}
                className="w-24 h-24 rounded-full bg-zinc-700 active:bg-zinc-600 flex flex-col items-center justify-center border-2 border-amber-600 cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                data-testid="button-distance-down-10"
              >
                <span className="text-sm font-bold text-amber-400">-10</span>
                <ChevronDown className="h-10 w-10 text-amber-500" />
              </button>
            </div>
          </div>

          <div className="flex-none flex gap-3 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}>
            <button
              onTouchEnd={(e) => { e.preventDefault(); handleBackFromDistance(); }}
              onClick={handleBackFromDistance}
              className="flex-1 py-5 rounded-2xl bg-zinc-800 active:bg-zinc-700 text-xl font-bold text-zinc-300 flex items-center justify-center gap-2 cursor-pointer"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              data-testid="button-distance-back"
            >
              <Undo2 className="h-6 w-6" />
              Back
            </button>
            <button
              onTouchEnd={(e) => { e.preventDefault(); handleConfirm(); }}
              onClick={handleConfirm}
              className="flex-[2] py-5 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-xl font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              data-testid="button-distance-confirm"
            >
              <Check className="h-6 w-6" />
              Confirm
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-none text-center py-4 bg-emerald-900/20">
            <Trophy className="h-10 w-10 text-amber-500 mx-auto mb-1" />
            <span className="text-xl font-bold text-emerald-400">All heats complete!</span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto px-4 py-2">
            <table className="w-full text-base" data-testid="table-mobile-results">
              <thead>
                <tr className="text-zinc-400 border-b border-zinc-700">
                  <th className="py-2 text-left font-medium">Ski pair</th>
                  <th className="py-2 text-center font-medium">Rank</th>
                  <th className="py-2 text-right font-medium">Diff (cm)</th>
                </tr>
              </thead>
              <tbody>
                {[...results].sort((a, b) => a.skiNumber - b.skiNumber).map((r) => (
                  <tr key={r.skiNumber} className="border-b border-zinc-800">
                    <td className="py-2.5 text-lg font-bold">{skiLabels?.[r.skiNumber] ?? `Par ${r.skiNumber}`}</td>
                    <td className="py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold",
                          r.rank === 1 && "bg-yellow-500 text-yellow-900",
                          r.rank === 2 && "bg-gray-400 text-gray-900",
                          r.rank === 3 && "bg-amber-700 text-white",
                          r.rank > 3 && "bg-zinc-700 text-zinc-300"
                        )}
                      >
                        {r.rank}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-lg tabular-nums text-zinc-300">{r.diff}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex-none flex gap-3 p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}>
            <button
              onTouchEnd={(e) => { e.preventDefault(); handleUndo(); }}
              onClick={handleUndo}
              className="flex-1 py-4 rounded-2xl bg-zinc-800 active:bg-zinc-700 text-lg font-bold text-zinc-300 flex items-center justify-center gap-2 cursor-pointer"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              data-testid="button-undo-from-done"
            >
              <Undo2 className="h-5 w-5" />
              Undo
            </button>
            <button
              onTouchEnd={(e) => { e.preventDefault(); if (isComplete) onApplyResults(results, bracket); onClose(); }}
              onClick={() => {
                if (isComplete) onApplyResults(results, bracket);
                onClose();
              }}
              className="flex-[2] py-4 rounded-2xl bg-emerald-600 active:bg-emerald-700 text-lg font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
              style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
              data-testid="button-apply-mobile-results"
            >
              <Check className="h-5 w-5" />
              {isComplete ? "Apply Results" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
