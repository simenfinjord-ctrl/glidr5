import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Module-level date format (default: 'european')
let __glidrDateFormat: 'european' | 'american' = 'european';

export function setGlidrDateFormat(fmt: 'european' | 'american') {
  __glidrDateFormat = fmt;
}

/** Convert "YYYY-MM-DD" to display format. Reads global date format setting. */
export function fmtDate(iso: string | null | undefined, format?: 'european' | 'american'): string {
  if (!iso) return "—";
  const s = iso.slice(0, 10);
  const parts = s.split("-");
  if (parts.length !== 3) return s;
  const fmt = format ?? __glidrDateFormat;
  if (fmt === 'american') {
    return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
  }
  return `${parts[2]}.${parts[1]}.${parts[0]}`; // DD.MM.YYYY
}
