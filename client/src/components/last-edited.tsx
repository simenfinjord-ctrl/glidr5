// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// "Who changed this?" is the most common disagreement on a team with several
// waxers, and the created-by line only answers who started the record. Shown
// only once a record has actually been edited — an untouched record would just
// repeat its creator.
import { PenLine } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Stamped = {
  updatedAt?: string | null;
  updatedByName?: string | null;
  createdAt?: string | null;
  createdByName?: string | null;
};

function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function LastEdited({ record, className, showIcon = true }: {
  record: Stamped | null | undefined;
  className?: string;
  showIcon?: boolean;
}) {
  const { language } = useI18n();
  const L = (no: string, en: string) => (language === "no" ? no : en);
  if (!record?.updatedAt || !record.updatedByName) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)}
      title={new Date(record.updatedAt).toLocaleString()}
      data-testid="last-edited"
    >
      {showIcon && <PenLine className="h-3 w-3 shrink-0" />}
      {L(`Sist endret av ${record.updatedByName} · ${when(record.updatedAt)}`,
         `Last edited by ${record.updatedByName} · ${when(record.updatedAt)}`)}
    </span>
  );
}
