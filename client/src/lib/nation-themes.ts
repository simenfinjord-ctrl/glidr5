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
  /** Hue for the tinted app background — defaults to the primary's hue.
   *  Lets e.g. the US pack pair a RED primary with a BLUE-tinted canvas. */
  bgHue?: number;
};

export const NATION_THEMES: NationTheme[] = [
  { code: "us", name: "USA",           nameNo: "USA",       flag: "🇺🇸", hsl: "350 75% 42%", darkHsl: "350 70% 60%", bgHue: 216, ribbon: ["#B31942", "#FFFFFF", "#0A3161"] },
  { code: "no", name: "Norway",        nameNo: "Norge",     flag: "🇳🇴", hsl: "348 78% 40%", darkHsl: "348 70% 58%", bgHue: 220, ribbon: ["#BA0C2F", "#FFFFFF", "#00205B"] },
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
    document.documentElement.classList.remove("glidr-nation");
    return;
  }
  let el = existing as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  // Re-append so this tag always sits after the accent override tag.
  document.head.appendChild(el);
  document.documentElement.classList.add("glidr-nation");

  // Glidr's brand green lives in ~600 hard-coded green/emerald utility
  // classes, not only in the --primary token — so a REAL national identity
  // re-tints that whole family to the nation's color, and tints the canvas
  // in the flag's hue. Scoped under html.glidr-nation so removing the class
  // restores everything instantly.
  const hue = theme.bgHue ?? parseInt(theme.hsl.split(" ")[0]);
  const P = `hsl(${theme.hsl})`;
  const PD = `hsl(${theme.darkHsl})`;
  const [ph, ps] = theme.hsl.split(" ");
  const shade = (l: number) => `hsl(${ph} ${ps} ${l}%)`;
  const g = ".glidr-nation";
  el.textContent = `
    html${g} {
      --primary: ${theme.hsl} !important;
      --accent: ${theme.hsl} !important;
      --ring: ${theme.hsl} !important;
      --sidebar-primary: ${theme.hsl} !important;
      --sidebar-ring: ${theme.hsl} !important;
      --background: ${hue} 34% 96% !important;
      --muted: ${hue} 28% 93% !important;
    }
    html${g}.dark, html${g} .dark {
      --primary: ${theme.darkHsl} !important;
      --accent: ${theme.darkHsl} !important;
      --ring: ${theme.darkHsl} !important;
      --sidebar-primary: ${theme.darkHsl} !important;
      --sidebar-ring: ${theme.darkHsl} !important;
      --background: ${hue} 28% 9% !important;
      --muted: ${hue} 22% 14% !important;
    }
    /* App canvas (the shell hard-codes this gray) */
    html${g} .bg-\\[\\#f4f4f6\\] { background-color: hsl(${hue} 34% 94%) !important; }

    /* Brand green family -> nation color */
    html${g} .bg-green-600:not(.nation-keep), html${g} .bg-emerald-600:not(.nation-keep), html${g} .bg-green-700:not(.nation-keep), html${g} .bg-emerald-700:not(.nation-keep),
    html${g} .bg-green-500:not(.nation-keep), html${g} .bg-emerald-500:not(.nation-keep) { background-color: ${P} !important; }
    html${g} .hover\\:bg-green-700:hover, html${g} .hover\\:bg-emerald-700:hover,
    html${g} .hover\\:bg-green-600:hover, html${g} .hover\\:bg-emerald-600:hover { background-color: ${shade(30)} !important; }
    html${g} .bg-green-400:not(.nation-keep), html${g} .bg-emerald-400:not(.nation-keep) { background-color: ${shade(52)} !important; }
    html${g} .bg-green-100:not(.nation-keep), html${g} .bg-emerald-100:not(.nation-keep) { background-color: ${shade(90)} !important; }
    html${g} .bg-green-50:not(.nation-keep), html${g} .bg-emerald-50:not(.nation-keep) { background-color: ${shade(95)} !important; }
    html${g} .text-green-500:not(.nation-keep), html${g} .text-emerald-500:not(.nation-keep), html${g} .text-green-600:not(.nation-keep), html${g} .text-emerald-600:not(.nation-keep),
    html${g} .text-green-700:not(.nation-keep), html${g} .text-emerald-700:not(.nation-keep), html${g} .text-green-800:not(.nation-keep), html${g} .text-emerald-800:not(.nation-keep) { color: ${P} !important; }
    html${g} .text-green-300:not(.nation-keep), html${g} .text-emerald-300:not(.nation-keep), html${g} .text-green-400:not(.nation-keep), html${g} .text-emerald-400:not(.nation-keep) { color: ${shade(46)} !important; }
    html${g} .border-green-200:not(.nation-keep), html${g} .border-emerald-200:not(.nation-keep) { border-color: ${shade(84)} !important; }
    html${g} .border-green-300:not(.nation-keep), html${g} .border-emerald-300:not(.nation-keep) { border-color: ${shade(74)} !important; }
    html${g} .border-green-500:not(.nation-keep), html${g} .border-green-600:not(.nation-keep), html${g} .border-emerald-500:not(.nation-keep), html${g} .border-emerald-600:not(.nation-keep) { border-color: ${P} !important; }
    html${g} .ring-green-200:not(.nation-keep), html${g} .ring-emerald-200:not(.nation-keep) { --tw-ring-color: ${shade(84)} !important; }

    /* Dark-mode green family */
    html${g} .dark .dark\\:bg-green-900\\/20, html${g} .dark .dark\\:bg-emerald-900\\/20,
    html${g} .dark .dark\\:bg-green-950\\/30, html${g} .dark .dark\\:bg-emerald-950\\/30 { background-color: hsl(${ph} 40% 20% / 0.35) !important; }
    html${g} .dark .dark\\:text-green-300, html${g} .dark .dark\\:text-emerald-300,
    html${g} .dark .dark\\:text-green-400, html${g} .dark .dark\\:text-emerald-400 { color: ${PD} !important; }
    html${g} .dark .dark\\:ring-green-800, html${g} .dark .dark\\:ring-emerald-800 { --tw-ring-color: hsl(${ph} 40% 30%) !important; }
  `;
}
