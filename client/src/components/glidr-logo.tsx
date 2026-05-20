// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { cn } from "@/lib/utils";

/**
 * Geometric G — straight lines only, defined on a 100×100 coordinate space.
 * The outer SVG always uses viewBox="0 0 100 100" so the browser handles
 * all scaling automatically — no manual transform calculations needed.
 */
const G = "M72 22 L36 22 L18 36 L18 64 L36 78 L72 78 L72 50 L50 50";

// ─── Shared badge defs (rendered once per SVG) ────────────────────────────────
function BadgeDefs({ idSuffix }: { idSuffix: string }) {
  return (
    <defs>
      <linearGradient id={`g-bg-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
      <linearGradient id={`g-shine-${idSuffix}`} x1="0%" y1="0%" x2="60%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.14" />
        <stop offset="100%" stopColor="white" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

// ─── GlidrIcon: standalone badge ─────────────────────────────────────────────
// Uses viewBox="0 0 100 100" so the G coordinates map directly — always correct.
export function GlidrIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <BadgeDefs idSuffix="icon" />
      <rect width="100" height="100" rx="22" fill="url(#g-bg-icon)" />
      <rect width="100" height="100" rx="22" fill="url(#g-shine-icon)" />
      <polyline
        points={G}
        stroke="white"
        strokeWidth="9.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── GlidrLogo: badge + wordmark ─────────────────────────────────────────────
// The badge is a nested <svg> with its own viewBox="0 0 100 100",
// placed at x=0 y=0 with width=size height=size inside the outer SVG.
// This means the G coordinates always map correctly regardless of size.
export function GlidrLogo({
  variant = "dark",
  size = 32,
  className,
}: {
  variant?: "dark" | "white";
  size?: number;
  className?: string;
}) {
  const textColor = variant === "white" ? "white" : "#18181b";
  const fontSize  = Math.round(size * 0.6);
  const gap       = Math.round(size * 0.38);
  const totalW    = size + gap + Math.round(fontSize * 3.15);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalW} ${size}`}
      width={totalW}
      height={size}
      aria-label="Glidr"
      className={cn("shrink-0", className)}
    >
      {/* Nested SVG for the badge — own viewBox handles G scaling */}
      <svg x="0" y="0" width={size} height={size} viewBox="0 0 100 100">
        <BadgeDefs idSuffix="logo" />
        <rect width="100" height="100" rx="22" fill="url(#g-bg-logo)" />
        <rect width="100" height="100" rx="22" fill="url(#g-shine-logo)" />
        <polyline
          points={G}
          stroke="white"
          strokeWidth="9.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark — positioned right of the badge */}
      <text
        x={size + gap}
        y={size * 0.715}
        fontFamily="'Inter', system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize={fontSize}
        letterSpacing={-fontSize * 0.025}
        fill={textColor}
      >
        Glidr
      </text>
    </svg>
  );
}
