// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// Per-USER temperature unit. Values are always STORED in °C — this is a pure
// display preference (users.temp_unit, set under My Account → Preferences).
// Input fields stay in °C.

export type TempUnit = "C" | "F";

export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

/** "-5°C" or "23°F" from a stored °C value. Non-numbers pass through as "—". */
export function formatTemp(c: number | string | null | undefined, unit: TempUnit): string {
  if (c == null || c === "") return "—";
  const n = typeof c === "number" ? c : parseFloat(String(c));
  if (isNaN(n)) return String(c);
  if (unit === "F") return `${Math.round(cToF(n))}°F`;
  const r = Math.round(n * 10) / 10;
  return `${r}°C`;
}

/** Unit for the current user object (from useAuth). */
export function userTempUnit(user: unknown): TempUnit {
  return (user as any)?.tempUnit === "F" ? "F" : "C";
}

// Module-level current unit, set by useAuth() when the user loads — same
// pattern as setGlidrDateFormat. Lets every render site call fmtT(value)
// without threading the user object through.
let glidrTempUnit: TempUnit = "C";
export function setGlidrTempUnit(unit: TempUnit | string | null | undefined): void {
  glidrTempUnit = unit === "F" ? "F" : "C";
}
/** Format a stored °C value in the CURRENT USER's unit. */
export function fmtT(c: number | string | null | undefined): string {
  return formatTemp(c, glidrTempUnit);
}
