// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { Fragment, useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ProductCombobox } from "@/components/product-combobox";
import { RaceSkiCombobox } from "@/components/raceski-combobox";
import { X, Plus, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

type TestType = "Glide" | "Structure" | "Grind" | "Classic" | "Skating" | "Double Poling";

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
  freeTextProduct?: string | null;
  additionalProductIds?: string;
  methodology: string; // kept for backward compat, stores pipe-separated applications
  applications?: string[]; // [primaryApp, add0App, add1App, ...]
  roundResults: RoundResult[];
  feelingRank: number | null;
  feelingNote?: string | null;
  kickRank: number | null;
  kickSolution?: string | null;
  grindType?: string;
  grindStone?: string;
  grindPattern?: string;
  grindExtraParams?: Record<string, string>;
  grindProfileId?: number;
  raceSkiId?: number;
};

export type GrindProfile = {
  id: number;
  name: string;
  grindType: string;
  stone: string;
  pattern: string;
  extraParams: string | null;
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
  serialNumber: string | null;
  brand: string | null;
  discipline: string;
  athleteName: string;
  grind: string | null;
};

function parseExtraParams(json: string | null): Record<string, string> {
  if (!json) return {};
  try { return JSON.parse(json); } catch { return {}; }
}

export function TestEntryTable({
  testType,
  products,
  rows,
  setRows,
  distanceLabels,
  onDistanceLabelsChange,
  testSkiSource = "series",
  raceSkis = [],
  skiLabels,
  grindProfiles = [],
  visibleGrindCols = [],
}: {
  testType: TestType;
  products: Product[];
  rows: EntryRow[];
  setRows: (next: EntryRow[]) => void;
  distanceLabels: string[];
  onDistanceLabelsChange: (labels: string[]) => void;
  testSkiSource?: "series" | "raceskis";
  raceSkis?: RaceSkiOption[];
  skiLabels?: Record<number, string>;
  grindProfiles?: GrindProfile[];
  visibleGrindCols?: string[];
}) {
  const { t, language } = useI18n();
  const feelingNotePlaceholder = language === "no" ? "Notat…" : "Note…";

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

  // Kick solution (#35) — optional free-text per pair on classic tests.
  const [showKickSolution, setShowKickSolution] = useState(false);
  const [kickSame, setKickSame] = useState(false);
  useEffect(() => { if (rows.some((r) => r.kickSolution)) setShowKickSolution(true); }, [rows]);
  const setKickSolution = (rowId: string, v: string) => {
    setRows(rows.map((r, i) => {
      if (kickSame) return { ...r, kickSolution: v || null }; // applies to all pairs
      return r.id === rowId ? { ...r, kickSolution: v || null } : r;
    }));
  };

  // Grind param columns: stone/pattern/ra_value (fixed labels) + custom keys
  const GRIND_PARAM_LABELS: Record<string, string> = { stone: "Stone / Tool", pattern: "Pattern", ra_value: "RA-value" };
  // Compute all extra param columns that are visible (beyond profile selector)
  const extraGrindCols = visibleGrindCols.filter((k) => !["profile"].includes(k));

  return (
    <div className="space-y-2">
    <style>{`
@media (max-width: 767px) {
  .eg-stack { overflow-x: visible !important; border: none; background: transparent; border-radius: 0; }
  .eg-stack table { min-width: 0 !important; display: block; }
  .eg-stack thead { display: none; }
  .eg-stack tbody { display: block; }
  .eg-stack tbody tr { display: block; border: 1px solid hsl(var(--border)); border-radius: 12px; padding: 6px 12px 10px; margin-bottom: 12px; background: hsl(var(--card)); }
  .eg-stack tbody td { display: flex; align-items: center; justify-content: space-between; gap: 10px; position: static !important; padding: 6px 0; width: auto !important; }
  .eg-stack tbody td[data-label]::before { content: attr(data-label); font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; color: hsl(var(--muted-foreground)); flex-shrink: 0; }
  .eg-stack tbody td input, .eg-stack tbody td select { width: auto !important; min-width: 0; flex: 1; max-width: 64%; }
  .eg-stack tbody td:not([data-label]):empty { display: none; }
}
`}</style>
    {isClassic && (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowKickSolution((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 transition-colors",
            showKickSolution ? "bg-primary/10 text-primary ring-primary/30" : "ring-border text-muted-foreground hover:bg-muted/60",
          )}
          data-testid="toggle-kick-solution"
        >
          {language === "no" ? "Kick solution" : "Kick solution"}
        </button>
        {showKickSolution && (
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={kickSame}
              onChange={(e) => {
                const on = e.target.checked;
                setKickSame(on);
                if (on && rows.length > 0) {
                  const first = rows[0].kickSolution || null;
                  setRows(rows.map((r) => ({ ...r, kickSolution: first })));
                }
              }}
              data-testid="checkbox-kick-same"
            />
            {language === "no" ? "Samme for alle par" : "Same for every pair"}
          </label>
        )}
      </div>
    )}
    <div className="eg-stack overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${(isGrind ? 300 + extraGrindCols.length * 120 : 560) + distanceLabels.length * 200 + (isClassic ? 80 : 0)}px` }}>
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Ski</th>
            {!isGrind && <th className="px-3 py-2.5 font-medium">{isRaceSki ? "Raceski" : (language === "no" ? "Produkt og applikasjon" : "Product & application")}</th>}
            {isGrind && <th className="px-3 py-2.5 font-medium">{language === "no" ? "Slip" : "Grind profile"}</th>}
            {isGrind && extraGrindCols.map((col) => (
              <th key={col} className="px-3 py-2.5 font-medium">{GRIND_PARAM_LABELS[col] ?? col}</th>
            ))}
            {distanceLabels.map((label, roundIdx) => (
              <Fragment key={roundIdx}>
                <th className="px-3 py-1.5 font-medium">
                  <div className="flex items-center gap-1">
                    {/* Label reads as text until you hover/focus — click to rename the distance. */}
                    <Input
                      value={label}
                      onChange={(e) => {
                        const next = [...distanceLabels];
                        next[roundIdx] = e.target.value;
                        onDistanceLabelsChange(next);
                      }}
                      className="h-6 w-20 rounded-md border-transparent bg-transparent px-1 text-[10px] font-medium uppercase tracking-wider shadow-none hover:border-border focus:border-border focus:bg-background"
                      placeholder={t("tests.roundLabel", { n: roundIdx + 1 })}
                      data-testid={`input-distance-label-${roundIdx}`}
                    />
                    <span className="normal-case text-muted-foreground/60">(cm)</span>
                    {distanceLabels.length > 1 && (
                      <button
                        type="button"
                        className="text-red-400 hover:text-red-500 transition-colors"
                        onClick={() => removeRound(roundIdx)}
                        data-testid={`button-remove-round-${roundIdx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
                <th className="px-2 py-2.5 text-center font-medium">Rank</th>
              </Fragment>
            ))}
            <th className="px-3 py-2.5 font-medium">{language === "no" ? "Følelse + notat" : "Feeling + note"}</th>
            {isClassic && <th className="px-3 py-2.5 font-medium">Kick</th>}
            <th className="px-1 py-1.5 text-right">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs normal-case tracking-normal text-primary hover:text-primary hover:bg-primary/10"
                onClick={addRound}
                data-testid="button-add-round"
              >
                <Plus className="h-3 w-3 mr-1" />
                {language === "no" ? "Runde" : "Round"}
              </Button>
            </th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {rows.map((row, idx) => {
            const additionalIds = parseAdditionalIds(row.additionalProductIds);

            const rankBadge = (rank: number | null) => (
              <div
                className={cn(
                  "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  rank === 1
                    ? "bg-yellow-500/90 text-white shadow-sm"
                    : rank === 2
                      ? "border border-border bg-muted/60 text-foreground/80"
                      : rank === 3
                        ? "bg-amber-600/15 text-amber-700 dark:text-amber-500"
                        : rank != null
                          ? "bg-muted/60 text-muted-foreground"
                          : "text-muted-foreground/40",
                )}
              >
                {rank ?? "–"}
              </div>
            );

            // Winner row gets a subtle tint, matching the day view.
            const topRank = row.roundResults[0]?.rank ?? null;

            return (
              <tr
                key={row.id}
                className={cn(
                  "border-t transition-colors",
                  topRank === 1 ? "bg-emerald-500/[0.06]" : "bg-card hover:bg-muted/20",
                )}
              >
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        disabled={idx === 0}
                        className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted disabled:opacity-15 disabled:hover:bg-transparent transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const next = [...rows];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          const renumbered = next.map((r, i) => ({ ...r, skiNumber: i + 1 }));
                          setRows(renumbered);
                        }}
                        data-testid={`button-move-up-${row.id}`}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === rows.length - 1}
                        className="flex h-4 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-muted disabled:opacity-15 disabled:hover:bg-transparent transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const next = [...rows];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          const renumbered = next.map((r, i) => ({ ...r, skiNumber: i + 1 }));
                          setRows(renumbered);
                        }}
                        data-testid={`button-move-down-${row.id}`}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div
                      className={cn(
                        "inline-flex h-8 items-center justify-center rounded-lg border bg-muted/40 text-xs font-semibold px-2",
                        isRaceSki ? "min-w-12" : "w-10",
                      )}
                      data-testid={`text-ski-number-${row.id}`}
                    >
                      {/* Race-ski tests show the selected ski's Ski ID, not 1..n (#52). */}
                      {isRaceSki
                        ? (raceSkis.find((rs) => rs.id === row.raceSkiId)?.skiId ?? row.freeTextProduct ?? "—")
                        : (skiLabels?.[row.skiNumber] ?? row.skiNumber)}
                    </div>
                  </div>
                </td>
                {!isGrind && (
                <td className="px-3 py-2" data-label={isRaceSki ? "Raceski" : (language === "no" ? "Produkt" : "Product")}>
                  {isRaceSki ? (
                    <div className="flex flex-col gap-1 min-w-[180px]">
                      <RaceSkiCombobox
                        raceSkis={raceSkis}
                        value={row.freeTextProduct ? undefined : row.raceSkiId}
                        onChange={(val) => {
                          // Picking a garage ski clears any free-text ski.
                          const next = rows.map((r) => (r.id === row.id ? { ...r, raceSkiId: val, freeTextProduct: null } : r));
                          setRows(next);
                        }}
                        testId={`select-raceski-${row.id}`}
                      />
                      {/* Free text only while no garage ski is picked — quiet ghost field. */}
                      {(!row.raceSkiId || row.freeTextProduct) && (
                        <Input
                          value={row.freeTextProduct ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            // Free-text ski (e.g. borrowed) — not in the garage, excluded from analytics.
                            const next = rows.map((r) => (r.id === row.id ? { ...r, freeTextProduct: v || null, raceSkiId: v ? undefined : r.raceSkiId } : r));
                            setRows(next);
                          }}
                          className="h-6 rounded-md border-transparent bg-transparent px-1 text-[11px] shadow-none placeholder:text-muted-foreground/50 hover:border-border focus:border-border focus:bg-background"
                          placeholder={language === "no" ? "…eller fritekst (lånt ski – ikke i analyse)" : "…or free text (borrowed ski – excluded from analytics)"}
                          data-testid={`input-freetext-ski-${row.id}`}
                        />
                      )}
                    </div>
                  ) : (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    {/* Primary product block */}
                    <div className="flex flex-col gap-0.5 min-w-[150px]">
                      <ProductCombobox
                        testType={testType as "Glide" | "Structure" | "Classic" | "Skating" | "Double Poling"}
                        products={products}
                        value={row.freeTextProduct ? undefined : row.productId}
                        onChange={(id) => {
                          const next = rows.map((r) => (r.id === row.id ? { ...r, productId: id, freeTextProduct: null } : r));
                          setRows(next);
                        }}
                        testId={`input-product-${row.id}`}
                      />
                      {/* Free text only while no product is picked — quiet ghost field. */}
                      {(!row.productId || row.freeTextProduct) && (
                        <Input
                          value={row.freeTextProduct ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            // Free-text product (e.g. borrowed) — excluded from analytics.
                            const next = rows.map((r) => (r.id === row.id ? { ...r, freeTextProduct: v || null, productId: v ? undefined : r.productId } : r));
                            setRows(next);
                          }}
                          className="h-6 rounded-md border-transparent bg-transparent px-1 text-[11px] shadow-none placeholder:text-muted-foreground/50 hover:border-border focus:border-border focus:bg-background"
                          placeholder={language === "no" ? "…eller fritekst (lånt – ikke i analyse)" : "…or free text (borrowed – excluded)"}
                          data-testid={`input-freetext-product-${row.id}`}
                        />
                      )}
                      <Input
                        value={row.applications?.[0] ?? ""}
                        onChange={(e) => {
                          const apps = [...(row.applications ?? [])];
                          apps[0] = e.target.value;
                          const next = rows.map((r) =>
                            r.id === row.id
                              ? { ...r, applications: apps, methodology: apps.join('|') }
                              : r
                          );
                          setRows(next);
                        }}
                        className="h-6 rounded-md border-transparent bg-transparent px-1 text-[11px] shadow-none placeholder:text-muted-foreground/50 hover:border-border focus:border-border focus:bg-background"
                        placeholder={t("tests.appInputPlaceholder")}
                        data-testid={`input-application-0-${row.id}`}
                      />
                    </div>
                    {/* Additional product blocks */}
                    {additionalIds.map((addId, addIdx) => (
                      <div key={addIdx} className="flex items-start gap-1">
                        <span className="mt-2 text-xs font-bold text-muted-foreground">+</span>
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center gap-0.5">
                            <ProductCombobox
                              testType={testType as "Glide" | "Structure" | "Classic" | "Skating" | "Double Poling"}
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
                          <Input
                            value={row.applications?.[addIdx + 1] ?? ""}
                            onChange={(e) => {
                              const apps = [...(row.applications ?? [])];
                              apps[addIdx + 1] = e.target.value;
                              const next = rows.map((r) =>
                                r.id === row.id
                                  ? { ...r, applications: apps, methodology: apps.join('|') }
                                  : r
                              );
                              setRows(next);
                            }}
                            className="h-6 rounded-md border-transparent bg-transparent px-1 text-[11px] shadow-none placeholder:text-muted-foreground/50 hover:border-border focus:border-border focus:bg-background"
                            placeholder={t("tests.appInputPlaceholder")}
                            data-testid={`input-application-${addIdx + 1}-${row.id}`}
                          />
                        </div>
                      </div>
                    ))}
                    {/* Add product — quiet text link, per the approved mockup */}
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                      onClick={() => {
                        const updated = [...additionalIds, 0];
                        const next = rows.map((r) =>
                          r.id === row.id ? { ...r, additionalProductIds: serializeAdditionalIds(updated) } : r
                        );
                        setRows(next);
                      }}
                      data-testid={`button-add-product-${row.id}`}
                      title={language === "no" ? "Legg til produkt" : "Add product"}
                    >
                      <Plus className="h-3 w-3" />
                      {language === "no" ? "produkt" : "product"}
                    </button>
                  </div>
                  )}
                </td>
                )}
                {isGrind && (
                <>
                  <td className="px-3 py-2" data-label={language === "no" ? "Slip" : "Grind"}>
                    <select
                      value={row.grindProfileId?.toString() || ""}
                      onChange={(e) => {
                        const profileId = e.target.value ? Number(e.target.value) : undefined;
                        const profile = grindProfiles.find((p) => p.id === profileId);
                        if (profile) {
                          const extra = parseExtraParams(profile.extraParams);
                          const next = rows.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  grindProfileId: profile.id,
                                  grindType: profile.name,
                                  grindStone: profile.stone,
                                  grindPattern: profile.pattern,
                                  grindExtraParams: extra,
                                }
                              : r
                          );
                          setRows(next);
                        } else {
                          const next = rows.map((r) =>
                            r.id === row.id
                              ? { ...r, grindProfileId: undefined, grindType: undefined, grindStone: undefined, grindPattern: undefined, grindExtraParams: undefined }
                              : r
                          );
                          setRows(next);
                        }
                      }}
                      className="h-8 w-full rounded-lg border bg-background px-2 text-xs"
                      data-testid={`select-grind-profile-${row.id}`}
                    >
                      <option value="">— Select grind —</option>
                      {grindProfiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.grindType})</option>
                      ))}
                    </select>
                  </td>
                  {extraGrindCols.map((col) => (
                    <td key={col} className="px-3 py-2" data-label={GRIND_PARAM_LABELS[col] ?? col}>
                      {col === "stone" ? (
                        <Input
                          value={row.grindStone || ""}
                          onChange={(e) => {
                            const next = rows.map((r) => (r.id === row.id ? { ...r, grindStone: e.target.value || undefined } : r));
                            setRows(next);
                          }}
                          className="h-8 bg-background text-xs"
                          placeholder={t("tests.productPlaceholder")}
                          data-testid={`input-grind-stone-${row.id}`}
                        />
                      ) : col === "pattern" ? (
                        <Input
                          value={row.grindPattern || ""}
                          onChange={(e) => {
                            const next = rows.map((r) => (r.id === row.id ? { ...r, grindPattern: e.target.value || undefined } : r));
                            setRows(next);
                          }}
                          className="h-8 bg-background text-xs"
                          placeholder={t("tests.structurePlaceholder")}
                          data-testid={`input-grind-pattern-${row.id}`}
                        />
                      ) : (
                        <Input
                          value={row.grindExtraParams?.[col] || ""}
                          onChange={(e) => {
                            const next = rows.map((r) =>
                              r.id === row.id
                                ? { ...r, grindExtraParams: { ...(r.grindExtraParams || {}), [col]: e.target.value } }
                                : r
                            );
                            setRows(next);
                          }}
                          className="h-8 bg-background text-xs"
                          placeholder="—"
                          data-testid={`input-grind-extra-${col}-${row.id}`}
                        />
                      )}
                    </td>
                  ))}
                </>
                )}
                {row.roundResults.map((rr, roundIdx) => (
                  <>
                    <td key={`res-${roundIdx}`} className="px-3 py-2" data-label={(distanceLabels[roundIdx] || (language === "no" ? "Resultat" : "Result")) + " (cm)"}>
                      <div className="relative">
                        {/* type=text + inputMode keeps the numeric keyboard but kills the browser spinner */}
                        <Input
                          inputMode="decimal"
                          type="text"
                          value={rr.result ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            const num = v === "" ? null : Number(v.replace(",", "."));
                            const next = rows.map((r) => {
                              if (r.id !== row.id) return r;
                              const newRounds = [...r.roundResults];
                              newRounds[roundIdx] = { ...newRounds[roundIdx], result: Number.isNaN(num) ? newRounds[roundIdx].result : num };
                              return { ...r, roundResults: newRounds };
                            });
                            setRows(next);
                          }}
                          className="h-8 w-20 bg-background pr-8 text-right font-mono tabular-nums"
                          placeholder="0"
                          data-testid={`input-result-${roundIdx}-${row.id}`}
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px] text-muted-foreground/60">cm</span>
                      </div>
                    </td>
                    <td key={`rank-${roundIdx}`} className="px-2 py-2 text-center" data-label="Rank">{rankBadge(rr.rank)}</td>
                  </>
                ))}
                <td className="px-3 py-2" data-label={language === "no" ? "Følelse" : "Feeling"}>
                  <div className="flex items-center gap-1.5">
                    {/* Free number entry — numeric keyboard on mobile, no spinner */}
                    <Input
                      inputMode="numeric"
                      type="text"
                      value={row.feelingRank ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const num = v === "" ? null : Number(v.replace(",", "."));
                        const next = rows.map((r) => (r.id === row.id ? { ...r, feelingRank: Number.isNaN(num) ? r.feelingRank : num } : r));
                        setRows(next);
                      }}
                      className="h-8 w-12 bg-background text-center font-mono tabular-nums"
                      placeholder="–"
                      data-testid={`input-feeling-${row.id}`}
                    />
                    <Input
                      value={row.feelingNote ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        const next = rows.map((r) => (r.id === row.id ? { ...r, feelingNote: v } : r));
                        setRows(next);
                      }}
                      className="h-8 w-36 rounded-md border-transparent bg-transparent px-1.5 text-xs shadow-none placeholder:text-muted-foreground/50 hover:border-border focus:border-border focus:bg-background"
                      placeholder={feelingNotePlaceholder}
                      data-testid={`input-feeling-note-${row.id}`}
                    />
                  </div>
                </td>
                {isClassic && (
                <td className="px-3 py-2" data-label="Kick">
                  <Input
                    inputMode="numeric"
                    type="text"
                    value={row.kickRank ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? null : Number(v.replace(",", "."));
                      const next = rows.map((r) => (r.id === row.id ? { ...r, kickRank: Number.isNaN(num) ? r.kickRank : num } : r));
                      setRows(next);
                    }}
                    className="h-8 w-12 bg-background text-center font-mono tabular-nums"
                    placeholder="–"
                    data-testid={`input-kick-${row.id}`}
                  />
                  {showKickSolution && (
                    <Input
                      value={kickSame ? (rows[0]?.kickSolution ?? "") : (row.kickSolution ?? "")}
                      disabled={kickSame && row.id !== rows[0]?.id}
                      onChange={(e) => setKickSolution(row.id, e.target.value)}
                      className="mt-1 h-7 w-40 bg-background text-xs"
                      placeholder={language === "no" ? "Kick solution…" : "Kick solution…"}
                      data-testid={`input-kick-solution-${row.id}`}
                    />
                  )}
                </td>
                )}
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      {/* Add a ski pair directly below the rows — works for new tests and when
          editing an already-run test (the top "Add ski" button is far away). */}
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed text-muted-foreground hover:text-foreground"
          data-testid="button-add-ski-pair-inline"
          onClick={() =>
            setRows([
              ...rows,
              {
                id: `row_new_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                skiNumber: rows.length + 1,
                productId: undefined,
                methodology: "",
                applications: [],
                roundResults: Array.from({ length: distanceLabels.length }, () => ({ result: null, rank: null })),
                feelingRank: null,
                kickRank: null,
              },
            ])
          }
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {isRaceSki
            ? (language === "no" ? "Legg til skipar" : "Add ski pair")
            : (language === "no" ? "Legg til rad" : "Add entry")}
        </Button>
      </div>
    </div>
  );
}
