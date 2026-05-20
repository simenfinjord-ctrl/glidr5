// © 2025 Glidr — Proprietary and confidential. All rights reserved.

// ── Geometric G — the base shape, all straight lines ────────────────────────
// Drawn on a 100×100 coordinate space.
// Top-right → top-left cut → left vertical → bottom-left cut → bottom-right → right vertical → crossbar
const G = "M72 22 L36 22 L18 36 L18 64 L36 78 L72 78 L72 50 L50 50";

function Tile({ n, label, light, dark }: {
  n: number; label: string;
  light: React.ReactNode;
  dark: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm w-28 h-28 flex items-center justify-center">
        {light}
      </div>
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm w-28 h-20 flex items-center justify-center">
        {dark}
      </div>
      <p className="text-xs font-bold text-zinc-700">#{n}</p>
      <p className="text-[10px] text-zinc-400 text-center max-w-[108px] leading-tight">{label}</p>
    </div>
  );
}

export default function LogoPreview() {
  const sq = 9;   // stroke weight for the G mark
  const rc = "round" as const;

  return (
    <div className="min-h-screen bg-zinc-50 p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-extrabold mb-1 tracking-tight">Logo #12 — varianter</h1>
        <p className="text-sm text-zinc-500 mb-10">
          Alle er den geometriske G-en med rette linjer. Si nummeret du vil ha.
        </p>

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-8">

          {/* 1 — Rounded square, current green gradient */}
          <Tile n={1} label="Rounded square, grønn gradient"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v1)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <defs><linearGradient id="v1d" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v1d)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 2 — Circle */}
          <Tile n={2} label="Sirkel bakgrunn"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <circle cx="50" cy="50" r="50" fill="url(#v2)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <circle cx="50" cy="50" r="50" fill="#10b981"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 3 — No background, emerald stroke */}
          <Tile n={3} label="Bare G, ingen bakgrunn"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <polyline points={G} stroke="#10b981" strokeWidth={sq+1} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <polyline points={G} stroke="#10b981" strokeWidth={sq+1} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 4 — No background, white stroke */}
          <Tile n={4} label="Bare G, hvit (for mørk bakgrunn)"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <polyline points={G} stroke="#18181b" strokeWidth={sq+1} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <polyline points={G} stroke="white" strokeWidth={sq+1} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 5 — Hexagon */}
          <Tile n={5} label="Hexagon"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v5" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill="url(#v5)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <polygon points="50,4 93,27 93,73 50,96 7,73 7,27" fill="#10b981"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 6 — Diamond */}
          <Tile n={6} label="Diamant / rotert firkant"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v6" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect x="14" y="14" width="72" height="72" rx="8" fill="url(#v6)" transform="rotate(45 50 50)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect x="14" y="14" width="72" height="72" rx="8" fill="#10b981" transform="rotate(45 50 50)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 7 — Pill / capsule */}
          <Tile n={7} label="Pille / capsule"
            light={
              <svg viewBox="0 0 140 70" className="w-24 h-12">
                <defs><linearGradient id="v7" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="140" height="70" rx="35" fill="url(#v7)"/>
                <g transform="translate(20, 7) scale(0.56)">
                  <polyline points={G} stroke="white" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
                <text x="72" y="44" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="24" letterSpacing="-0.5" fill="white">Glidr</text>
              </svg>
            }
            dark={
              <svg viewBox="0 0 140 70" className="w-24 h-10">
                <rect width="140" height="70" rx="35" fill="#10b981"/>
                <g transform="translate(20, 7) scale(0.56)">
                  <polyline points={G} stroke="white" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
                <text x="72" y="44" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="24" letterSpacing="-0.5" fill="white">Glidr</text>
              </svg>
            }
          />

          {/* 8 — Square corners (no rounded linecap/join) */}
          <Tile n={8} label="Square caps, hardere kanter"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v8" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v8)"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect width="100" height="100" rx="22" fill="#10b981"/>
                <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
              </svg>
            }
          />

          {/* 9 — Thinner stroke, more editorial */}
          <Tile n={9} label="Tynnere streker, editorial"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v9" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v9)"/>
                <polyline points={G} stroke="white" strokeWidth="5.5" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect width="100" height="100" rx="22" fill="#10b981"/>
                <polyline points={G} stroke="white" strokeWidth="5.5" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 10 — Negative space (G cut out of filled square) */}
          <Tile n={10} label="Negativ G (cut-out)"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs>
                  <linearGradient id="v10" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                  </linearGradient>
                  <mask id="m10">
                    <rect width="100" height="100" rx="22" fill="white"/>
                    <polyline points={G} stroke="black" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                  </mask>
                </defs>
                <rect width="100" height="100" rx="22" fill="url(#v10)" mask="url(#m10)"/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <defs>
                  <mask id="m10d">
                    <rect width="100" height="100" rx="22" fill="white"/>
                    <polyline points={G} stroke="black" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                  </mask>
                </defs>
                <rect width="100" height="100" rx="22" fill="#10b981" mask="url(#m10d)"/>
              </svg>
            }
          />

          {/* 11 — Dark square, emerald G */}
          <Tile n={11} label="Mørk bakgrunn, grønn G"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <rect width="100" height="100" rx="22" fill="#18181b"/>
                <polyline points={G} stroke="#10b981" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect width="100" height="100" rx="22" fill="#18181b" stroke="#333" strokeWidth="2"/>
                <polyline points={G} stroke="#10b981" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 12 — Wordmark lockup: G mark + "Glidr" */}
          <Tile n={12} label="G mark + wordmark side by side"
            light={
              <svg viewBox="0 0 200 60" className="w-36 h-11">
                <defs><linearGradient id="v12" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="60" height="60" rx="14" fill="url(#v12)"/>
                <g transform="translate(7,7) scale(0.46)">
                  <polyline points={G} stroke="white" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
                <text x="74" y="40" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="30" letterSpacing="-0.6" fill="#18181b">Glidr</text>
              </svg>
            }
            dark={
              <svg viewBox="0 0 200 60" className="w-32 h-9">
                <defs><linearGradient id="v12d" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="60" height="60" rx="14" fill="url(#v12d)"/>
                <g transform="translate(7,7) scale(0.46)">
                  <polyline points={G} stroke="white" strokeWidth="11" fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
                <text x="74" y="40" fontFamily="'Inter',sans-serif" fontWeight="800" fontSize="30" letterSpacing="-0.6" fill="white">Glidr</text>
              </svg>
            }
          />

          {/* 13 — Tilted 12° for dynamism */}
          <Tile n={13} label="Rotert 12° — dynamikk"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v13" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v13)"/>
                <g transform="rotate(-12 50 50)">
                  <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect width="100" height="100" rx="22" fill="#10b981"/>
                <g transform="rotate(-12 50 50)">
                  <polyline points={G} stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
                </g>
              </svg>
            }
          />

          {/* 14 — Outline square (border only, no fill) */}
          <Tile n={14} label="Border-only firkant, grønn G"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke="#10b981" strokeWidth="5"/>
                <polyline points={G} stroke="#10b981" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect x="3" y="3" width="94" height="94" rx="20" fill="none" stroke="#10b981" strokeWidth="5"/>
                <polyline points={G} stroke="#10b981" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

          {/* 15 — Very tight, condensed G */}
          <Tile n={15} label="Kondensert / smalere G"
            light={
              <svg viewBox="0 0 100 100" className="w-14 h-14">
                <defs><linearGradient id="v15" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#047857"/>
                </linearGradient></defs>
                <rect width="100" height="100" rx="22" fill="url(#v15)"/>
                {/* Condensed: narrower G — same height, less horizontal width */}
                <polyline points="68 22 38 22 22 36 22 64 38 78 68 78 68 50 50 50"
                  stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
            dark={
              <svg viewBox="0 0 100 100" className="w-11 h-11">
                <rect width="100" height="100" rx="22" fill="#10b981"/>
                <polyline points="68 22 38 22 22 36 22 64 38 78 68 78 68 50 50 50"
                  stroke="white" strokeWidth={sq} fill="none" strokeLinecap={rc} strokeLinejoin={rc}/>
              </svg>
            }
          />

        </div>

        <div className="mt-12 bg-white rounded-2xl border border-zinc-200 p-6">
          <p className="text-sm font-semibold text-zinc-700 mb-1">Slik velger du</p>
          <p className="text-sm text-zinc-500">
            Si nummeret — f.eks. <strong>"bruk #11"</strong> eller <strong>"#12 med hvit tekst"</strong> — og jeg ruller det ut i appen, headeren og presentasjonen.
          </p>
        </div>
      </div>
    </div>
  );
}
