import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProductCombobox } from "@/components/product-combobox";
import { PlusCircle, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type TestType = "Glide" | "Structure" | "Grind" | "Classic" | "Skating";

type Product = {
  id: number;
  category: string;
  brand: string;
  name: string;
};

export type RoundResult = {
  result: number | null;
  rank: number | null;
};

export type EntryRow = {
  id: string;
  skiNumber: number;
  productId?: number;
  additionalProductIds?: string;
  methodology: string;
  roundResults: RoundResult[];
  feelingRank: number | null;
  kickRank: number | null;
  grindType?: string;
  grindStone?: string;
  grindPattern?: string;
  raceSkiId?: number;
};

function competitionRanks(values: Array<{ rowId: string; v: number }>) {
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const ranks = new Map<string, number>();
  let prev: number | null = null;
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (prev !== null && item.v !== prev) {
      currentRank = i + 1;
    }
    ranks.set(item.rowId, currentRank);
    prev = item.v;
  }

  return ranks;
}

function parseAdditionalIds(ids?: string): number[] {
  if (!ids) return [];
  return ids.split(",").map(Number).filter((n) => !isNaN(n));
}

function serializeAdditionalIds(ids: number[]): string | undefined {
  if (!ids.length) return undefined;
  return ids.join(",");
}

export function cleanAdditionalIds(ids?: string): string | undefined {
  if (!ids) return undefined;
  const cleaned = ids.split(",").map(Number).filter((n) => !isNaN(n) && n > 0);
  return cleaned.length ? cleaned.join(",") : undefined;
}

export type RaceSkiOption = {
  id: number;
  skiId: string;
  brand: string | null;
  discipline: string;
  athleteName: string;
  grind: string | null;
};

