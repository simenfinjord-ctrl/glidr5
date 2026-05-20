// © 2025 Glidr — Proprietary and confidential. All rights reserved.
import { cn } from "@/lib/utils";

/**
 * The geometric G path — straight lines only, on a 100×100 coordinate space.
 * Top-right → angled top-left → vertical left → angled bottom-left → bottom-right → vertical right → crossbar
 */
const G = "M72 22 L36 22 L18 36 L18 64 L36 78 L72 78 L72 50 L50 50";

// ─── Icon: rounded-square badge with geometric G ─────────────────────────────
export function GlidrIcon({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size} height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
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
      <polyline points={G} stroke="white" strokeWidth="9.5" fill="none"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Full lockup: icon + "Glidr" wordmark ────────────────────────────────────
// variant="dark"  → dark text  (light backgrounds — default)
// variant="white" → white text (dark backgrounds)
export function GlidrLogo({
  variant = "dark",
  size = 32,
  className,
}: {
  variant?: "dark" | "white";
  size?: number;
  className?: string;
}) {
  const textColor  = variant === "white" ? "white" : "#18181b";
  const fontSize   = Math.round(size * 0.6);
  const gap        = Math.round(size * 0.38);
  const totalW     = size + gap + Math.round(fontSize * 3.2);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${totalW} ${size}`}
      width={totalW} height={size}
      aria-label="Glidr"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="gl-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="gl-shine" x1="0%" y1="0%" x2="60%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.14" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Badge */}
      <rect width={size} height={size} rx={size * 0.22} fill="url(#gl-bg)" />
      <rect width={size} height={size} rx={size * 0.22} fill="url(#gl-shine)" />
      <g transform={`translate(${size * 0.09},${size * 0.09}) scale(${size * 0.0082})`}>
        <polyline points={G} stroke="white" strokeWidth="9.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Wordmark */}
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
