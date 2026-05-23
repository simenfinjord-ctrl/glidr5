export type AccentColor = "blue" | "green" | "pink" | "orange" | "yellow" | "purple" | "red" | "teal";

export const ACCENT_COLORS: { id: AccentColor; label: string; hsl: string; darkHsl: string }[] = [
  { id: "blue",   label: "Blue",   hsl: "215 75% 50%", darkHsl: "215 80% 60%" },
  { id: "green",  label: "Green",  hsl: "142 55% 38%", darkHsl: "142 60% 50%" },
  { id: "pink",   label: "Pink",   hsl: "340 60% 52%", darkHsl: "340 65% 62%" },
  { id: "orange", label: "Orange", hsl: "22 78% 48%",  darkHsl: "22 80% 58%" },
  { id: "yellow", label: "Yellow", hsl: "40 72% 42%",  darkHsl: "40 75% 52%" },
  { id: "purple", label: "Purple", hsl: "262 55% 52%", darkHsl: "262 60% 62%" },
  { id: "red",    label: "Red",    hsl: "2 65% 48%",   darkHsl: "2 68% 58%" },
  { id: "teal",   label: "Teal",   hsl: "175 58% 36%", darkHsl: "175 62% 46%" },
];

/** Tailwind classes used for active nav items — all strings are literals so Tailwind doesn't purge them */
export const ACCENT_NAV: Record<AccentColor, { activeColor: string; activeBg: string; selectedBtn: string }> = {
  blue:   { activeColor: "text-blue-700 dark:text-blue-400",   activeBg: "bg-blue-50 dark:bg-blue-900/20",   selectedBtn: "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" },
  green:  { activeColor: "text-green-700 dark:text-green-400", activeBg: "bg-green-50 dark:bg-green-900/20", selectedBtn: "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" },
  pink:   { activeColor: "text-rose-700 dark:text-rose-400",   activeBg: "bg-rose-50 dark:bg-rose-900/20",   selectedBtn: "border-rose-600 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400" },
  orange: { activeColor: "text-orange-700 dark:text-orange-400", activeBg: "bg-orange-50 dark:bg-orange-900/20", selectedBtn: "border-orange-600 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400" },
  yellow: { activeColor: "text-yellow-700 dark:text-yellow-400", activeBg: "bg-yellow-50 dark:bg-yellow-900/20", selectedBtn: "border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400" },
  purple: { activeColor: "text-purple-700 dark:text-purple-400", activeBg: "bg-purple-50 dark:bg-purple-900/20", selectedBtn: "border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" },
  red:    { activeColor: "text-red-700 dark:text-red-400",     activeBg: "bg-red-50 dark:bg-red-900/20",     selectedBtn: "border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" },
  teal:   { activeColor: "text-teal-700 dark:text-teal-400",   activeBg: "bg-teal-50 dark:bg-teal-900/20",   selectedBtn: "border-teal-600 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400" },
};

const KEY = "glidr-accent-color";
const DEFAULT: AccentColor = "blue";
const STYLE_ID = "glidr-accent-override";
const EVENT = "glidr-accent-change";

export function getAccentColor(): AccentColor {
  try {
    const v = localStorage.getItem(KEY);
    if (ACCENT_COLORS.find(c => c.id === v)) return v as AccentColor;
  } catch {}
  return DEFAULT;
}

export function setAccentColor(color: AccentColor) {
  try { localStorage.setItem(KEY, color); } catch {}
  applyAccentColor(color);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: color }));
}

export function onAccentChange(cb: (color: AccentColor) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as AccentColor);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/**
 * Injects a <style> tag with !important overrides for CSS custom properties.
 * This beats any compiled Tailwind specificity.
 */
export function applyAccentColor(color: AccentColor) {
  const entry = ACCENT_COLORS.find(c => c.id === color) ?? ACCENT_COLORS[0];

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }

  el.textContent = `
    :root {
      --primary: ${entry.hsl} !important;
      --accent: ${entry.hsl} !important;
      --ring: ${entry.hsl} !important;
      --sidebar-primary: ${entry.hsl} !important;
      --sidebar-ring: ${entry.hsl} !important;
    }
    .dark {
      --primary: ${entry.darkHsl} !important;
      --accent: ${entry.darkHsl} !important;
      --ring: ${entry.darkHsl} !important;
      --sidebar-primary: ${entry.darkHsl} !important;
      --sidebar-ring: ${entry.darkHsl} !important;
    }
  `;
}
