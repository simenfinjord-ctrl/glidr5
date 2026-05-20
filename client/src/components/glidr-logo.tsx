// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { cn } from "@/lib/utils";

/**
 * GlidrIcon — the standalone G mark in a rounded square.
 * Use for favicons, app-icon badges, compact contexts.
 */
export function GlidrIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      aria-label="Glidr"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="glidr-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="glidr-shine" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.13" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="100" height="100" rx="22" fill="url(#glidr-bg)" />
      <rect width="100" height="100" rx="22" fill="url(#glidr-shine)" />

      {/*
        G lettermark
        Circle center (50,50) radius 20.
        Arc endpoints at ±40° from horizontal:
          upper = (50+20·cos40°, 50−20·sin40°) ≈ (65, 37)
          lower = (65, 63)
        280° arc, CCW (large-arc=1, sweep=0)
      */}
      <path
        d="M65 37 A20 20 0 1 0 65 63"
        stroke="white"
        strokeWidth="9.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Crossbar: center → rightmost point */}
      <line
        x1="50" y1="50" x2="70" y2="50"
        stroke="white" strokeWidth="9.5" strokeLinecap="round"
      />
      {/* Speed tail — the Glidr signature mark */}
      <line
        x1="70" y1="50" x2="79" y2="36"
        stroke="white" strokeWidth="5"
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
}

/**
 * GlidrLogo — icon + wordmark side by side.
 * variant="dark"  → dark wordmark (use on light backgrounds)
 * variant="white" → white wordmark (use on dark backgrounds)
 */
export function GlidrLogo({
  variant = "dark",
  className,
  iconSize = 32,
}: {
  variant?: "dark" | "white";
  className?: string;
  iconSize?: number;
}) {
  const textColor = variant === "white" ? "white" : "#18181b";
  const gap = Math.round(iconSize * 0.45);
  const fontSize = Math.round(iconSize * 0.56);
  const totalWidth = iconSize + gap + fontSize * 3.3; // approx "Glidr" width
  const height = iconSize;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${Math.round(totalWidth)} ${height}`}
      aria-label="Glidr"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="glidr-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="glidr-logo-shine" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.13" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Icon */}
      <rect width={iconSize} height={iconSize} rx={iconSize * 0.22} fill="url(#glidr-logo-bg)" />
      <rect width={iconSize} height={iconSize} rx={iconSize * 0.22} fill="url(#glidr-logo-shine)" />

      {/* G arc scaled to icon size (base: 100×100 box) */}
      {(() => {
        const s = iconSize / 100;
        const cx = 50 * s, cy = 50 * s, r = 20 * s;
        const ax = (50 + 20 * Math.cos((40 * Math.PI) / 180)) * s;
        const ayTop = (50 - 20 * Math.sin((40 * Math.PI) / 180)) * s;
        const ayBot = (50 + 20 * Math.sin((40 * Math.PI) / 180)) * s;
        const rightX = (50 + 20) * s;
        const sw = 9.5 * s;
        const tailX = 79 * s, tailY = 36 * s;
        return (
          <>
            <path
              d={`M${ax} ${ayTop} A${r} ${r} 0 1 0 ${ax} ${ayBot}`}
              stroke="white" strokeWidth={sw} fill="none" strokeLinecap="round"
            />
            <line x1={cx} y1={cy} x2={rightX} y2={cy}
              stroke="white" strokeWidth={sw} strokeLinecap="round" />
            <line x1={rightX} y1={cy} x2={tailX} y2={tailY}
              stroke="white" strokeWidth={5 * s} strokeLinecap="round" opacity={0.55} />
          </>
        );
      })()}

      {/* Wordmark */}
      <text
        x={iconSize + gap}
        y={iconSize * 0.69}
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
