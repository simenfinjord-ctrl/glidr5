// © 2025 Glidr — Proprietary and confidential. All rights reserved.

function Logo({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex items-center justify-center w-28 h-28 shadow-sm">
        {children}
      </div>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-700 p-4 flex items-center justify-center w-28 h-20 shadow-sm">
        {children}
      </div>
      <p className="text-xs font-bold text-zinc-700">#{n}</p>
      <p className="text-[10px] text-zinc-400 text-center max-w-[100px]">{label}</p>
    </div>
  );
}

export default function LogoPreview() {
  return (
    <div className="min-h-screen bg-zinc-50 p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-1 tracking-tight">Glidr logo — 15 utkast</h1>
        <p className="text-sm text-zinc-500 mb-10">Si nummeret på det du liker, så bytter vi det ut overalt.</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-8">

          {/* ── 1: Rounded square badge ── */}
          <Logo n={1} label="Rounded square + G">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g1)" />
              <path d="M65 37 A20 20 0 1 0 65 63" stroke="white" strokeWidth="9.5" fill="none" strokeLinecap="round" />
              <line x1="50" y1="50" x2="70" y2="50" stroke="white" strokeWidth="9.5" strokeLinecap="round" />
              <line x1="70" y1="50" x2="79" y2="36" stroke="white" strokeWidth="5" strokeLinecap="round" opacity={0.55} />
            </svg>
          </Logo>

          {/* ── 2: Circle badge ── */}
          <Logo n={2} label="Circle badge">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="50" fill="url(#g2)" />
              <path d="M65 37 A20 20 0 1 0 65 63" stroke="white" strokeWidth="9.5" fill="none" strokeLinecap="round" />
              <line x1="50" y1="50" x2="70" y2="50" stroke="white" strokeWidth="9.5" strokeLinecap="round" />
              <line x1="70" y1="50" x2="79" y2="36" stroke="white" strokeWidth="5" strokeLinecap="round" opacity={0.55} />
            </svg>
          </Logo>

          {/* ── 3: Bare G mark, emerald stroke ── */}
          <Logo n={3} label="Bare G, no background">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <path d="M65 37 A20 20 0 1 0 65 63" stroke="#10b981" strokeWidth="11" fill="none" strokeLinecap="round" />
              <line x1="50" y1="50" x2="70" y2="50" stroke="#10b981" strokeWidth="11" strokeLinecap="round" />
              <line x1="70" y1="50" x2="79" y2="36" stroke="#10b981" strokeWidth="6" strokeLinecap="round" opacity={0.5} />
            </svg>
          </Logo>

          {/* ── 4: Wordmark with emerald i-dot ── */}
          <Logo n={4} label="Wordmark + grønn i-prikk">
            <svg viewBox="0 0 110 44" className="w-24 h-10">
              <text x="0" y="33" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="34" letterSpacing="-1" fill="currentColor">Glidr</text>
              <circle cx="57" cy="8" r="4" fill="#10b981" />
            </svg>
          </Logo>

          {/* ── 5: Ski tracks from above ── */}
          <Logo n={5} label="Ski tracks ovenfra">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g5)" />
              {/* Two ski tracks converging toward the bottom */}
              <path d="M30 20 Q28 50 32 80" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M70 20 Q72 50 68 80" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" />
              {/* Speed dot at bottom */}
              <circle cx="50" cy="82" r="4" fill="white" opacity={0.7} />
            </svg>
          </Logo>

          {/* ── 6: Three speed chevrons ── */}
          <Logo n={6} label="Speed chevrons">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g6)" />
              <path d="M18 35 L42 50 L18 65" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.45} />
              <path d="M36 35 L60 50 L36 65" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.72} />
              <path d="M54 35 L78 50 L54 65" stroke="white" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Logo>

          {/* ── 7: Rising bars + trend curve ── */}
          <Logo n={7} label="Stigende bars + kurve">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g7)" />
              <rect x="14" y="58" width="16" height="26" rx="4" fill="white" opacity={0.5} />
              <rect x="42" y="42" width="16" height="42" rx="4" fill="white" opacity={0.75} />
              <rect x="70" y="22" width="16" height="62" rx="4" fill="white" />
              <path d="M22 55 Q50 38 78 20" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="0" opacity={0.6} />
            </svg>
          </Logo>

          {/* ── 8: Negative space G (filled square, G cut out) ── */}
          <Logo n={8} label="Negativ G (cut-out)">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g8" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
                <mask id="m8">
                  <rect width="100" height="100" rx="22" fill="white" />
                  <path d="M65 37 A20 20 0 1 0 65 63" stroke="black" strokeWidth="11" fill="none" strokeLinecap="round" />
                  <line x1="50" y1="50" x2="70" y2="50" stroke="black" strokeWidth="11" strokeLinecap="round" />
                  <line x1="70" y1="50" x2="79" y2="36" stroke="black" strokeWidth="6" strokeLinecap="round" />
                </mask>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g8)" mask="url(#m8)" />
            </svg>
          </Logo>

          {/* ── 9: Hexagon ── */}
          <Logo n={9} label="Hexagon tech">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <polygon points="50,6 91,28 91,72 50,94 9,72 9,28" fill="#10b981" />
              <path d="M65 37 A20 20 0 1 0 65 63" stroke="white" strokeWidth="9" fill="none" strokeLinecap="round" />
              <line x1="50" y1="50" x2="70" y2="50" stroke="white" strokeWidth="9" strokeLinecap="round" />
              <line x1="70" y1="50" x2="78" y2="37" stroke="white" strokeWidth="5" strokeLinecap="round" opacity={0.55} />
            </svg>
          </Logo>

          {/* ── 10: Minimal arc + bold dot ── */}
          <Logo n={10} label="Arc + dot, ultra-minimal">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              {/* Simple open semicircle, no background */}
              <path d="M20 50 A30 30 0 0 1 80 50" stroke="#10b981" strokeWidth="10" fill="none" strokeLinecap="round" />
              {/* Bold data dot */}
              <circle cx="50" cy="82" r="8" fill="#10b981" />
              {/* Thin connecting line */}
              <line x1="50" y1="50" x2="50" y2="74" stroke="#10b981" strokeWidth="4" strokeLinecap="round" opacity={0.4} />
            </svg>
          </Logo>

          {/* ── 11: Three wax layers / stack ── */}
          <Logo n={11} label="Wax layers / stack">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g11" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g11)" />
              {/* Three horizontal bars, full width, stacked */}
              <rect x="18" y="28" width="64" height="10" rx="5" fill="white" />
              <rect x="18" y="45" width="48" height="10" rx="5" fill="white" opacity={0.7} />
              <rect x="18" y="62" width="32" height="10" rx="5" fill="white" opacity={0.45} />
            </svg>
          </Logo>

          {/* ── 12: Angular / geometric G ── */}
          <Logo n={12} label="Geometrisk G (rette linjer)">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g12" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <rect width="100" height="100" rx="22" fill="url(#g12)" />
              {/* G drawn with straight 45° lines only */}
              <polyline
                points="70,25 40,25 20,35 20,65 40,75 70,75 70,52 52,52"
                stroke="white" strokeWidth="9" fill="none"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </Logo>

          {/* ── 13: Bold standalone G letter (no container) ── */}
          <Logo n={13} label="Bold G bokstav alene">
            <svg viewBox="0 0 80 90" className="w-12 h-14">
              <text x="0" y="78"
                fontFamily="'Inter',system-ui,sans-serif"
                fontWeight="800" fontSize="90" letterSpacing="-4" fill="#10b981">G</text>
            </svg>
          </Logo>

          {/* ── 14: Diamond / rotated square ── */}
          <Logo n={14} label="Diamond mark">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              <defs>
                <linearGradient id="g14" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              {/* Rotated square / diamond */}
              <rect x="20" y="20" width="60" height="60" rx="6" fill="url(#g14)" transform="rotate(45 50 50)" />
              {/* Simplified G inside */}
              <path d="M60 42 A14 14 0 1 0 60 58" stroke="white" strokeWidth="7" fill="none" strokeLinecap="round" />
              <line x1="50" y1="50" x2="62" y2="50" stroke="white" strokeWidth="7" strokeLinecap="round" />
            </svg>
          </Logo>

          {/* ── 15: Double-ring speedometer ── */}
          <Logo n={15} label="Speedometer / måleinstrument">
            <svg viewBox="0 0 100 100" className="w-14 h-14">
              {/* Outer ring: 3/4 arc like a speedometer */}
              <path d="M16 72 A38 38 0 1 1 84 72" stroke="#e5e7eb" strokeWidth="8" fill="none" strokeLinecap="round" />
              {/* Filled progress arc: ~70% of the way */}
              <path d="M16 72 A38 38 0 1 1 84 72" stroke="#10b981" strokeWidth="8" fill="none"
                strokeLinecap="round" strokeDasharray="180" strokeDashoffset="54" />
              {/* Inner thin ring */}
              <path d="M26 72 A24 24 0 1 1 74 72" stroke="#10b981" strokeWidth="3" fill="none"
                strokeLinecap="round" opacity={0.3} />
              {/* Center needle dot */}
              <circle cx="50" cy="50" r="5" fill="#10b981" />
              {/* Needle pointing to ~70% */}
              <line x1="50" y1="50" x2="76" y2="30" stroke="#10b981" strokeWidth="4" strokeLinecap="round" />
              {/* "G" label */}
              <text x="42" y="72" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="14" fill="#10b981">G</text>
            </svg>
          </Logo>

        </div>

        <div className="mt-12 bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-semibold text-zinc-700 mb-1">Hvordan velge</p>
          <p className="text-sm text-zinc-500">
            Si hvilket nummer du liker — f.eks. <strong>"bruk #7"</strong> eller <strong>"kombiner #3 og #4"</strong> — så oppdaterer jeg appen, presentasjonen og alle logo-filene.
          </p>
        </div>
      </div>
    </div>
  );
}
