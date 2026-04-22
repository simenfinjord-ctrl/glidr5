import { useEffect, useState } from "react";

function useLoop(interval: number, count: number) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [interval, count]);
  return idx;
}

const gold = "bg-yellow-500/20 text-yellow-600 ring-1 ring-yellow-500/30";
const silver = "bg-slate-300/20 text-slate-500 ring-1 ring-slate-300/30";
const bronze = "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30";
const rankOther = "bg-muted/60 text-muted-foreground";

function RankBadge({ rank }: { rank: number }) {
  const cls = rank === 1 ? gold : rank === 2 ? silver : rank === 3 ? bronze : rankOther;
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${cls}`}>{rank}</span>;
}

function Shell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden text-[11px]">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <span className="text-[10px] text-muted-foreground font-medium">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export function DashboardAnim() {
  const tests = [
    { type: "Glide", name: "Holmenkollen", winner: "Swix LF8", rank: 1, date: "Mar 24" },
    { type: "Structure", name: "Sjusjøen", winner: "V-Line Cold", rank: 1, date: "Mar 23" },
    { type: "Classic", name: "Granåsen", winner: "Pair 3", rank: 1, date: "Mar 22" },
    { type: "Glide", name: "Lillehammer", winner: "Start MF", rank: 1, date: "Mar 21" },
    { type: "Skating", name: "Trondheim", winner: "Pair 1", rank: 1, date: "Mar 20" },
  ];
  const highlight = useLoop(3000, tests.length);
  const typeBadge = (t: string) => {
    if (t === "Glide") return "bg-green-50 text-green-700 ring-1 ring-green-200";
    if (t === "Structure") return "bg-violet-50 text-violet-700 ring-1 ring-violet-200";
    if (t === "Classic") return "bg-teal-50 text-teal-700 ring-1 ring-teal-200";
    if (t === "Skating") return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";
    return "bg-gray-50 text-gray-700";
  };

  return (
    <Shell title="Glidr — Dashboard">
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: "New test", color: "text-emerald-600" },
          { label: "New series", color: "text-sky-600" },
          { label: "Add product", color: "text-amber-600" },
          { label: "Add weather", color: "text-violet-600" },
        ].map((a) => (
          <div key={a.label} className="rounded-lg border border-border p-2 text-center">
            <div className={`text-[10px] font-semibold ${a.color}`}>{a.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border p-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-foreground text-xs">Recent results</span>
          <span className="text-[9px] text-muted-foreground">Auto-refreshes</span>
        </div>
        <div className="space-y-1">
          {tests.map((t, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1 rounded transition-all duration-700 ${i === highlight ? "bg-yellow-100/60 dark:bg-yellow-900/20" : ""}`}
            >
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${typeBadge(t.type)}`}>{t.type}</span>
              <span className="flex-1 text-foreground/80 truncate">{t.name}</span>
              <span className="text-[9px] bg-yellow-50 text-yellow-800 border border-yellow-200 rounded px-1 py-0.5 font-medium dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">🏆 {t.winner}</span>
              <span className="text-[9px] text-muted-foreground">{t.date}</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function TestsAnim() {
  const entries = [
    { ski: 1, product: "Swix LF8", method: "Iron 150°", results: [12.3, 11.8], rank: 1, feel: 2 },
    { ski: 2, product: "Start MF", method: "Cork + brush", results: [12.1, 12.4], rank: 1, feel: 1 },
    { ski: 3, product: "Rex Blue", method: "Iron 145°", results: [11.9, 12.7], rank: 3, feel: 3 },
    { ski: 4, product: "Rode Multigrade", method: "Hand roller", results: [11.5, 13.1], rank: 4, feel: 4 },
  ];
  const activeRow = useLoop(2500, entries.length);

  return (
    <Shell title="Glidr — Glide Test: Holmenkollen">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-green-50 text-green-700 ring-1 ring-green-200">Glide</span>
        <span className="text-xs font-semibold text-foreground">Holmenkollen</span>
        <span className="text-[9px] text-muted-foreground ml-auto">Mar 24, 2026</span>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-2 py-1 text-left font-medium">Ski</th>
              <th className="px-2 py-1 text-left font-medium">Product</th>
              <th className="px-2 py-1 text-left font-medium">Method</th>
              <th className="px-2 py-1 text-center font-medium">0 km</th>
              <th className="px-2 py-1 text-center font-medium">X km</th>
              <th className="px-2 py-1 text-center font-medium">Rank</th>
              <th className="px-2 py-1 text-center font-medium">Feel</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} className={`border-b border-border/50 transition-all duration-500 ${i === activeRow ? "bg-green-50/40 dark:bg-green-900/10" : ""}`}>
                <td className="px-2 py-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[9px] font-bold">{e.ski}</span></td>
                <td className="px-2 py-1 text-foreground/80">{e.product}</td>
                <td className="px-2 py-1 text-muted-foreground">{e.method}</td>
                <td className="px-2 py-1 text-center font-mono">{e.results[0].toFixed(1)}</td>
                <td className="px-2 py-1 text-center font-mono">{e.results[1].toFixed(1)}</td>
                <td className="px-2 py-1 text-center"><RankBadge rank={e.rank} /></td>
                <td className="px-2 py-1 text-center"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold dark:bg-violet-900/30 dark:text-violet-300">{e.feel}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-1.5 mt-2">
        <span className="text-[9px] px-2 py-0.5 rounded bg-muted text-foreground font-medium cursor-default">PDF</span>
        <span className="text-[9px] px-2 py-0.5 rounded bg-muted text-foreground font-medium cursor-default">Excel</span>
        <span className="text-[9px] px-2 py-0.5 rounded bg-muted text-foreground font-medium cursor-default">Hide / Show</span>
      </div>
    </Shell>
  );
}

export function RunsheetAnim() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 4), 2500);
    return () => clearInterval(t);
  }, []);

  const matches = [
    { round: "QF", pairs: [["Pair 1", "Pair 8"], ["Pair 4", "Pair 5"], ["Pair 2", "Pair 7"], ["Pair 3", "Pair 6"]] },
    { round: "SF", pairs: [["Pair 1", "Pair 4"], ["Pair 2", "Pair 3"]] },
    { round: "Final", pairs: [["Pair 1", "Pair 2"]] },
  ];

  return (
    <Shell title="Glidr — Complete Runsheet">
      <div className="flex gap-4 min-h-[140px]">
        {matches.map((round, ri) => (
          <div key={ri} className="flex-1">
            <div className="text-[9px] font-bold text-muted-foreground mb-1 text-center">{round.round}</div>
            <div className="space-y-2">
              {round.pairs.map((pair, pi) => {
                const isActive = (ri === 0 && step === 0) || (ri === 1 && step === 1) || (ri === 2 && step === 2);
                const winnerIdx = step > ri ? 0 : -1;
                return (
                  <div key={pi} className={`rounded border transition-all duration-500 ${isActive ? "border-green-400 ring-1 ring-green-400/30" : "border-border"}`}>
                    {pair.map((p, i) => (
                      <div
                        key={i}
                        className={`px-1.5 py-1 text-[9px] flex items-center justify-between transition-all duration-500 ${i === 0 ? "border-b border-border/50" : ""} ${winnerIdx === i ? "bg-emerald-50/60 font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "text-foreground/70"}`}
                      >
                        <span className="truncate">{step > ri ? p : (ri > 0 && step <= ri ? "—" : p)}</span>
                        {winnerIdx === i && <span className="text-[8px]">0cm</span>}
                        {winnerIdx !== i && step > ri && <span className="text-[8px] text-muted-foreground">+{(pi + 1) * 3 + ri * 2}cm</span>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {step === 3 && (
        <div className="mt-2 rounded border border-emerald-300 bg-emerald-50/50 px-2 py-1 text-[10px] text-emerald-700 font-semibold text-center dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700">
          🏆 Winner: Pair 1
        </div>
      )}
    </Shell>
  );
}

