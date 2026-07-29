// © 2025 Glidr — Proprietary and confidential. All rights reserved.
//
// NATION DESIGN PACKS — a complete per-team visual identity the SA can switch
// on per team (Teams → Edit plan). When active, the app dresses itself in the
// nation's colors: primary/accent tokens, a flag ribbon across the top, and
// the team's flag next to the logo. Flags are emoji (crisp everywhere, no
// trademarked federation logos). The pack OVERRIDES the user's personal
// accent color while enabled — the team identity wins.

export type NationCode =
  | "us" | "no" | "se" | "fi" | "si" | "de" | "fr" | "it"
  | "ch" | "at" | "ca" | "cz" | "pl" | "ee";

export type NationTheme = {
  code: NationCode;
  name: string;
  nameNo: string;
  flag: string;
  /** Light-mode primary (HSL triplet, same format as the accent system). */
  hsl: string;
  darkHsl: string;
  /** Flag-stripe gradient for the top ribbon, left to right. */
  ribbon: string[];
};

export const NATION_THEMES: NationTheme[] = [
  { code: "us", name: "USA",           nameNo: "USA",       flag: "🇺🇸", hsl: "216 65% 30%", darkHsl: "216 60% 58%", ribbon: ["#B31942", "#FFFFFF", "#0A3161"] },
  { code: "no", name: "Norway",        nameNo: "Norge",     flag: "🇳🇴", hsl: "348 78% 40%", darkHsl: "348 70% 58%", ribbon: ["#BA0C2F", "#FFFFFF", "#00205B"] },
  { code: "se", name: "Sweden",        nameNo: "Sverige",   flag: "🇸🇪", hsl: "213 90% 38%", darkHsl: "213 80% 58%", ribbon: ["#005CBF", "#FECC02"] },
  { code: "fi", name: "Finland",       nameNo: "Finland",   flag: "🇫🇮", hsl: "214 78% 33%", darkHsl: "214 70% 58%", ribbon: ["#FFFFFF", "#002F6C"] },
  { code: "si", name: "Slovenia",      nameNo: "Slovenia",  flag: "🇸🇮", hsl: "205 90% 34%", darkHsl: "205 80% 58%", ribbon: ["#FFFFFF", "#005DA4", "#ED1C24"] },
  { code: "de", name: "Germany",       nameNo: "Tyskland",  flag: "🇩🇪", hsl: "0 72% 40%",   darkHsl: "0 65% 58%",   ribbon: ["#000000", "#DD0000", "#FFCE00"] },
  { code: "fr", name: "France",        nameNo: "Frankrike", flag: "🇫🇷", hsl: "227 70% 38%", darkHsl: "227 65% 60%", ribbon: ["#002395", "#FFFFFF", "#ED2939"] },
  { code: "it", name: "Italy",         nameNo: "Italia",    flag: "🇮🇹", hsl: "146 65% 30%", darkHsl: "146 55% 48%", ribbon: ["#008C45", "#FFFFFF", "#CD212A"] },
  { code: "ch", name: "Switzerland",   nameNo: "Sveits",    flag: "🇨🇭", hsl: "4 74% 45%",   darkHsl: "4 70% 58%",   ribbon: ["#DA291C", "#FFFFFF", "#DA291C"] },
  { code: "at", name: "Austria",       nameNo: "Østerrike", flag: "🇦🇹", hsl: "352 72% 44%", darkHsl: "352 68% 58%", ribbon: ["#ED2939", "#FFFFFF", "#ED2939"] },
  { code: "ca", name: "Canada",        nameNo: "Canada",    flag: "🇨🇦", hsl: "352 76% 44%", darkHsl: "352 70% 58%", ribbon: ["#D80621", "#FFFFFF", "#D80621"] },
  { code: "cz", name: "Czechia",       nameNo: "Tsjekkia",  flag: "🇨🇿", hsl: "215 66% 34%", darkHsl: "215 62% 58%", ribbon: ["#11457E", "#FFFFFF", "#D7141A"] },
  { code: "pl", name: "Poland",        nameNo: "Polen",     flag: "🇵🇱", hsl: "348 72% 44%", darkHsl: "348 68% 58%", ribbon: ["#FFFFFF", "#DC143C"] },
  { code: "ee", name: "Estonia",       nameNo: "Estland",   flag: "🇪🇪", hsl: "205 90% 38%", darkHsl: "205 80% 58%", ribbon: ["#0072CE", "#000000", "#FFFFFF"] },
];

export function getNationTheme(code: string | null | undefined): NationTheme | null {
  if (!code) return null;
  return NATION_THEMES.find((n) => n.code === String(code).toLowerCase()) ?? null;
}

/** CSS gradient for the flag ribbon — hard stops so it reads as flag stripes. */
export function ribbonGradient(theme: NationTheme): string {
  const n = theme.ribbon.length;
  const stops = theme.ribbon
    .map((c, i) => `${c} ${(i / n) * 100}%, ${c} ${((i + 1) / n) * 100}%`)
    .join(", ");
  return `linear-gradient(90deg, ${stops})`;
}

const STYLE_ID = "glidr-nation-override";

/**
 * Applies (or clears) the nation's color tokens. The <style> tag is appended
 * LAST in <head>, so with equal specificity it wins over the user's personal
 * accent override — the team identity takes precedence while enabled.
 */
export function applyNationTheme(code: string | null | undefined): void {
  const theme = getNationTheme(code);
  const existing = document.getElementById(STYLE_ID);
  if (!theme) {
    existing?.remove();
    return;
  }
  let el = existing as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  // Re-append so this tag always sits after the accent override tag.
  document.head.appendChild(el);
  el.textContent = `
    :root {
      --primary: ${theme.hsl} !important;
      --accent: ${theme.hsl} !important;
      --ring: ${theme.hsl} !important;
      --sidebar-primary: ${theme.hsl} !important;
      --sidebar-ring: ${theme.hsl} !important;
    }
    .dark {
      --primary: ${theme.darkHsl} !important;
      --accent: ${theme.darkHsl} !important;
      --ring: ${theme.darkHsl} !important;
      --sidebar-primary: ${theme.darkHsl} !important;
      --sidebar-ring: ${theme.darkHsl} !important;
    }
  `;
}
