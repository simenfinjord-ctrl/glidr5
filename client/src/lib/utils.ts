import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert "YYYY-MM-DD" → "DD-MM-YYYY" for display. Safe: pure string, no timezone issues. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}
