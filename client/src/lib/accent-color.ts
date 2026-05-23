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

const KEY = "glidr-accent-color";
const DEFAULT: AccentColor = "blue";

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
}

export function applyAccentColor(color: AccentColor) {
  const entry = ACCENT_COLORS.find(c => c.id === color) ?? ACCENT_COLORS[0];
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const hsl = isDark ? entry.darkHsl : entry.hsl;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);
}
