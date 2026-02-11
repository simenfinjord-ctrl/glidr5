import { useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Product, TestType } from "@/lib/mock-db";
import { ProductCombobox } from "@/components/product-combobox";

export type EntryRow = {
  id: string;
  skiNumber: number;
  productId?: string;
  methodology: string;
  result0kmCmBehind: number | null;
  rank0km: number | null;
  resultXkmCmBehind: number | null;
  rankXkm: number | null;
};

function denseRanks(values: Array<{ rowId: string; v: number }>) {
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const ranks = new Map<string, number>();
  let rank = 1;
  let prev: number | null = null;

  for (const item of sorted) {
    if (prev === null) {
      ranks.set(item.rowId, rank);
      prev = item.v;
      continue;
    }

    if (item.v !== prev) {
      rank += 1;
      prev = item.v;
    }
    ranks.set(item.rowId, rank);
  }

  return ranks;
}

export function TestEntryTable({
  testType,
  products,
  rows,
  setRows,
}: {
  testType: TestType;
  products: Product[];
  rows: EntryRow[];
  setRows: (next: EntryRow[]) => void;
}) {
  const ranks0 = useMemo(() => {
    const vals = rows
      .filter((r) => typeof r.result0kmCmBehind === "number" && r.result0kmCmBehind !== null)
      .map((r) => ({ rowId: r.id, v: r.result0kmCmBehind as number }));
    return denseRanks(vals);
  }, [rows]);

  const ranksX = useMemo(() => {
    const vals = rows
      .filter((r) => typeof r.resultXkmCmBehind === "number" && r.resultXkmCmBehind !== null)
      .map((r) => ({ rowId: r.id, v: r.resultXkmCmBehind as number }));
    return denseRanks(vals);
  }, [rows]);

  useEffect(() => {
    const next = rows.map((r) => ({
      ...r,
      rank0km: r.result0kmCmBehind === null ? null : (ranks0.get(r.id) ?? null),
      rankXkm: r.resultXkmCmBehind === null ? null : (ranksX.get(r.id) ?? null),
    }));
    // only update if ranks changed
    const changed = next.some((n, i) => n.rank0km !== rows[i]?.rank0km || n.rankXkm !== rows[i]?.rankXkm);
    if (changed) setRows(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ranks0, ranksX]);

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card/50">
      <table className="min-w-[920px] w-full border-separate border-spacing-0">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="sticky left-0 z-10 bg-card/80 px-3 py-3">Ski No.</th>
            <th className="px-3 py-3">Product</th>
            <th className="px-3 py-3">Method</th>
            <th className="px-3 py-3">Result 0 km (cm)</th>
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Result X km (cm)</th>
            <th className="px-3 py-3">Rank</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {rows.map((row, idx) => {
            const rankBadge = (rank: number | null) => (
              <div
                className={cn(
                  "inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-semibold",
                  rank === 1
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : rank === 2
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                      : rank === 3
                        ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                        : "bg-muted/70 text-foreground",
                )}
                data-testid={`text-rank-${row.id}`}
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
                <td className="px-3 py-2">
                  <ProductCombobox
                    testType={testType}
                    products={products}
                    value={row.productId}
                    onChange={(id) => {
                      const next = rows.map((r) => (r.id === row.id ? { ...r, productId: id } : r));
                      setRows(next);
                    }}
                    testId={`input-product-${row.id}`}
                  />
                </td>
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
                <td className="px-3 py-2">
                  <Input
                    inputMode="decimal"
                    type="number"
                    value={row.result0kmCmBehind ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? null : Number(v);
                      const next = rows.map((r) => (r.id === row.id ? { ...r, result0kmCmBehind: Number.isNaN(num) ? null : num } : r));
                      setRows(next);
                    }}
                    className="h-9 bg-background/70"
                    placeholder="0"
                    data-testid={`input-result0-${row.id}`}
                  />
                </td>
                <td className="px-3 py-2">{rankBadge(row.rank0km)}</td>
                <td className="px-3 py-2">
                  <Input
                    inputMode="decimal"
                    type="number"
                    value={row.resultXkmCmBehind ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === "" ? null : Number(v);
                      const next = rows.map((r) => (r.id === row.id ? { ...r, resultXkmCmBehind: Number.isNaN(num) ? null : num } : r));
                      setRows(next);
                    }}
                    className="h-9 bg-background/70"
                    placeholder=""
                    data-testid={`input-resultx-${row.id}`}
                  />
                </td>
                <td className="px-3 py-2">{rankBadge(row.rankXkm)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
