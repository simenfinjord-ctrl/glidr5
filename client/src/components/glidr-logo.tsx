// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { cn } from "@/lib/utils";

// ─── Shared G-mark paths (all use a 100×100 coordinate space) ───────────────
// Circle center (50,50) radius 20.
// Arc endpoints at ±40° → upper≈(65,37) lower≈(65,63) — 280° CCW arc.
const G_ARC   = "M65 37 A20 20 0 1 0 65 63";
const G_BAR   = { x1: 50, y1: 50, x2: 70, y2: 50 };
const G_TAIL  = { x1: 70, y1: 50, x2: 79, y2: 36 };

// ─── Variant A: Rounded-square badge (current, "app icon" style) ─────────────
export function GlidrIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
      aria-label="Glidr" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="gi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="gi-shine" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.14" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22" fill="url(#gi-bg)" />
      <rect width="100" height="100" rx="22" fill="url(#gi-shine)" />
      <path d={G_ARC} stroke="white" strokeWidth="9.5" fill="none" strokeLinecap="round" />
      <line {...G_BAR} stroke="white" strokeWidth="9.5" strokeLinecap="round" />
      <line {...G_TAIL} stroke="white" strokeWidth="5" strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}

// ─── Variant B: Circle badge ─────────────────────────────────────────────────
// Softer, rounder feel — same G mark inside a circle instead of a square.
export function GlidrIconCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
      aria-label="Glidr" className={cn("shrink-0", className)}>
      <defs>
        <linearGradient id="gc-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#gc-bg)" />
      <path d={G_ARC} stroke="white" strokeWidth="9.5" fill="none" strokeLinecap="round" />
      <line {...G_BAR} stroke="white" strokeWidth="9.5" strokeLinecap="round" />
      <line {...G_TAIL} stroke="white" strokeWidth="5" strokeLinecap="round" opacity={0.55} />
    </svg>
  );
}

// ─── Variant C: Bare mark (no background) ────────────────────────────────────
// Just the G letterform in emerald — no container.
// Most flexible: works on any background, fits tight into layouts.
export function GlidrMark({ className, color = "#10b981" }: { className?: string; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"
      aria-label="Glidr" className={cn("shrink-0", className)}>
      <path d={G_ARC} stroke={color} strokeWidth="11" fill="none" strokeLinecap="round" />
      <line {...G_BAR} stroke={color} strokeWidth="11" strokeLinecap="round" />
      <line {...G_TAIL} stroke={color} strokeWidth="6" strokeLinecap="round" opacity={0.5} />
    </svg>
  );
}

// ─── Variant D: Text-only wordmark ───────────────────────────────────────────
// No icon — just "Glidr" in Inter ExtraBold with an emerald accent dot
// sitting above the i. Minimal, works in tight horizontal spaces.
export function GlidrWordmark({
  className,
  color = "#18181b",
}: { className?: string; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 40"
      aria-label="Glidr" className={cn("shrink-0", className)}>
      <text x="0" y="30"
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontWeight="800" fontSize="32" letterSpacing="-0.6" fill={color}>
        Glidr
      </text>
      {/* Emerald accent dot on the "i" (replaces the default serif dot) */}
      <circle cx="67.5" cy="7" r="3.5" fill="#10b981" />
    </svg>
  );
}

// ─── Combined lockup (icon + wordmark) ───────────────────────────────────────
// icon prop: "square" | "circle" | "mark" — controls which badge variant to use
export function GlidrLogo({
  variant = "dark",
  icon = "square",
  className,
  iconSize = 28,
}: {
  variant?: "dark" | "white";
  icon?: "square" | "circle" | "mark";
  className?: string;
  iconSize?: number;
}) {
  const textColor = variant === "white" ? "white" : "#18181b";
  const iconEl = icon === "circle"
    ? <GlidrIconCircle className={`h-[${iconSize}px] w-[${iconSize}px]`} />
    : icon === "mark"
    ? <GlidrMark className={`h-[${iconSize}px] w-[${iconSize}px]`} color={variant === "white" ? "white" : "#10b981"} />
    : <GlidrIcon className={`h-[${iconSize}px] w-[${iconSize}px]`} />;

  return (
    <div className={cn("flex items-center gap-2 shrink-0", className)}>
      {iconEl}
      <span
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: `${Math.round(iconSize * 0.57)}px`,
          letterSpacing: "-0.02em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        Glidr
      </span>
    </div>
  );
}