export function TestEntryTable({
  testType,
  products,
  rows,
  setRows,
  distanceLabels,
  onDistanceLabelsChange,
  testSkiSource = "series",
  raceSkis = [],
}: {
  testType: TestType;
  products: Product[];
  rows: EntryRow[];
  setRows: (next: EntryRow[]) => void;
  distanceLabels: string[];
  onDistanceLabelsChange: (labels: string[]) => void;
  testSkiSource?: "series" | "raceskis";
  raceSkis?: RaceSkiOption[];
}) {
  const roundRanks = useMemo(() => {
    return distanceLabels.map((_, roundIdx) => {
      const vals = rows
        .filter((r) => r.roundResults[roundIdx]?.result != null)
        .map((r) => ({ rowId: r.id, v: r.roundResults[roundIdx]!.result as number }));
      return competitionRanks(vals);
    });
  }, [rows, distanceLabels.length]);

  useEffect(() => {
    let changed = false;
    const next = rows.map((r) => {
      const newRoundResults = r.roundResults.map((rr, roundIdx) => {
        const newRank = rr.result === null ? null : (roundRanks[roundIdx]?.get(r.id) ?? null);
        if (newRank !== rr.rank) changed = true;
        return { ...rr, rank: newRank };
      });
      return { ...r, roundResults: newRoundResults };
    });
    if (changed) setRows(next);
  }, [roundRanks]);

  const addRound = () => {
    onDistanceLabelsChange([...distanceLabels, ""]);
    setRows(rows.map((r) => ({
      ...r,
      roundResults: [...r.roundResults, { result: null, rank: null }],
    })));
  };

  const removeRound = (roundIdx: number) => {
    if (distanceLabels.length <= 1) return;
    onDistanceLabelsChange(distanceLabels.filter((_, i) => i !== roundIdx));
    setRows(rows.map((r) => ({
      ...r,
      roundResults: r.roundResults.filter((_, i) => i !== roundIdx),
    })));
  };

  const isGrind = testType === "Grind";
  const isClassic = testType === "Classic";
  const isRaceSki = testSkiSource === "raceskis";

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card/50">
      <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${(isGrind ? 700 : 560) + distanceLabels.length * 200 + (isClassic ? 80 : 0)}px` }}>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card/80 px-3 py-3">Ski No.</th>
            {!isGrind && <th className="px-3 py-3">{isRaceSki ? "Raceski" : "Product(s)"}</th>}
            {!isGrind && <th className="px-3 py-3">Method</th>}
            {isGrind && <th className="px-3 py-3">Grind Type</th>}
            {isGrind && <th className="px-3 py-3">Stone / Tool</th>}
            {isGrind && <th className="px-3 py-3">Pattern</th>}
            {distanceLabels.map((label, roundIdx) => (
              <th key={roundIdx} className="px-3 py-3" colSpan={2}>
                <div className="flex items-center gap-1">
                  <Input
                    value={label}
                    onChange={(e) => {
                      const next = [...distanceLabels];
                      next[roundIdx] = e.target.value;
                      onDistanceLabelsChange(next);
                    }}
                    className="h-7 w-24 text-xs bg-background/70"
                    placeholder={`Round ${roundIdx + 1}`}
                    data-testid={`input-distance-label-${roundIdx}`}
                  />
                  {distanceLabels.length > 1 && (
                    <button
                      type="button"
                      className="text-red-400 hover:text-red-300 transition-colors"
                      onClick={() => removeRound(roundIdx)}
                      data-testid={`button-remove-round-${roundIdx}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="px-3 py-3">Feeling</th>
            {isClassic && <th className="px-3 py-3">Kick</th>}
            <th className="px-1 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                onClick={addRound}
                data-testid="button-add-round"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Round
              </Button>
            </th>
          </tr>
          <tr className="text-left text-[10px] text-muted-foreground/70 uppercase tracking-wider">
            <th className="sticky left-0 z-10 bg-card/80"></th>
            {!isGrind && <th></th>}
            {!isGrind && <th></th>}
            {isGrind && <th></th>}
            {isGrind && <th></th>}
            {isGrind && <th></th>}
            {distanceLabels.map((_, roundIdx) => (
              <>
                <th key={`res-${roundIdx}`} className="px-3 pb-1">Result (cm)</th>
                <th key={`rank-${roundIdx}`} className="px-3 pb-1">Rank</th>
              </>
            ))}
            <th></th>
            {isClassic && <th></th>}
            <th></th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {rows.map((row, idx) => {
            const additionalIds = parseAdditionalIds(row.additionalProductIds);

            const rankBadge = (rank: number | null) => (
              <div
                className={cn(
                  "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                  rank === 1
                    ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                    : rank === 2
                      ? "bg-slate-300/15 text-slate-500 dark:text-slate-300"
                      : rank === 3
                        ? "bg-amber-700/15 text-amber-700 dark:text-amber-600"
                        : "bg-muted/70 text-foreground",
                )}
              >
                {rank ?? "—"}
              </div>
            );

            return (
              <tr
                key={row.id}
                className={cn(
                  "border-t",
                  idx % 2 === 0 ? "bg-background/30" : "bg-background/10",
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                  <div
                    className="inline-flex h-9 w-14 items-center justify-center rounded-xl border bg-background/70 text-sm font-semibold"
                    data-testid={`text-ski-number-${row.id}`}
                  >
                    {row.skiNumber}
                  </div>
                </td>
                {!isGrind && (
                <td className="px-3 py-2">
                  {isRaceSki ? (
                    <select
                      value={row.raceSkiId || ""}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        const next = rows.map((r) => (r.id === row.id ? { ...r, raceSkiId: val } : r));
                        setRows(next);
                      }}
                      className="h-9 w-full min-w-[180px] rounded-md border bg-background/70 px-2 text-sm"
                      data-testid={`select-raceski-${row.id}`}
                    >
                      <option value="">Select race ski...</option>
                      {raceSkis.map((ski) => (
                        <option key={ski.id} value={ski.id}>
                          {ski.athleteName} — {ski.brand ? `${ski.brand} ` : ""}{ski.skiId} ({ski.discipline}{ski.grind ? `, ${ski.grind}` : ""})
                        </option>
                      ))}
                    </select>
                  ) : (
                  <div className="flex items-center gap-1">
                    <ProductCombobox
                      testType={testType as "Glide" | "Structure" | "Classic" | "Skating"}
                      products={products}
                      value={row.productId}
                      onChange={(id) => {
                        const next = rows.map((r) => (r.id === row.id ? { ...r, productId: id } : r));
                        setRows(next);
                      }}
                      testId={`input-product-${row.id}`}
                    />
                    {additionalIds.map((addId, addIdx) => (
                      <div key={addIdx} className="flex items-center gap-0.5">
                        <span className="text-xs font-bold text-muted-foreground">+</span>
                        <ProductCombobox
                          testType={testType as "Glide" | "Structure" | "Classic" | "Skating"}
                          products={products}
                          value={addId || undefined}
                          onChange={(newId) => {
                            const updated = [...additionalIds];
                            if (newId) {
                              updated[addIdx] = newId;
                            } else {
                              updated.splice(addIdx, 1);
                            }
                            const next = rows.map((r) =>
                              r.id === row.id ? { ...r, additionalProductIds: serializeAdditionalIds(updated) } : r
                            );
                            setRows(next);
                          }}
                          testId={`input-product-add-${row.id}-${addIdx}`}
                        />
                        <button
                          type="button"
                          className="flex-shrink-0 text-red-400 hover:text-red-300 transition-colors"
                          onClick={() => {
                            const updated = additionalIds.filter((_, i) => i !== addIdx);
                            const next = rows.map((r) =>
                              r.id === row.id ? { ...r, additionalProductIds: serializeAdditionalIds(updated) } : r
                            );
                            setRows(next);
                          }}
                          data-testid={`button-remove-product-${row.id}-${addIdx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-md text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                      onClick={() => {
                        const updated = [...additionalIds, 0];
                        const next = rows.map((r) =>
                          r.id === row.id ? { ...r, additionalProductIds: serializeAdditionalIds(updated) } : r
                        );
                        setRows(next);
                      }}
                      data-testid={`button-add-product-${row.id}`}
                      title="Add product"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  )}
                </td>
                )}
                {!isGrind && (
                <td className="px-3 py-2">
                  <Input
                    value={row.methodology}
                    onChange={(e) => {
                      const next = rows.map((r) => (r.id === row.id ? { ...r, methodology: e.target.value } : r));
                      setRows(next);
                    }}
                    className="h-9 bg-background/70"
                    placeholder="e.g., 200°C"
                    data-testid={`input-method-${row.id}`}
                  />
                </td>
                )}
                {isGrind && (
                <>
                  <td className="px-3 py-2">
                    <select
                      value={row.grindType || ""}
                      onChange={(e) => {
                        const next = rows.map((r) => (r.id === row.id ? { ...r, grindType: e.target.value || undefined } : r));
                        setRows(next);
                      }}
                      className="h-9 w-full rounded-md border bg-background/70 px-2 text-sm"
                      data-testid={`select-grind-type-${row.id}`}
                    >
                      <option value="">—</option>
                      {["New grind", "Regrind", "Hand finish", "Stone grind", "Linear", "Cross-hatch", "Custom"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.grindStone || ""}
                      onChange={(e) => {
                        const next = rows.map((r) => (r.id === row.id ? { ...r, grindStone: e.target.value || undefined } : r));
                        setRows(next);
                      }}
                      className="h-9 bg-background/70"
                      placeholder="e.g., SG12"
                      data-testid={`input-grind-stone-${row.id}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.grindPattern || ""}
                      onChange={(e) => {
                        const next = rows.map((r) => (r.id === row.id ? { ...r, grindPattern: e.target.value || undefined } : r));
                        setRows(next);
                      }}
                      className="h-9 bg-background/70"
                      placeholder="e.g., 0.5mm"
                      data-testid={`input-grind-pattern-${row.id}`}
                    />
                  </td>
                </>
                )}
                {row.roundResults.map((rr, roundIdx) => (
                  <>
                    <td key={`res-${roundIdx}`} className="px-3 py-2">
                      <Input
                        inputMode="decimal"
                        type="number"
                        value={rr.result ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = v === "" ? null : Number(v);
                          const next = rows.map((r) => {
                            if (r.id !== row.id) return r;
                            const newRounds = [...r.roundResults];
                            newRounds[roundIdx] = { ...newRounds[roundIdx], result: Number.isNaN(num) ? null : num };
                            return { ...r, roundResults: newRounds };
                          });
                          setRows(next);
                        }}
                        className="h-9 w-20 bg-background/70"
                        placeholder="0"
                        data-testid={`input-result-${roundIdx}-${row.id}`}
                      />
                    </td>
                    <td key={`rank-${roundIdx}`} className="px-3 py-2">{rankBadge(rr.rank)}</td>
                  </>
                ))}
                <td className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    type="number"
                    min={1}
                    value={row.feelingRank ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? null : Number(v);
                      const next = rows.map((r) => (r.id === row.id ? { ...r, feelingRank: Number.isNaN(num) ? null : num } : r));
                      setRows(next);
                    }}
                    className="h-9 w-16 bg-background/70"
                    placeholder="—"
                    data-testid={`input-feeling-${row.id}`}
                  />
                </td>
                {isClassic && (
                <td className="px-3 py-2">
                  <Input
                    inputMode="numeric"
                    type="number"
                    min={1}
                    value={row.kickRank ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? null : Number(v);
                      const next = rows.map((r) => (r.id === row.id ? { ...r, kickRank: Number.isNaN(num) ? null : num } : r));
                      setRows(next);
                    }}
                    className="h-9 w-16 bg-background/70"
                    placeholder="—"
                    data-testid={`input-kick-${row.id}`}
                  />
                </td>
                )}
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