export function AnalyticsAnim() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame((f) => (f + 1) % 60), 100);
    return () => clearInterval(t);
  }, []);

  const products = ["Swix LF8", "Start MF", "Rex Blue"];
  const colors = ["#3b82f6", "#10b981", "#f59e0b"];
  const barData = [
    { label: "Wins", values: [12, 8, 5] },
    { label: "Avg Rank", values: [1.4, 2.1, 2.8] },
    { label: "Win %", values: [48, 32, 20] },
  ];

  const chartH = 60;
  const points = 8;
  const lineData = products.map((_, pi) =>
    Array.from({ length: points }, (_, i) => {
      const base = pi === 0 ? 1.3 : pi === 1 ? 2.0 : 2.7;
      const wave = Math.sin((i + frame * 0.05 + pi) * 0.8) * 0.4;
      return base + wave;
    })
  );

  return (
    <Shell title="Glidr — Analytics">
      <div className="flex items-center gap-2 mb-2">
        {products.map((p, i) => (
          <span key={i} className="flex items-center gap-1 text-[9px]">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
            {p}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] font-semibold mb-1 text-muted-foreground">Avg Rank Over Time</div>
          <svg viewBox={`0 0 140 ${chartH}`} className="w-full h-14">
            {lineData.map((line, li) => {
              const pathD = line.map((v, i) => {
                const x = (i / (points - 1)) * 136 + 2;
                const y = ((v - 0.5) / 3.5) * (chartH - 8) + 4;
                return `${i === 0 ? "M" : "L"} ${x} ${y}`;
              }).join(" ");
              return <path key={li} d={pathD} fill="none" stroke={colors[li]} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />;
            })}
          </svg>
        </div>
        <div className="rounded-lg border border-border p-2">
          <div className="text-[9px] font-semibold mb-1 text-muted-foreground">Product Comparison</div>
          <div className="space-y-1.5">
            {barData.map((d) => (
              <div key={d.label}>
                <div className="text-[8px] text-muted-foreground mb-0.5">{d.label}</div>
                <div className="flex gap-0.5 h-2.5">
                  {d.values.map((v, i) => (
                    <div
                      key={i}
                      className="rounded-sm transition-all duration-1000"
                      style={{
                        backgroundColor: colors[i],
                        width: `${(v / Math.max(...d.values)) * 100}%`,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function WeatherAnim() {
  const logs = [
    { date: "Mar 24", loc: "Holmenkollen", airT: -4.2, snowT: -6.1, humid: 72, snow: "Transformed", grain: "Fine", quality: 8 },
    { date: "Mar 23", loc: "Sjusjøen", airT: -7.5, snowT: -9.3, humid: 65, snow: "New", grain: "Extra fine", quality: 9 },
    { date: "Mar 22", loc: "Granåsen", airT: -2.1, snowT: -3.8, humid: 80, snow: "Artificial", grain: "Medium", quality: 6 },
  ];
  const active = useLoop(3000, logs.length);

  return (
    <Shell title="Glidr — Weather">
      <div className="space-y-2">
        {logs.map((w, i) => (
          <div key={i} className={`rounded-lg border p-2 transition-all duration-500 ${i === active ? "border-green-300 ring-1 ring-green-300/30 dark:border-green-600" : "border-border"}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-foreground text-[11px]">{w.loc}</span>
              <span className="text-[9px] text-muted-foreground">{w.date}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-700">🌡 Air {w.airT}°C</span>
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700">❄ Snow {w.snowT}°C</span>
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700">💧 {w.humid}%</span>
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 ${w.snow === "Artificial" ? "bg-pink-50 text-pink-700 ring-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:ring-pink-700" : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-700"}`}>{w.snow}</span>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700">Grain: {w.grain}</span>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700">Quality: {w.quality}/10</span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function TestSkisAnim() {
  const series = [
    { name: "Cold Series 1", type: "Glide", brand: "Fischer", pairs: 6, tests: 14 },
    { name: "Warm Structure", type: "Structure", brand: "Atomic", pairs: 4, tests: 8 },
    { name: "Grind Compare", type: "Grind", brand: "Madshus", pairs: 5, tests: 11 },
  ];
  const active = useLoop(3000, series.length);
  const typeBadge = (t: string) => {
    if (t === "Glide") return "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700";
    if (t === "Structure") return "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-700";
    return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-700";
  };

  return (
    <Shell title="Glidr — Test Ski Series">
      <div className="space-y-2">
        {series.map((s, i) => (
          <div key={i} className={`rounded-lg border p-2 transition-all duration-500 ${i === active ? "border-sky-300 ring-1 ring-sky-300/30 dark:border-sky-600" : "border-border"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${typeBadge(s.type)}`}>{s.type}</span>
              <span className="text-[11px] font-semibold text-foreground">{s.name}</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
              <span>Brand: {s.brand}</span>
              <span>{s.pairs} pairs</span>
              <span>{s.tests} tests</span>
            </div>
            {i === active && (
              <div className="mt-1.5 flex gap-1 animate-in fade-in duration-500">
                {Array.from({ length: s.pairs }, (_, p) => (
                  <span key={p} className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-[8px] font-bold text-foreground/70">
                    {p + 1}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function ProductsAnim() {
  const products = [
    { brand: "Swix", name: "LF8", cat: "Glide", stock: 5, group: "A-team" },
    { brand: "Start", name: "MF Blue", cat: "Glide", stock: 2, group: "A-team" },
    { brand: "Rex", name: "Blue", cat: "Topping", stock: 0, group: "B-team" },
    { brand: "Rode", name: "Multigrade", cat: "Glide", stock: 8, group: "A-team" },
    { brand: "Swix", name: "T0076", cat: "Structure", stock: 1, group: "B-team" },
  ];
  const [stocks, setStocks] = useState(products.map((p) => p.stock));
  const animIdx = useLoop(2000, products.length);

  useEffect(() => {
    setStocks((prev) => {
      const next = [...prev];
      next[animIdx] = Math.max(0, products[animIdx].stock + Math.floor(Math.random() * 3) - 1);
      return next;
    });
  }, [animIdx]);

  const catBadge = (c: string) => {
    if (c === "Glide") return "bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700";
    if (c === "Topping") return "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700";
    return "bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-700";
  };
  const stockColor = (s: number) => s === 0 ? "text-red-600" : s <= 2 ? "text-amber-600" : "text-emerald-600";

  return (
    <Shell title="Glidr — Products / Storage">
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-2 py-1 text-left font-medium">Product</th>
              <th className="px-2 py-1 text-left font-medium">Type</th>
              <th className="px-2 py-1 text-center font-medium">Group</th>
              <th className="px-2 py-1 text-center font-medium">Stock</th>
              <th className="px-2 py-1 text-center font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={i} className={`border-b border-border/50 transition-all duration-500 ${i === animIdx ? "bg-green-50/30 dark:bg-green-900/10" : ""}`}>
                <td className="px-2 py-1 text-foreground/80 font-medium">{p.brand} {p.name}</td>
                <td className="px-2 py-1"><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${catBadge(p.cat)}`}>{p.cat}</span></td>
                <td className="px-2 py-1 text-center text-[9px] text-muted-foreground">{p.group}</td>
                <td className={`px-2 py-1 text-center font-bold ${stockColor(stocks[i])}`}>{stocks[i]}</td>
                <td className="px-2 py-1 text-center">
                  <span className="inline-flex gap-0.5">
                    <span className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[9px] cursor-default">−</span>
                    <span className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[9px] cursor-default">+</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export function RaceSkisAnim() {
  const athletes = [
    { name: "Johannes Klæbo", team: "Norway", skis: [
      { serial: "FIS-2024-001", brand: "Fischer", discipline: "Classic", grind: "S1-7" },
      { serial: "FIS-2024-002", brand: "Fischer", discipline: "Skating", grind: "K2-3" },
    ]},
    { name: "Therese Johaug", team: "Norway", skis: [
      { serial: "ATO-2024-015", brand: "Atomic", discipline: "Classic", grind: "M4-1" },
    ]},
  ];
  const activeAthlete = useLoop(4000, athletes.length);

  return (
    <Shell title="Glidr — Race Skis">
      <div className="space-y-2">
        {athletes.map((a, ai) => (
          <div key={ai} className={`rounded-lg border p-2 transition-all duration-500 ${ai === activeAthlete ? "border-emerald-300 ring-1 ring-emerald-300/30 dark:border-emerald-600" : "border-border"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-foreground">{a.name}</span>
              <span className="text-[9px] text-muted-foreground">{a.team}</span>
            </div>
            {ai === activeAthlete && (
              <div className="space-y-1 animate-in fade-in duration-500">
                <div className="text-[9px] font-medium text-muted-foreground">Ski Garage</div>
                {a.skis.map((s, si) => (
                  <div key={si} className="flex items-center gap-2 text-[9px] bg-muted/30 rounded px-1.5 py-1">
                    <span className="font-mono text-foreground/70">{s.serial}</span>
                    <span className="text-foreground/80">{s.brand}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-medium ${s.discipline === "Classic" ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-700" : "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:ring-cyan-700"}`}>{s.discipline}</span>
                    <span className="text-muted-foreground ml-auto">Grind: {s.grind}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function AdminAnim() {
  const areas = ["dashboard", "tests", "testskis", "products", "weather", "analytics", "grinding", "raceskis"];
  const presets = ["Full Access", "Coach", "Skitester"];
  const activePreset = useLoop(3500, presets.length);
  const permSets: Record<string, Record<string, string>> = {
    "Full Access": Object.fromEntries(areas.map((a) => [a, "edit"])),
    "Coach": { dashboard: "edit", tests: "edit", testskis: "edit", products: "none", weather: "edit", analytics: "edit", grinding: "none", raceskis: "edit" },
    "Skitester": { dashboard: "none", tests: "none", testskis: "none", products: "none", weather: "edit", analytics: "none", grinding: "none", raceskis: "none" },
  };
  const perms = permSets[presets[activePreset]];

  return (
    <Shell title="Glidr — Admin / Permissions">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] font-medium text-muted-foreground">Presets:</span>
        {presets.map((p, i) => (
          <span key={p} className={`rounded-full px-2 py-0.5 text-[9px] font-medium transition-all duration-500 cursor-default ${i === activePreset ? "bg-teal-100 text-teal-800 ring-1 ring-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:ring-teal-700" : "bg-muted text-muted-foreground"}`}>{p}</span>
        ))}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="px-2 py-1 text-left font-medium">Area</th>
              <th className="px-2 py-1 text-center font-medium">None</th>
              <th className="px-2 py-1 text-center font-medium">Edit</th>
            </tr>
          </thead>
          <tbody>
            {areas.map((a) => (
              <tr key={a} className="border-b border-border/50">
                <td className="px-2 py-0.5 capitalize text-foreground/80">{a}</td>
                <td className="px-2 py-0.5 text-center">
                  <span className={`inline-block w-3 h-3 rounded-full transition-all duration-500 ${perms[a] === "none" ? "bg-gray-400 ring-2 ring-gray-300" : "bg-muted ring-1 ring-border"}`} />
                </td>
                <td className="px-2 py-0.5 text-center">
                  <span className={`inline-block w-3 h-3 rounded-full transition-all duration-500 ${perms[a] === "edit" ? "bg-green-500 ring-2 ring-green-300" : "bg-muted ring-1 ring-border"}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export function MobileAnim() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setOnline((o) => {
        if (!o) { setPending(0); return true; }
        setPending(Math.floor(Math.random() * 4) + 1);
        return false;
      });
    }, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="mx-auto" style={{ maxWidth: 180 }}>
      <div className="rounded-[20px] border-2 border-border bg-card shadow-lg overflow-hidden">
        <div className="bg-muted/30 px-3 py-1 border-b border-border flex items-center justify-between">
          <span className="text-[9px] font-bold text-foreground">Glidr</span>
          <div className="flex items-center gap-1">
            {!online && pending > 0 && (
              <span className="text-[8px] bg-amber-100 text-amber-700 rounded-full px-1 font-medium dark:bg-amber-900/30 dark:text-amber-300">{pending} pending</span>
            )}
            <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${online ? "bg-emerald-500" : "bg-red-500"}`} />
          </div>
        </div>
        <div className="p-2 space-y-1.5">
          {[
            { type: "Glide", name: "Holmenkollen", winner: "Swix LF8" },
            { type: "Structure", name: "Sjusjøen", winner: "V-Line" },
            { type: "Classic", name: "Granåsen", winner: "Pair 3" },
          ].map((t, i) => (
            <div key={i} className="rounded-lg border border-border p-1.5">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="rounded-full px-1 py-0.5 text-[7px] font-medium bg-green-50 text-green-700 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-700">{t.type}</span>
                <span className="text-[9px] font-semibold text-foreground truncate">{t.name}</span>
              </div>
              <div className="text-[8px] text-muted-foreground">🏆 {t.winner}</div>
            </div>
          ))}
          {!online && (
            <div className="text-center py-1 text-[8px] text-amber-600 font-medium animate-pulse dark:text-amber-400">
              ● Offline — changes will sync
            </div>
          )}
          {online && pending === 0 && (
            <div className="text-center py-1 text-[8px] text-emerald-600 font-medium dark:text-emerald-400">
              ● Synced
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
